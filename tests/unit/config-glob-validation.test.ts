import { expect, mock, test } from "bun:test";

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

test("loadConfig accepts standard advanced glob syntax in target paths", async () => {
  try {
    mockCoreInputs({
      targets: JSON.stringify([
        {
          label: "app-1",
          paths: ["apps/{web,admin}/src/**", "packages/lib-[ab]/**"],
          version: {
            file: "apps/app1/package.json",
            type: "node-package-json"
          }
        }
      ])
    });

    const queryKey = "config-glob-valid";
    const { loadConfig } = await import(`../../src/config.ts?${queryKey}`);
    const config = loadConfig();
    expect(config.targets[0]?.paths).toEqual(["apps/{web,admin}/src/**", "packages/lib-[ab]/**"]);
  } finally {
    mock.restore();
  }
});

test("loadConfig fails fast on invalid target path glob with target label and pattern", async () => {
  try {
    mockCoreInputs({
      targets: JSON.stringify([
        {
          label: "app-1",
          paths: ["apps/[web/src/**"],
          version: {
            file: "apps/app1/package.json",
            type: "node-package-json"
          }
        }
      ])
    });

    const queryKey = "config-glob-invalid";
    const { loadConfig } = await import(`../../src/config.ts?${queryKey}`);
    expect(() => loadConfig()).toThrow(/Target "app-1" has invalid glob "apps\/\[web\/src\/\*\*"/);
  } finally {
    mock.restore();
  }
});
