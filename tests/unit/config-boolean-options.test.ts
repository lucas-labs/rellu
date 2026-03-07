import { expect, mock, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const BASE_TARGET = {
  label: "app-1",
  paths: ["apps/app1/**/*"],
  version: {
    file: "apps/app1/package.json",
    type: "node-package-json"
  }
} as const;

type Inputs = Record<string, string>;

async function writeConfigFile(config: Record<string, unknown>): Promise<{ configPath: string; cleanup: () => Promise<void> }> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "rellu-config-bool-"));
  const configPath = path.join(tempDir, "config.json");
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf8");

  return {
    configPath,
    cleanup: async () => {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  };
}

async function loadConfigWithFile(
  configOverrides: Record<string, unknown>,
  inputOverrides: Inputs,
  queryKey: string
) {
  const { configPath, cleanup } = await writeConfigFile({
    targets: [BASE_TARGET],
    ...configOverrides
  });

  try {
    mock.module("../../src/toolkit/core-client.ts", () => ({
      coreClient: {
        getInput: (name: string) => {
          const inputs: Inputs = {
            "config-file": configPath,
            ...inputOverrides
          };
          return inputs[name] ?? "";
        },
        setOutput: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
        setFailed: () => {}
      }
    }));

    const { loadConfig } = await import(`../../src/config.ts?${queryKey}`);
    return loadConfig();
  } finally {
    mock.restore();
    await cleanup();
  }
}

test("loadConfig honors native JSON booleans for strictConventionalCommits", async () => {
  const strictTrue = await loadConfigWithFile(
    { strictConventionalCommits: true },
    {},
    "config-bool-strict-native-true"
  );
  expect(strictTrue.strictConventionalCommits).toBe(true);

  const strictFalse = await loadConfigWithFile(
    { strictConventionalCommits: false },
    {},
    "config-bool-strict-native-false"
  );
  expect(strictFalse.strictConventionalCommits).toBe(false);
});

test("loadConfig honors native JSON booleans for createReleasePrs", async () => {
  const releaseTrue = await loadConfigWithFile(
    { createReleasePrs: true },
    {},
    "config-bool-release-native-true"
  );
  expect(releaseTrue.createReleasePrs).toBe(true);

  const releaseFalse = await loadConfigWithFile(
    { createReleasePrs: false },
    {},
    "config-bool-release-native-false"
  );
  expect(releaseFalse.createReleasePrs).toBe(false);
});

test("loadConfig accepts string booleans from config-file for strict and release flags", async () => {
  const config = await loadConfigWithFile(
    {
      strictConventionalCommits: "true",
      createReleasePrs: "false"
    },
    {},
    "config-bool-string-values"
  );

  expect(config.strictConventionalCommits).toBe(true);
  expect(config.createReleasePrs).toBe(false);
});

test("loadConfig preserves input precedence over config-file booleans", async () => {
  const config = await loadConfigWithFile(
    {
      strictConventionalCommits: true,
      createReleasePrs: false
    },
    {
      "strict-conventional-commits": "false",
      "create-release-prs": "true"
    },
    "config-bool-input-precedence"
  );

  expect(config.strictConventionalCommits).toBe(false);
  expect(config.createReleasePrs).toBe(true);
});

test("loadConfig fails fast on invalid config-file boolean types and values", async () => {
  await expect(
    loadConfigWithFile(
      { strictConventionalCommits: 1 },
      {},
      "config-bool-invalid-type"
    )
  ).rejects.toThrow(/config-file\.strictConventionalCommits/);

  await expect(
    loadConfigWithFile(
      { createReleasePrs: "yes" },
      {},
      "config-bool-invalid-string"
    )
  ).rejects.toThrow(/config-file\.createReleasePrs/);
});
