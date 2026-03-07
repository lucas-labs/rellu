import { expect, mock, test } from "bun:test";

const BASE_VERSION = {
  file: "apps/app1/package.json",
  type: "node-package-json"
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

async function loadConfigFromTargets(targets: unknown, queryKey: string) {
  mockCoreInputs({
    targets: JSON.stringify(targets)
  });

  const { loadConfig } = await import(`../../src/config.ts?${queryKey}`);
  return loadConfig();
}

test("loadConfig parses optional per-target releasePr settings", async () => {
  try {
    const config = await loadConfigFromTargets(
      [
        {
          label: "app-1",
          paths: ["apps/app1/**/*"],
          version: BASE_VERSION,
          releasePr: {
            enabled: false,
            branchPrefix: "custom/release",
            baseBranch: "release-main"
          }
        }
      ],
      "config-target-release-pr-valid"
    );

    expect(config.targets[0]?.releasePr).toEqual({
      enabled: false,
      branchPrefix: "custom/release",
      baseBranch: "release-main"
    });
  } finally {
    mock.restore();
  }
});

test("loadConfig supports kebab-case aliases inside target releasePr settings", async () => {
  try {
    const config = await loadConfigFromTargets(
      [
        {
          label: "app-1",
          paths: ["apps/app1/**/*"],
          version: BASE_VERSION,
          releasePr: {
            enabled: "true",
            "branch-prefix": "custom/release",
            "base-branch": "release-main"
          }
        }
      ],
      "config-target-release-pr-aliases"
    );

    expect(config.targets[0]?.releasePr).toEqual({
      enabled: true,
      branchPrefix: "custom/release",
      baseBranch: "release-main"
    });
  } finally {
    mock.restore();
  }
});

test("loadConfig fails fast on invalid per-target releasePr settings", async () => {
  try {
    await expect(
      loadConfigFromTargets(
        [
          {
            label: "app-1",
            paths: ["apps/app1/**/*"],
            version: BASE_VERSION,
            releasePr: "disabled"
          }
        ],
        "config-target-release-pr-invalid-shape"
      )
    ).rejects.toThrow(/Target "app-1" has invalid releasePr value/);
  } finally {
    mock.restore();
  }

  try {
    await expect(
      loadConfigFromTargets(
        [
          {
            label: "app-1",
            paths: ["apps/app1/**/*"],
            version: BASE_VERSION,
            releasePr: {
              enabled: 1
            }
          }
        ],
        "config-target-release-pr-invalid-enabled"
      )
    ).rejects.toThrow(/Target "app-1" has invalid releasePr.enabled/);
  } finally {
    mock.restore();
  }

  try {
    await expect(
      loadConfigFromTargets(
        [
          {
            label: "app-1",
            paths: ["apps/app1/**/*"],
            version: BASE_VERSION,
            releasePr: {
              branchPrefix: ""
            }
          }
        ],
        "config-target-release-pr-invalid-branch-prefix"
      )
    ).rejects.toThrow(/Target "app-1" has invalid releasePr.branchPrefix/);
  } finally {
    mock.restore();
  }

  try {
    await expect(
      loadConfigFromTargets(
        [
          {
            label: "app-1",
            paths: ["apps/app1/**/*"],
            version: BASE_VERSION,
            releasePr: {
              baseBranch: false
            }
          }
        ],
        "config-target-release-pr-invalid-base-branch"
      )
    ).rejects.toThrow(/Target "app-1" has invalid releasePr.baseBranch/);
  } finally {
    mock.restore();
  }
});
