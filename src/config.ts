import fs from "node:fs";
import path from "node:path";
import { coreClient } from "./toolkit/core-client.js";
import type { BumpLevel, NoBumpPolicy, RelluConfig, TargetConfig, VersionSource } from "./types.js";
import { globToRegExp, toPosixPath } from "./utils/paths.js";

type ConfigFile = Partial<{
  targets: unknown;
  apps: unknown;
  bumpRules: unknown;
  fromRef: unknown;
  toRef: unknown;
  noBumpPolicy: unknown;
  strictConventionalCommits: unknown;
  createReleasePrs: unknown;
  releaseBranchPrefix: unknown;
  baseBranch: unknown;
  repo: unknown;
  githubServerUrl: unknown;
}>;

const SUPPORTED_MANIFEST_TYPES: ReadonlySet<VersionSource["type"]> = new Set([
  "node-package-json",
  "rust-cargo-toml",
  "python-pyproject-toml"
]);

const SUPPORTED_BUMP_LEVELS: ReadonlySet<BumpLevel> = new Set(["major", "minor", "patch", "none"]);
const SUPPORTED_NO_BUMP_POLICIES: ReadonlySet<NoBumpPolicy> = new Set(["skip", "keep", "patch"]);

const DEFAULT_BUMP_RULES: Record<string, BumpLevel> = {
  feat: "minor",
  fix: "patch",
  perf: "patch",
  refactor: "patch",
  docs: "none",
  chore: "none",
  test: "none",
  build: "none",
  ci: "none",
  style: "none",
  other: "none"
};

function readInput(name: string): string {
  return coreClient.getInput(name);
}

function toBoolean(value: string, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  throw new Error(`Invalid boolean value "${value}"`);
}

function parseJson(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch (error) {
    throw new Error(`Invalid JSON input: ${String(error)}`);
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected an object");
  }
  return value as Record<string, unknown>;
}

function asOptionalString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function loadConfigFile(filePath: string): ConfigFile {
  const absolute = path.resolve(filePath);
  if (!fs.existsSync(absolute)) {
    throw new Error(`Config file not found: ${absolute}`);
  }
  const extension = path.extname(absolute).toLowerCase();
  if (extension !== ".json") {
    throw new Error(`Unsupported config file extension "${extension}". Use JSON config files.`);
  }

  const raw = fs.readFileSync(absolute, "utf8");
  const parsed = parseJson(raw);
  return asRecord(parsed);
}

function parseTarget(targetValue: unknown, index: number): TargetConfig {
  const target = asRecord(targetValue);
  const label = asOptionalString(target.label);
  if (!label) {
    throw new Error(`Target at index ${index} is missing required field: label`);
  }

  const pathsValue = target.paths;
  if (!Array.isArray(pathsValue) || pathsValue.length === 0) {
    throw new Error(`Target "${label}" must define at least one path glob`);
  }
  const paths = pathsValue.map((value) => String(value).trim());
  for (const glob of paths) {
    if (!glob) {
      throw new Error(`Target "${label}" has an empty path glob`);
    }
    try {
      globToRegExp(glob);
    } catch (error) {
      throw new Error(`Target "${label}" has invalid glob "${glob}": ${String(error)}`);
    }
  }

  const version = asRecord(target.version);
  const file = asOptionalString(version.file);
  const type = asOptionalString(version.type);
  if (!file) {
    throw new Error(`Target "${label}" is missing version.file`);
  }
  if (!SUPPORTED_MANIFEST_TYPES.has(type as VersionSource["type"])) {
    throw new Error(
      `Target "${label}" has unsupported version.type "${type}". ` +
        "Supported: node-package-json, rust-cargo-toml, python-pyproject-toml."
    );
  }

  return {
    label,
    paths: paths.map((entry) => toPosixPath(entry)),
    version: {
      file: toPosixPath(file),
      type: type as VersionSource["type"]
    }
  };
}

function resolveTargets(rawTargets: string, fileConfig: ConfigFile): TargetConfig[] {
  const fromFile = fileConfig.targets ?? fileConfig.apps;
  const source = rawTargets ? parseJson(rawTargets) : fromFile;
  if (!Array.isArray(source) || source.length === 0) {
    throw new Error("No targets provided. Set input 'targets' or provide targets/apps in config-file.");
  }

  return source.map((target, index) => parseTarget(target, index));
}

function parseBumpRules(value: unknown): Record<string, BumpLevel> {
  const record = asRecord(value);
  const merged = { ...DEFAULT_BUMP_RULES };
  for (const [commitType, rawLevel] of Object.entries(record)) {
    const level = asOptionalString(rawLevel);
    if (!SUPPORTED_BUMP_LEVELS.has(level as BumpLevel)) {
      throw new Error(`Unsupported bump level "${level}" for commit type "${commitType}"`);
    }
    merged[commitType] = level as BumpLevel;
  }
  return merged;
}

function validateUniqueTargetLabels(targets: TargetConfig[]): void {
  const seen = new Set<string>();
  for (const target of targets) {
    if (seen.has(target.label)) {
      throw new Error(`Duplicate target label "${target.label}"`);
    }
    seen.add(target.label);
  }
}

export function loadConfig(): RelluConfig {
  const configFileInput = readInput("config-file");
  const fileConfig = configFileInput ? loadConfigFile(configFileInput) : {};

  const targets = resolveTargets(readInput("targets"), fileConfig);
  validateUniqueTargetLabels(targets);

  const rawBumpRules = readInput("bump-rules");
  const bumpRulesInput = rawBumpRules ? parseJson(rawBumpRules) : (fileConfig.bumpRules ?? {});
  const bumpRules = parseBumpRules(bumpRulesInput);

  const fromRef = readInput("from-ref") || asOptionalString(fileConfig.fromRef);
  const toRef = readInput("to-ref") || asOptionalString(fileConfig.toRef) || "HEAD";

  const noBumpPolicyRaw =
    (readInput("no-bump-policy") || asOptionalString(fileConfig.noBumpPolicy) || "skip") as NoBumpPolicy;
  if (!SUPPORTED_NO_BUMP_POLICIES.has(noBumpPolicyRaw)) {
    throw new Error(`Invalid no-bump-policy "${noBumpPolicyRaw}". Expected skip, keep, or patch.`);
  }

  const strictRaw = readInput("strict-conventional-commits") || asOptionalString(fileConfig.strictConventionalCommits);
  const createReleasePrsRaw = readInput("create-release-prs") || asOptionalString(fileConfig.createReleasePrs);

  const releaseBranchPrefix = readInput("release-branch-prefix") || asOptionalString(fileConfig.releaseBranchPrefix) || "rellu/release";
  const baseBranch = readInput("base-branch") || asOptionalString(fileConfig.baseBranch) || "main";
  const repo = readInput("repo") || asOptionalString(fileConfig.repo) || asOptionalString(process.env.GITHUB_REPOSITORY);
  const githubServerUrl = readInput("github-server-url") || asOptionalString(fileConfig.githubServerUrl) || "https://api.github.com";
  const githubToken =
    readInput("github-token") ||
    asOptionalString(process.env.GITHUB_TOKEN) ||
    asOptionalString(process.env.INPUT_GITHUB_TOKEN);

  return {
    fromRef,
    toRef,
    strictConventionalCommits: toBoolean(strictRaw, false),
    bumpRules,
    noBumpPolicy: noBumpPolicyRaw,
    createReleasePrs: toBoolean(createReleasePrsRaw, false),
    releaseBranchPrefix,
    baseBranch,
    repo,
    githubServerUrl,
    githubToken,
    targets
  };
}
