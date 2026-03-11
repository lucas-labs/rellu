import type { ManifestType } from '@/action/config/schema';
import io from '@/utils/io';
import pathUtils, { type WorkspacePathOptions } from '@/utils/paths';
import fs from 'node:fs/promises';
import packageJsonHandler from './handlers/package-json';
import { cargoToml, pyprojectToml } from './handlers/toml';
import type { ManifestVersioningHandler } from './handlers/types';

const manifestTargetSuffix = (targetLabel?: string): string => {
  return targetLabel ? ` for target "${targetLabel}"` : '';
};

const readText = async (
  filePath: string,
  context: WorkspacePathOptions = {},
): Promise<string> => {
  const absolute = pathUtils.manifests.resolveInWorkspace(filePath, context);
  try {
    return await fs.readFile(absolute, 'utf8');
  } catch (error) {
    throw new Error(
      `Failed reading manifest "${filePath}"${manifestTargetSuffix(context.targetLabel)}: ${String(error)}`,
    );
  }
};

const writeText = async (
  filePath: string,
  content: string,
  context: WorkspacePathOptions = {},
): Promise<void> => {
  const absolute = pathUtils.manifests.resolveInWorkspace(filePath, context);
  try {
    await io.ensureParentDir(absolute);
    await fs.writeFile(absolute, content, 'utf8');
  } catch (error) {
    throw new Error(
      `Failed writing manifest "${filePath}"${manifestTargetSuffix(context.targetLabel)}: ${String(error)}`,
    );
  }
};

const getHandler = (type: ManifestType): ManifestVersioningHandler => {
  switch (type) {
    case 'node-package-json':
      return packageJsonHandler;
    case 'rust-cargo-toml':
      return cargoToml;
    case 'python-pyproject-toml':
      return pyprojectToml;
    default:
      throw new Error(`Unsupported manifest type "${type}"`);
  }
};

const read = async (
  filePath: string,
  type: ManifestType,
  context: WorkspacePathOptions = {},
) => {
  const text = await readText(filePath, context);
  const handler = getHandler(type);
  return handler.read(text);
};

const write = async (
  filePath: string,
  type: ManifestType,
  nextVersion: string,
  context: WorkspacePathOptions = {},
) => {
  const text = await readText(filePath, context);
  const handler = getHandler(type);
  const updated = await handler.update(text, nextVersion);
  await writeText(filePath, updated, context);
};

const manifests = { read, write };
export default manifests;
