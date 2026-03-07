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

function mockCoreInputs(inputs: Inputs): void {
  mock.module("../../src/toolkit/core-client.ts", () => ({
    coreClient: {
      getInput: (name: string) => inputs[name] ?? "",
      setOutput: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
      setFailed: () => {}
    }
  }));
}

async function loadConfigWithInputs(inputs: Inputs, queryKey: string) {
  mockCoreInputs({
    targets: JSON.stringify([BASE_TARGET]),
    ...inputs
  });
  const { loadConfig } = await import(`../../src/config.ts?${queryKey}`);
  return loadConfig();
}

async function writeConfigFile(config: Record<string, unknown>): Promise<{ configPath: string; cleanup: () => Promise<void> }> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "rellu-config-changelog-"));
  const configPath = path.join(tempDir, "config.json");
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf8");

  return {
    configPath,
    cleanup: async () => {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  };
}

test("loadConfig provides default changelog mapping and section order", async () => {
  try {
    const config = await loadConfigWithInputs({}, "config-changelog-defaults");
    expect(config.changelog.categoryMap.feat).toBe("Features");
    expect(config.changelog.categoryMap.fix).toBe("Bug Fixes");
    expect(config.changelog.categoryMap.other).toBe("Other");
    expect(config.changelog.sectionOrder).toEqual([
      "Features",
      "Bug Fixes",
      "Documentation",
      "Performance",
      "Refactoring",
      "Build / CI",
      "Chores",
      "Tests",
      "Other"
    ]);
  } finally {
    mock.restore();
  }
});

test("loadConfig accepts custom changelog mapping and section order from inputs", async () => {
  try {
    const config = await loadConfigWithInputs(
      {
        "changelog-category-map": JSON.stringify({
          feat: "Enhancements",
          fix: "Maintenance",
          docs: "Guides"
        }),
        "changelog-section-order": JSON.stringify(["Maintenance", "Enhancements", "Guides", "Other"])
      },
      "config-changelog-custom-inputs"
    );

    expect(config.changelog.categoryMap.feat).toBe("Enhancements");
    expect(config.changelog.categoryMap.fix).toBe("Maintenance");
    expect(config.changelog.categoryMap.docs).toBe("Guides");
    expect(config.changelog.categoryMap.other).toBe("Other");
    expect(config.changelog.sectionOrder).toEqual(["Maintenance", "Enhancements", "Guides", "Other"]);
  } finally {
    mock.restore();
  }
});

test("loadConfig fails fast on invalid changelog mapping/order inputs", async () => {
  try {
    await expect(
      loadConfigWithInputs(
        {
          "changelog-category-map": "{invalid-json"
        },
        "config-changelog-invalid-json"
      )
    ).rejects.toThrow(/Invalid JSON for input "changelog-category-map"/);
  } finally {
    mock.restore();
  }

  try {
    await expect(
      loadConfigWithInputs(
        {
          "changelog-category-map": JSON.stringify({ feat: "" })
        },
        "config-changelog-empty-section"
      )
    ).rejects.toThrow(/input "changelog-category-map".feat must map to a non-empty section name/);
  } finally {
    mock.restore();
  }

  try {
    await expect(
      loadConfigWithInputs(
        {
          "changelog-section-order": JSON.stringify(["Bug Fixes", "Bug Fixes"])
        },
        "config-changelog-duplicate-order"
      )
    ).rejects.toThrow(/input "changelog-section-order" contains duplicate section "Bug Fixes"/);
  } finally {
    mock.restore();
  }
});

test("loadConfig validates changelog mapping/order when provided from config-file", async () => {
  const { configPath, cleanup } = await writeConfigFile({
    targets: [BASE_TARGET],
    changelogCategoryMap: {
      feat: "Enhancements"
    },
    changelogSectionOrder: "Maintenance"
  });

  try {
    await expect(
      loadConfigWithInputs(
        {
          "config-file": configPath
        },
        "config-changelog-invalid-config-file-order"
      )
    ).rejects.toThrow(/config-file.changelogSectionOrder must be a JSON array of section names/);
  } finally {
    mock.restore();
    await cleanup();
  }
});
