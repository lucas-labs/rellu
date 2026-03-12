import pathUtils from '@/utils/paths';
import { z } from 'zod';

const manifestTypes = [
  'node-package-json',
  'rust-cargo-toml',
  'python-pyproject-toml',
] as const;
const bumpTypes = ['major', 'minor', 'patch', 'none'] as const;
const rangeStrategy = ['explicit', 'latest-tag', 'latest-tag-with-prefix'] as const;
const noBumpPolicies = ['skip', 'keep', 'patch'] as const;

export type ManifestType = (typeof manifestTypes)[number];
export type BumpLevel = (typeof bumpTypes)[number];
export type RangeStrategy = (typeof rangeStrategy)[number];
export type NoBumpPolicy = (typeof noBumpPolicies)[number];

export const defaultBumpRules: Record<string, BumpLevel> = {
  feat: 'minor',
  fix: 'patch',
  perf: 'patch',
  refactor: 'patch',
  docs: 'none',
  chore: 'none',
  test: 'none',
  ci: 'none',
  style: 'none',
};

export const ReleasePrConfigSchema = z.object({
  enabled: z
    .boolean()
    .optional()
    .describe(
      'Whether to create/update a live release pull request. If omitted, the target inherits the global create-release-pr setting.',
    ),
  branchPrefix: z
    .string()
    .optional()
    .describe('An optional prefix for the release PR branch name (e.g. "rellu/app1/")'),
  baseBranch: z
    .string()
    .optional()
    .describe(
      'The base branch to use for the release PR (defaults to the default branch of the repository)',
    ),
});

export const VersionSource = z.object({
  file: z.string().describe('Path to the file containing the version information'),
  type: z
    .enum(manifestTypes)
    .describe('The type of project manifest file to parse for version information'),
});

export const TargetSchema = z.object({
  label: z.string().describe('A human-readable label for the target'),
  paths: z
    .array(z.string())
    .refine((paths) => {
      try {
        paths.forEach((p) => pathUtils.glob.validate(p));
        return true;
      } catch {
        return false;
      }
    }, 'Invalid glob pattern in target paths')

    .describe('List of file paths or glob patterns to watch for changes'),
  version: VersionSource.describe(
    'Configuration for how to extract version information for this target',
  ),
  tagPrefix: z
    .string()
    .default('v')
    .describe(
      'An optional prefix to find tags that represent versions for this target (e.g. "foo@v" to match tags like "foo@v1.2.3")',
    ),
  releasePr: ReleasePrConfigSchema.describe(
    'Optional per-target overrides for release pull request behavior',
  ).optional(),
});
export type Target = z.infer<typeof TargetSchema>;

export const ChangelogConfigSchema = z
  .object({
    categoryMap: z
      .record(z.string(), z.string())
      .default({
        feat: 'Features',
        fix: 'Bug Fixes',
        docs: 'Documentation',
        perf: 'Performance',
        refactor: 'Refactoring',
        build: 'Other',
        ci: 'CI',
        chore: 'Chores',
        test: 'Tests',
        style: 'Other',
        other: 'Other',
      })
      .describe('Mapping of commit types to changelog categories (e.g. "feat" -> "Features")'),

    sectionOrder: z
      .array(z.string())
      .default([
        'Features',
        'Bug Fixes',
        'Documentation',
        'Performance',
        'Refactoring',
        'CI',
        'Chores',
        'Tests',
        'Other',
      ])
      .describe('The order in which to display sections in the generated changelog.'),
  })
  .describe('Configuration for how to generate the changelog content');

/** schema for the rellu.json file */
export const ConfigFileSchema = z
  .object({
    targets: z.array(TargetSchema),
    changelog: ChangelogConfigSchema.optional(),
    bumpRules: z.record(z.string(), z.enum(bumpTypes)).default(defaultBumpRules).optional(),
  })
  .describe('The configuration loaded from the rellu.json file in the repository');
export type ConfigFile = z.infer<typeof ConfigFileSchema>;

export const RelluActionInputsSchema = z
  .object({
    configPath: z.string().default('.github/rellu.json'),
    githubToken: z.string().optional(),
    fromRef: z.string().optional(),
    toRef: z.string().optional().default('HEAD'),
    rangeStrategy: z.enum(rangeStrategy).default('latest-tag'),
    strictConventionalCommits: z.boolean().default(false),
    noBumpPolicy: z.enum(noBumpPolicies).default('skip'),
    createReleasePr: z.boolean().default(false),
    releaseBranchPrefix: z.string().default('rellu/release'),
    baseBranch: z.string(),
    repo: z.string(),
    releaseCommitMessagePattern: z.string().default('release({target}): 🔖 v{version}'),
  })
  .describe('The inputs provided to the GitHub Action (e.g. via workflow YAML)');
export type RelluActionInputs = z.infer<typeof RelluActionInputsSchema>;

/** overall configuration schema for the action, including action inputs and the config file */
export const RelluConfigSchema = z.object({
  config: ConfigFileSchema,
  inputs: RelluActionInputsSchema,
});
export type RelluConfig = z.infer<typeof RelluConfigSchema>;
