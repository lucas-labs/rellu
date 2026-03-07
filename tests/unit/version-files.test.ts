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
    await fs.writeFile(file, JSON.stringify({ name: "x", version: "1.2.3" }, null, 2), "utf8");
    expect(await readManifestVersion(file, "node-package-json")).toBe("1.2.3");
    await writeManifestVersion(file, "node-package-json", "1.2.4");
    expect(await readManifestVersion(file, "node-package-json")).toBe("1.2.4");
  });
});

test("reads and writes Cargo.toml version", async () => {
  await withTempDir(async (dir) => {
    const file = path.join(dir, "Cargo.toml");
    await fs.writeFile(file, '[package]\nname = "x"\nversion = "0.4.1"\n', "utf8");
    expect(await readManifestVersion(file, "rust-cargo-toml")).toBe("0.4.1");
    await writeManifestVersion(file, "rust-cargo-toml", "0.5.0");
    const updated = await fs.readFile(file, "utf8");
    expect(updated).toMatch(/version = "0\.5\.0"/u);
  });
});

test("reads and writes pyproject.toml version for [project]", async () => {
  await withTempDir(async (dir) => {
    const file = path.join(dir, "pyproject.toml");
    await fs.writeFile(file, '[project]\nname = "x"\nversion = "2.1.0"\n', "utf8");
    expect(await readManifestVersion(file, "python-pyproject-toml")).toBe("2.1.0");
    await writeManifestVersion(file, "python-pyproject-toml", "2.2.0");
    const updated = await fs.readFile(file, "utf8");
    expect(updated).toMatch(/version = "2\.2\.0"/u);
  });
});
