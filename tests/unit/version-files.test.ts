import { expect, test } from "bun:test";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { readManifestVersion, writeManifestVersion } from "../../src/version-files.ts";

async function withTempDir(run) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "rellu-version-test-"));
  try {
    await run(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

test("reads and writes package.json version", async () => {
  await withTempDir(async (dir) => {
    const file = path.join(dir, "package.json");
    const context = { workspaceRoot: dir, targetLabel: "app-1" };
    await fs.writeFile(file, JSON.stringify({ name: "x", version: "1.2.3" }, null, 2), "utf8");
    expect(await readManifestVersion(file, "node-package-json", context)).toBe("1.2.3");
    await writeManifestVersion(file, "node-package-json", "1.2.4", context);
    expect(await readManifestVersion(file, "node-package-json", context)).toBe("1.2.4");
  });
});

test("reads and writes Cargo.toml version", async () => {
  await withTempDir(async (dir) => {
    const file = path.join(dir, "Cargo.toml");
    const context = { workspaceRoot: dir, targetLabel: "app-1" };
    await fs.writeFile(file, '[package]\nname = "x"\nversion = "0.4.1"\n', "utf8");
    expect(await readManifestVersion(file, "rust-cargo-toml", context)).toBe("0.4.1");
    await writeManifestVersion(file, "rust-cargo-toml", "0.5.0", context);
    const updated = await fs.readFile(file, "utf8");
    expect(updated).toMatch(/version = "0\.5\.0"/u);
  });
});

test("reads and writes pyproject.toml version for [project]", async () => {
  await withTempDir(async (dir) => {
    const file = path.join(dir, "pyproject.toml");
    const context = { workspaceRoot: dir, targetLabel: "app-1" };
    await fs.writeFile(file, '[project]\nname = "x"\nversion = "2.1.0"\n', "utf8");
    expect(await readManifestVersion(file, "python-pyproject-toml", context)).toBe("2.1.0");
    await writeManifestVersion(file, "python-pyproject-toml", "2.2.0", context);
    const updated = await fs.readFile(file, "utf8");
    expect(updated).toMatch(/version = "2\.2\.0"/u);
  });
});

test("rejects out-of-workspace manifest paths before filesystem mutation", async () => {
  await withTempDir(async (dir) => {
    const workspace = path.join(dir, "workspace");
    const outsideManifest = path.join(dir, "outside-package.json");
    await fs.mkdir(workspace, { recursive: true });
    await fs.writeFile(outsideManifest, JSON.stringify({ name: "outside", version: "1.0.0" }, null, 2), "utf8");

    const configuredPath = "../outside-package.json";
    await expect(
      readManifestVersion(configuredPath, "node-package-json", {
        workspaceRoot: workspace,
        targetLabel: "unsafe-target"
      })
    ).rejects.toThrow(/unsafe-target/u);

    await expect(
      writeManifestVersion(configuredPath, "node-package-json", "2.0.0", {
        workspaceRoot: workspace,
        targetLabel: "unsafe-target"
      })
    ).rejects.toThrow(/outside workspace root/u);

    const parsed = JSON.parse(await fs.readFile(outsideManifest, "utf8"));
    expect(parsed.version).toBe("1.0.0");
  });
});
