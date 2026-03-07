import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { readManifestVersion, writeManifestVersion } from "../../dist/version-files.js";

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
    assert.equal(await readManifestVersion(file, "node-package-json"), "1.2.3");
    await writeManifestVersion(file, "node-package-json", "1.2.4");
    assert.equal(await readManifestVersion(file, "node-package-json"), "1.2.4");
  });
});

test("reads and writes Cargo.toml version", async () => {
  await withTempDir(async (dir) => {
    const file = path.join(dir, "Cargo.toml");
    await fs.writeFile(file, '[package]\nname = "x"\nversion = "0.4.1"\n', "utf8");
    assert.equal(await readManifestVersion(file, "rust-cargo-toml"), "0.4.1");
    await writeManifestVersion(file, "rust-cargo-toml", "0.5.0");
    const updated = await fs.readFile(file, "utf8");
    assert.match(updated, /version = "0\.5\.0"/u);
  });
});

test("reads and writes pyproject.toml version for [project]", async () => {
  await withTempDir(async (dir) => {
    const file = path.join(dir, "pyproject.toml");
    await fs.writeFile(file, '[project]\nname = "x"\nversion = "2.1.0"\n', "utf8");
    assert.equal(await readManifestVersion(file, "python-pyproject-toml"), "2.1.0");
    await writeManifestVersion(file, "python-pyproject-toml", "2.2.0");
    const updated = await fs.readFile(file, "utf8");
    assert.match(updated, /version = "2\.2\.0"/u);
  });
});
