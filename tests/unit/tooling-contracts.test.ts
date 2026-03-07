import { expect, test } from "bun:test";
import fs from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();

async function readJson(filePath) {
  const content = await fs.readFile(path.join(projectRoot, filePath), "utf8");
  return JSON.parse(content);
}

function parseJsonc(content: string) {
  const noBlockComments = content.replace(/\/\*[\s\S]*?\*\//g, "");
  const noLineComments = noBlockComments.replace(/^\s*\/\/.*$/gm, "");
  const noTrailingCommas = noLineComments.replace(/,\s*([}\]])/g, "$1");
  return JSON.parse(noTrailingCommas);
}

test("package scripts are Bun-based and build uses tsdown", async () => {
  const pkg = await readJson("package.json");
  expect(String(pkg.packageManager ?? "")).toMatch(/^bun@/u);
  expect(String(pkg.scripts.build ?? "")).toMatch(/\btsdown\b/u);
  expect(pkg.scripts.typecheck).toBe("tsc --project tsconfig.json --noEmit");
  expect(pkg.scripts.test).toBe("bun test");
});

test("tsconfig enforces strict no-implicit-any guards", async () => {
  const raw = await fs.readFile(path.join(projectRoot, "tsconfig.json"), "utf8");
  const tsconfig = parseJsonc(raw);
  const options = tsconfig.compilerOptions ?? {};
  expect(options.strict).toBe(true);
  expect(options.noImplicitAny).toBe(true);
  expect(options.noUncheckedIndexedAccess).toBe(true);
  expect(options.exactOptionalPropertyTypes).toBe(true);
});

test("action runtime remains Node-based", async () => {
  const actionYml = await fs.readFile(path.join(projectRoot, "action.yml"), "utf8");
  expect(actionYml).toMatch(/using:\s*"node\d+"/u);
});

test("husky pre-commit hook builds and stages dist before commit", async () => {
  const hook = await fs.readFile(path.join(projectRoot, ".husky", "pre-commit"), "utf8");
  expect(hook).toMatch(/bun run build/u);
  expect(hook).toMatch(/git add -A dist/u);
});
