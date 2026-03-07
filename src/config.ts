import fs from "node:fs";
import path from "node:path";
import { DEFAULT_CHANGELOG_CATEGORY_MAP, DEFAULT_CHANGELOG_SECTION_ORDER } from "./changelog.js";
import { coreClient } from "./toolkit/core-client.js";
import type {
  BumpLevel,
  ChangelogConfig,
  NoBumpPolicy,
  RangeStrategy,
  RelluConfig,
  TargetConfig,
  TargetReleasePrConfig,
  VersionSource
} from "./types.js";
import { toPosixPath, validateGlobPattern } from "./utils/paths.js";

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
  changelogCategoryMap: unknown;
  changelogSectionOrder: unknown;
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

function parseJsonFromSource(input: string, source: string): unknown {
  try {
    return JSON.parse(input);
  } catch (error) {
    throw new Error(`Invalid JSON for ${source}: ${String(error)}`);
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

function parseTargetReleasePrConfig(value: unknown, label: string): TargetReleasePrConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Target "${label}" has invalid releasePr value. Expected an object.`);
  }

  const record = value as Record<string, unknown>;
  const enabledRaw = record.enabled;
  const branchPrefixRaw = record.branchPrefix ?? record["branch-prefix"];
  const baseBranchRaw = record.baseBranch ?? record["base-branch"];

  let enabled: boolean | undefined;
  if (enabledRaw !== undefined) {
    if (typeof enabledRaw === "boolean") {
      enabled = enabledRaw;
    } else if (typeof enabledRaw === "string") {
      enabled = parseBooleanString(enabledRaw.trim(), `target "${label}" releasePr.enabled`);
    } else {
      throw new Error(`Target "${label}" has invalid releasePr.enabled. Expected boolean or "true"/"false".`);
    }
  }

  let branchPrefix: string | undefined;
  if (branchPrefixRaw !== undefined) {
    if (typeof branchPrefixRaw !== "string") {
      throw new Error(`Target "${label}" has invalid releasePr.branchPrefix. Expected non-empty string.`);
    }
    const normalized = branchPrefixRaw.trim();
    if (!normalized) {
      throw new Error(`Target "${label}" has invalid releasePr.branchPrefix. Expected non-empty string.`);
    }
    branchPrefix = normalized;
  }

  let baseBranch: string | undefined;
  if (baseBranchRaw !== undefined) {
    if (typeof baseBranchRaw !== "string") {
      throw new Error(`Target "${label}" has invalid releasePr.baseBranch. Expected non-empty string.`);
    }
    const normalized = baseBranchRaw.trim();
    if (!normalized) {
      throw new Error(`Target "${label}" has invalid releasePr.baseBranch. Expected non-empty string.`);
    }
    baseBranch = normalized;
  }

  return {
    ...(enabled !== undefined ? { enabled } : {}),
    ...(branchPrefix ? { branchPrefix } : {}),
    ...(baseBranch ? { baseBranch } : {})
  };
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
      validateGlobPattern(glob);
    } catch (error) {
      throw new Error(`Target "${label}" has invalid glob "${glob}": ${String(error)}`);
    }
  }

  const version = asRecord(target.version);
  const file = asOptionalString(version.file);
  const type = asOptionalString(version.type);
  const tagPrefix = asOptionalString(target.tagPrefix ?? target["tag-prefix"]);
  const releasePrRaw = target.releasePr ?? target["release-pr"];
  const parsedReleasePr = releasePrRaw !== undefined ? parseTargetReleasePrConfig(releasePrRaw, label) : undefined;
  const releasePr = parsedReleasePr && Object.keys(parsedReleasePr).length > 0 ? parsedReleasePr : undefined;
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
    ...(releasePr ? { releasePr } : {}),
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

function parseChangelogCategoryMap(value: unknown, source: string): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${source} must be a JSON object mapping commit type to section name.`);
  }

  const parsed = value as Record<string, unknown>;
  const categoryMap: Record<string, string> = {};
  for (const [rawType, rawSection] of Object.entries(parsed)) {
    const type = rawType.trim().toLowerCase();
    if (!type) {
      throw new Error(`${source} contains an empty commit type key.`);
    }
    if (typeof rawSection !== "string") {
      throw new Error(`${source}.${rawType} must be a string section name.`);
    }
    const section = rawSection.trim();
    if (!section) {
      throw new Error(`${source}.${rawType} must map to a non-empty section name.`);
    }
    categoryMap[type] = section;
  }

  return categoryMap;
}

function parseChangelogSectionOrder(value: unknown, source: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${source} must be a JSON array of section names.`);
  }

  const order: string[] = [];
  const seen = new Set<string>();
  for (const [index, item] of value.entries()) {
    if (typeof item !== "string") {
      throw new Error(`${source}[${index}] must be a string section name.`);
    }
    const section = item.trim();
    if (!section) {
      throw new Error(`${source}[${index}] must be a non-empty section name.`);
    }
    if (seen.has(section)) {
      throw new Error(`${source} contains duplicate section "${section}".`);
    }
    seen.add(section);
    order.push(section);
  }

  return order;
}

function resolveChangelogConfig(fileConfig: ConfigFile): ChangelogConfig {
  const rawCategoryMapInput = readInput("changelog-category-map");
  const rawSectionOrderInput = readInput("changelog-section-order");

  const categoryMapSource = rawCategoryMapInput ? 'input "changelog-category-map"' : "config-file.changelogCategoryMap";
  const sectionOrderSource = rawSectionOrderInput
    ? 'input "changelog-section-order"'
    : "config-file.changelogSectionOrder";

  const categoryMapValue = rawCategoryMapInput
    ? parseJsonFromSource(rawCategoryMapInput, categoryMapSource)
    : fileConfig.changelogCategoryMap;
  const sectionOrderValue = rawSectionOrderInput
    ? parseJsonFromSource(rawSectionOrderInput, sectionOrderSource)
    : fileConfig.changelogSectionOrder;

  const categoryMap = categoryMapValue
    ? {
        ...DEFAULT_CHANGELOG_CATEGORY_MAP,
        ...parseChangelogCategoryMap(categoryMapValue, categoryMapSource)
      }
    : { ...DEFAULT_CHANGELOG_CATEGORY_MAP };

  const sectionOrder = sectionOrderValue
    ? parseChangelogSectionOrder(sectionOrderValue, sectionOrderSource)
    : [...DEFAULT_CHANGELOG_SECTION_ORDER];

  return {
    categoryMap,
    sectionOrder
  };
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
  const changelog = resolveChangelogConfig(fileConfig);

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
    changelog,
    targets
  };
}
