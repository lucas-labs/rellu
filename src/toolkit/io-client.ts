import * as io from "@actions/io";
import path from "node:path";

export async function ensureParentDirectory(filePath: string): Promise<void> {
  const directory = path.dirname(path.resolve(filePath));
  await io.mkdirP(directory);
}
