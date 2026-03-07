import { expect, mock, test } from "bun:test";

test("loadConfig accepts latest-tag-with-prefix when all targets include tagPrefix", async () => {
  try {
    mock.module("../../src/toolkit/core-client.ts", () => ({
      coreClient: {
        getInput: (name: string) => {
          const inputs: Record<string, string> = {
            targets: JSON.stringify([
              {
                label: "app-1",
                tagPrefix: "app-1@v",
                paths: ["apps/app1/**/*"],
                version: {
                  file: "apps/app1/package.json",
                  type: "node-package-json"
                }
              }
            ]),
            "range-strategy": "latest-tag-with-prefix",
            "to-ref": "HEAD"
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

    const queryKey = "config-range-success";
    const { loadConfig } = await import(`../../src/config.ts?${queryKey}`);
    const config = loadConfig();
    expect(config.rangeStrategy).toBe("latest-tag-with-prefix");
    expect(config.targets[0]?.tagPrefix).toBe("app-1@v");
  } finally {
    mock.restore();
  }
});

test("loadConfig rejects latest-tag-with-prefix when target tagPrefix is missing", async () => {
  try {
    mock.module("../../src/toolkit/core-client.ts", () => ({
      coreClient: {
        getInput: (name: string) => {
          const inputs: Record<string, string> = {
            targets: JSON.stringify([
              {
                label: "app-1",
                paths: ["apps/app1/**/*"],
                version: {
                  file: "apps/app1/package.json",
                  type: "node-package-json"
                }
              }
            ]),
            "range-strategy": "latest-tag-with-prefix"
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

    const queryKey = "config-range-fail";
    const { loadConfig } = await import(`../../src/config.ts?${queryKey}`);
    expect(() => loadConfig()).toThrow(/requires tagPrefix on every target/);
  } finally {
    mock.restore();
  }
});
