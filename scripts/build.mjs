import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");
const DIST = path.join(ROOT, "dist");

async function removeDist() {
  await fs.rm(DIST, { force: true, recursive: true });
  await fs.mkdir(DIST, { recursive: true });
}

function rewriteImports(code) {
  return code
    .replace(/(from\s+['"][^'"]+)\.ts(['"])/g, "$1.js$2")
    .replace(/(import\s*\(\s*['"][^'"]+)\.ts(['"]\s*\))/g, "$1.js$2");
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
    } else {
      files.push(full);
    }
  }
  return files;
}

async function build() {
  await removeDist();
  const files = await walk(SRC);
  for (const srcFile of files) {
    const rel = path.relative(SRC, srcFile);
    const isTs = rel.endsWith(".ts");
    const outRel = isTs ? rel.replace(/\.ts$/u, ".js") : rel;
    const outFile = path.join(DIST, outRel);
    await fs.mkdir(path.dirname(outFile), { recursive: true });
    const input = await fs.readFile(srcFile, "utf8");
    const output = isTs ? rewriteImports(input) : input;
    await fs.writeFile(outFile, output, "utf8");
  }
  // Add a package marker to keep dist ESM-compatible when copied as artifact.
  await fs.writeFile(path.join(DIST, "package.json"), '{ "type": "module" }\n', "utf8");
}

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
