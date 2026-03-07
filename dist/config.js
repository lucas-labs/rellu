import fs from "node:fs";
import path from "node:path";
import { globToRegExp, toPosixPath } from "./utils/paths.js";

/**
 * @typedef {"node-package-json" | "rust-cargo-toml" | "python-pyproject-toml"} ManifestType
 * @typedef {"major" | "minor" | "patch" | "none"} BumpLevel
 * @typedef {"skip" | "keep" | "patch"} NoBumpPolicy
 *
 * @typedef {{
 *   file: string;
 *   type: ManifestType;
 * }} VersionSource
 *
 * @typedef {{
 *   label: string;
 *   paths: string[];
 *   version: VersionSource;
 * }} TargetConfig
 *
 * @typedef {{
 *   fromRef: string;
 *   toRef: string;
 *   strictConventionalCommits: boolean;
 *   bumpRules: Record<string, BumpLevel>;
 *   noBumpPolicy: NoBumpPolicy;
 *   createReleasePrs: boolean;
 *   releaseBranchPrefix: string;
 *   baseBranch: string;
 *   repo: string;
 *   githubServerUrl: string;
 *   githubToken: string;
 *   targets: TargetConfig[];
 * }} RelluConfig
 */

const SUPPORTED_MANIFEST_TYPES = new Set([
  "node-package-json",
  "rust-cargo-toml",
  "python-pyproject-toml"
]);

const SUPPORTED_BUMP_LEVELS = new Set(["major", "minor", "patch", "none"]);
const SUPPORTED_NO_BUMP_POLICIES = new Set(["skip", "keep", "patch"]);

/** @type {Record<string, BumpLevel>} */
const DEFAULT_BUMP_RULES = {
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

/**
 * @param {string} name
 * @returns {string}
 */
function readInput(name) {
  return String(process.env[`INPUT_${name.replace(/ /g, "_").toUpperCase()}`] ?? "").trim();
}

/**
 * @param {string} value
 * @param {boolean} fallback
 * @returns {boolean}
 */
function toBoolean(value, fallback) {
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

/**
 * @param {string} input
 * @returns {any}
 */
function parseJson(input) {
  try {
    return JSON.parse(input);
  } catch (error) {
    throw new Error(`Invalid JSON input: ${String(error)}`);
  }
}

/**
 * @param {string} filePath
 * @returns {any}
 */
function loadConfigFile(filePath) {
  const absolute = path.resolve(filePath);
  if (!fs.existsSync(absolute)) {
    throw new Error(`Config file not found: ${absolute}`);
  }
  const ext = path.extname(absolute).toLowerCase();
  if (ext !== ".json") {
    throw new Error(`Unsupported config file extension "${ext}". Use JSON config files.`);
  }
  const raw = fs.readFileSync(absolute, "utf8");
  return parseJson(raw);
}

/**
 * @param {string} rawTargets
 * @param {any} fileConfig
 * @returns {TargetConfig[]}
 */
function resolveTargets(rawTargets, fileConfig) {
  const fromFile = fileConfig?.targets ?? fileConfig?.apps;
  const source = rawTargets ? parseJson(rawTargets) : fromFile;

  if (!Array.isArray(source) || source.length === 0) {
    throw new Error("No targets provided. Set input 'targets' or provide targets/apps in config-file.");
  }

  return source.map((target, index) => {
    if (!target || typeof target !== "object") {
      throw new Error(`Target at index ${index} must be an object`);
    }
    const label = String(target.label ?? "").trim();
    if (!label) {
      throw new Error(`Target at index ${index} is missing required field: label`);
    }

    const paths = Array.isArray(target.paths) ? target.paths.map((value) => String(value).trim()) : [];
    if (paths.length === 0) {
      throw new Error(`Target "${label}" must define at least one path glob`);
    }

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

    const version = target.version;
    if (!version || typeof version !== "object") {
      throw new Error(`Target "${label}" must define version.file and version.type`);
    }

    const file = String(version.file ?? "").trim();
    const type = String(version.type ?? "").trim();
    if (!file) {
      throw new Error(`Target "${label}" is missing version.file`);
    }
    if (!SUPPORTED_MANIFEST_TYPES.has(type)) {
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
        type
      }
    };
  });
}

/**
 * @param {Record<string, unknown>} value
 * @returns {Record<string, BumpLevel>}
 */
function parseBumpRules(value) {
  const merged = { ...DEFAULT_BUMP_RULES };
  for (const [key, rawLevel] of Object.entries(value)) {
    const level = String(rawLevel ?? "").trim();
    if (!SUPPORTED_BUMP_LEVELS.has(level)) {
      throw new Error(`Unsupported bump level "${level}" for commit type "${key}"`);
    }
    merged[key] = /** @type {BumpLevel} */ (level);
  }
  return merged;
}

/**
 * @param {TargetConfig[]} targets
 */
function validateUniqueTargetLabels(targets) {
  const seen = new Set();
  for (const target of targets) {
    if (seen.has(target.label)) {
      throw new Error(`Duplicate target label "${target.label}"`);
    }
    seen.add(target.label);
  }
}

/**
 * @returns {RelluConfig}
 */
export function loadConfig() {
  const configFileInput = readInput("config-file");
  const fileConfig = configFileInput ? loadConfigFile(configFileInput) : {};

  const targets = resolveTargets(readInput("targets"), fileConfig);
  validateUniqueTargetLabels(targets);

  const rawBumpRules = readInput("bump-rules");
  const bumpRulesFromFile = fileConfig?.bumpRules ?? {};
  const bumpRulesInput = rawBumpRules ? parseJson(rawBumpRules) : bumpRulesFromFile;
  if (bumpRulesInput && typeof bumpRulesInput !== "object") {
    throw new Error("bump-rules must be a JSON object");
  }
  const bumpRules = parseBumpRules(/** @type {Record<string, unknown>} */ (bumpRulesInput ?? {}));

  const fromRef = readInput("from-ref") || String(fileConfig?.fromRef ?? "").trim();
  const toRef = readInput("to-ref") || String(fileConfig?.toRef ?? "HEAD").trim() || "HEAD";

  const noBumpPolicyRaw =
    readInput("no-bump-policy") || String(fileConfig?.noBumpPolicy ?? "skip").trim() || "skip";
  if (!SUPPORTED_NO_BUMP_POLICIES.has(noBumpPolicyRaw)) {
    throw new Error(`Invalid no-bump-policy "${noBumpPolicyRaw}". Expected skip, keep, or patch.`);
  }

  const strictRaw = readInput("strict-conventional-commits") || String(fileConfig?.strictConventionalCommits ?? "");
  const createReleasePrsRaw = readInput("create-release-prs") || String(fileConfig?.createReleasePrs ?? "");
  const strictConventionalCommits = toBoolean(strictRaw, false);
  const createReleasePrs = toBoolean(createReleasePrsRaw, false);

  const releaseBranchPrefix =
    readInput("release-branch-prefix") || String(fileConfig?.releaseBranchPrefix ?? "rellu/release").trim();
  const baseBranch = readInput("base-branch") || String(fileConfig?.baseBranch ?? "main").trim();
  const repo = readInput("repo") || String(fileConfig?.repo ?? process.env.GITHUB_REPOSITORY ?? "").trim();
  const githubServerUrl =
    readInput("github-server-url") || String(fileConfig?.githubServerUrl ?? "https://api.github.com").trim();
  const githubToken = String(process.env.GITHUB_TOKEN ?? process.env.INPUT_GITHUB_TOKEN ?? "").trim();

  return {
    fromRef,
    toRef,
    strictConventionalCommits,
    bumpRules,
    noBumpPolicy: /** @type {NoBumpPolicy} */ (noBumpPolicyRaw),
    createReleasePrs,
    releaseBranchPrefix,
    baseBranch,
    repo,
    githubServerUrl,
    githubToken,
    targets
  };
}
