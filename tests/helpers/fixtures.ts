import fs from "node:fs/promises";
import path from "node:path";

const fixturesRoot = path.resolve("tests/fixtures");

export async function readFixtureJson<T = unknown>(relativePath: string): Promise<T> {
  const fullPath = path.join(fixturesRoot, relativePath);
  const content = await fs.readFile(fullPath, "utf8");
  return JSON.parse(content) as T;
}
