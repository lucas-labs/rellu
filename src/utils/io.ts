import * as actionsIO from '@actions/io';
import path from 'node:path';

const ensureParentDirectory = async (filePath: string): Promise<void> => {
  const directory = path.dirname(path.resolve(filePath));
  await actionsIO.mkdirP(directory);
};

const io = {
  /** Recursively creates the parent directory for a given file path if it doesn't exist. */
  ensureParentDir: ensureParentDirectory,
};

export default io;
