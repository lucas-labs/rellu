import fs from "node:fs/promises";
import { ensureParentDirectory } from "./toolkit/io-client.js";
import type { ManifestType } from "./types.js";
import { resolveManifestPathInWorkspace } from "./utils/workspace-path.js";

interface JsonRecord {
  [key: string]: unknown;
}

interface ManifestOperationContext {
  workspaceRoot?: string;
  targetLabel?: string;
}

function manifestTargetSuffix(targetLabel?: string): string {
  return targetLabel ? ` for target "${targetLabel}"` : "";
}

async function readText(filePath: string, context: ManifestOperationContext): Promise<string> {
  const absolute = resolveManifestPathInWorkspace(filePath, context);
  try {
    return await fs.readFile(absolute, "utf8");
  } catch (error) {
    throw new Error(`Failed reading manifest "${filePath}"${manifestTargetSuffix(context.targetLabel)}: ${String(error)}`);
  }
}

async function writeText(filePath: string, content: string, context: ManifestOperationContext): Promise<void> {
  const absolute = resolveManifestPathInWorkspace(filePath, context);
  try {
    await ensureParentDirectory(absolute);
    await fs.writeFile(absolute, content, "utf8");
  } catch (error) {
    throw new Error(`Failed writing manifest "${filePath}"${manifestTargetSuffix(context.targetLabel)}: ${String(error)}`);
  }
}

function parseJsonRecord(text: string, filePath: string): JsonRecord {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid JSON in "${filePath}": ${String(error)}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Expected JSON object in "${filePath}"`);
  }
  return parsed as JsonRecord;
}

function extractTomlSection(text: string, section: string): string {
  const escapedSection = section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const sectionRegex = new RegExp(`\\[${escapedSection}\\]([\\s\\S]*?)(?=\\n\\[[^\\]]+\\]|$)`);
  const match = text.match(sectionRegex);
  return match?.[1] ?? "";
}

function readCargoVersion(text: string): string {
  const section = extractTomlSection(text, "package");
  const match = section.match(/^\s*version\s*=\s*"([^"]+)"\s*$/mu);
  if (!match) {
    throw new Error('Cargo.toml missing [package] version = "x.y.z"');
  }
  const version = match[1];
  if (!version) {
    throw new Error('Cargo.toml missing [package] version = "x.y.z"');
  }
  return version;
}

function readPyprojectVersion(text: string): string {
  const project = extractTomlSection(text, "project");
  const poetry = extractTomlSection(text, "tool.poetry");

  const projectMatch = project.match(/^\s*version\s*=\s*"([^"]+)"\s*$/mu);
  if (projectMatch) {
    const version = projectMatch[1];
    if (version) {
      return version;
    }
  }
  const poetryMatch = poetry.match(/^\s*version\s*=\s*"([^"]+)"\s*$/mu);
  if (poetryMatch) {
    const version = poetryMatch[1];
    if (version) {
      return version;
    }
  }

  throw new Error(
    "pyproject.toml missing supported version layout. Expected [project] version or [tool.poetry] version."
  );
}

function updateTomlSectionVersion(text: string, section: string, nextVersion: string): string {
  const escapedSection = section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const sectionPattern = new RegExp(`(\\[${escapedSection}\\][\\s\\S]*?^\\s*version\\s*=\\s*")([^"]+)(")`, "m");
  if (!sectionPattern.test(text)) {
    return text;
  }
  return text.replace(sectionPattern, `$1${nextVersion}$3`);
}

export async function readManifestVersion(
  filePath: string,
  type: ManifestType,
  context: ManifestOperationContext = {}
): Promise<string> {
  const text = await readText(filePath, context);

  if (type === "node-package-json") {
    const parsed = parseJsonRecord(text, filePath);
    const version = String(parsed.version ?? "").trim();
    if (!version) {
      throw new Error(`Target manifest "${filePath}" missing package.json version field`);
    }
    return version;
  }

  if (type === "rust-cargo-toml") {
    return readCargoVersion(text);
  }

  if (type === "python-pyproject-toml") {
    return readPyprojectVersion(text);
  }

  const exhaustiveCheck: never = type;
  throw new Error(`Unsupported manifest type "${String(exhaustiveCheck)}"`);
}

export async function writeManifestVersion(
  filePath: string,
  type: ManifestType,
  nextVersion: string,
  context: ManifestOperationContext = {}
): Promise<void> {
  const text = await readText(filePath, context);
  let updated = text;

  if (type === "node-package-json") {
    const parsed = parseJsonRecord(text, filePath);
    parsed.version = nextVersion;
    updated = `${JSON.stringify(parsed, null, 2)}\n`;
    await writeText(filePath, updated, context);
    return;
  }

  if (type === "rust-cargo-toml") {
    updated = updateTomlSectionVersion(text, "package", nextVersion);
    if (updated === text) {
      throw new Error(`Target manifest "${filePath}" missing [package] version field`);
    }
    await writeText(filePath, updated, context);
    return;
  }

  if (type === "python-pyproject-toml") {
    const fromProject = updateTomlSectionVersion(text, "project", nextVersion);
    if (fromProject !== text) {
      await writeText(filePath, fromProject, context);
      return;
    }
    const fromPoetry = updateTomlSectionVersion(text, "tool.poetry", nextVersion);
    if (fromPoetry === text) {
      throw new Error(`Target manifest "${filePath}" missing [project] version or [tool.poetry] version field`);
    }
    await writeText(filePath, fromPoetry, context);
    return;
  }

  const exhaustiveCheck: never = type;
  throw new Error(`Unsupported manifest type "${String(exhaustiveCheck)}"`);
}
