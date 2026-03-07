import fs from "node:fs";
import path from "node:path";
import { coreClient } from "./toolkit/core-client.js";
import type { BumpLevel, NoBumpPolicy, RangeStrategy, RelluConfig, TargetConfig, VersionSource } from "./types.js";
import { globToRegExp, toPosixPath } from "./utils/paths.js";

type ConfigFile = Partial<{
  targets: unknown;
  apps: unknown;
  bumpRules: unknown;
  fromRef: unknown;
  toRef: unknown;
  rangeStrategy: unknown;
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
const SUPPORTED_RANGE_STRATEGIES: ReadonlySet<RangeStrategy> = new Set([
  "explicit",
  "latest-tag",
  "latest-tag-with-prefix"
]);

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

function parseBooleanString(value: string, source: string): boolean {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  throw new Error(`Invalid boolean value "${value}" for ${source}. Expected "true" or "false".`);
}

function describeValue(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  return typeof value;
}

function parseConfigBoolean(value: unknown, configKey: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return parseBooleanString(value.trim(), `config-file.${configKey}`);
  }

  throw new Error(
    `Invalid boolean value type for config-file.${configKey}: got ${describeValue(value)}. ` +
      `Expected boolean or string "true"/"false".`
  );
}

function resolveBooleanOption(
  inputName: string,
  inputValue: string,
  configValue: unknown,
  configKey: string,
  fallback: boolean
): boolean {
  if (inputValue) {
    return parseBooleanString(inputValue, `input "${inputName}"`);
  }

  const fromConfig = parseConfigBoolean(configValue, configKey);
  return fromConfig ?? fallback;
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
  const tagPrefix = asOptionalString(target.tagPrefix ?? target["tag-prefix"]);
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
    ...(tagPrefix ? { tagPrefix } : {}),
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

  const rangeStrategyRaw =
    (readInput("range-strategy") || asOptionalString(fileConfig.rangeStrategy) || "explicit") as RangeStrategy;
  if (!SUPPORTED_RANGE_STRATEGIES.has(rangeStrategyRaw)) {
    throw new Error(
      `Invalid range-strategy "${rangeStrategyRaw}". Expected explicit, latest-tag, or latest-tag-with-prefix.`
    );
  }

  const fromRef = readInput("from-ref") || asOptionalString(fileConfig.fromRef);
  const toRef = readInput("to-ref") || asOptionalString(fileConfig.toRef) || "HEAD";

  if (rangeStrategyRaw === "latest-tag-with-prefix") {
    const missingPrefix = targets.filter((target) => !target.tagPrefix);
    if (missingPrefix.length > 0) {
      const labels = missingPrefix.map((target) => target.label).join(", ");
      throw new Error(
        `range-strategy latest-tag-with-prefix requires tagPrefix on every target. Missing: ${labels}`
      );
    }
  }

  const noBumpPolicyRaw =
    (readInput("no-bump-policy") || asOptionalString(fileConfig.noBumpPolicy) || "skip") as NoBumpPolicy;
  if (!SUPPORTED_NO_BUMP_POLICIES.has(noBumpPolicyRaw)) {
    throw new Error(`Invalid no-bump-policy "${noBumpPolicyRaw}". Expected skip, keep, or patch.`);
  }

  const strictInput = readInput("strict-conventional-commits");
  const createReleasePrsInput = readInput("create-release-prs");

  const releaseBranchPrefix = readInput("release-branch-prefix") || asOptionalString(fileConfig.releaseBranchPrefix) || "rellu/release";
  const baseBranch = readInput("base-branch") || asOptionalString(fileConfig.baseBranch) || "main";
  const repo = readInput("repo") || asOptionalString(fileConfig.repo) || asOptionalString(process.env.GITHUB_REPOSITORY);
  const githubServerUrl = readInput("github-server-url") || asOptionalString(fileConfig.githubServerUrl) || "https://api.github.com";
  const githubToken =
    readInput("github-token") ||
    asOptionalString(process.env.GITHUB_TOKEN) ||
    asOptionalString(process.env.INPUT_GITHUB_TOKEN);

  return {
    rangeStrategy: rangeStrategyRaw,
    fromRef,
    toRef,
    strictConventionalCommits: resolveBooleanOption(
      "strict-conventional-commits",
      strictInput,
      fileConfig.strictConventionalCommits,
      "strictConventionalCommits",
      false
    ),
    bumpRules,
    noBumpPolicy: noBumpPolicyRaw,
    createReleasePrs: resolveBooleanOption(
      "create-release-prs",
      createReleasePrsInput,
      fileConfig.createReleasePrs,
      "createReleasePrs",
      false
    ),
    releaseBranchPrefix,
    baseBranch,
    repo,
    githubServerUrl,
    githubToken,
    targets
  };
}
