import fs from "node:fs/promises";
import path from "node:path";

/**
 * @typedef {"node-package-json" | "rust-cargo-toml" | "python-pyproject-toml"} ManifestType
 */

/**
 * @param {string} filePath
 * @returns {Promise<string>}
 */
async function readText(filePath) {
  try {
    return await fs.readFile(path.resolve(filePath), "utf8");
  } catch (error) {
    throw new Error(`Failed reading manifest "${filePath}": ${String(error)}`);
  }
}

/**
 * @param {string} filePath
 * @param {string} content
 */
async function writeText(filePath, content) {
  await fs.writeFile(path.resolve(filePath), content, "utf8");
}

/**
 * @param {string} text
 * @param {string} section
 * @returns {string}
 */
function extractTomlSection(text, section) {
  const escapedSection = section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const sectionRegex = new RegExp(`\\[${escapedSection}\\]([\\s\\S]*?)(?=\\n\\[[^\\]]+\\]|$)`);
  const match = text.match(sectionRegex);
  return match?.[1] ?? "";
}

/**
 * @param {string} text
 * @returns {string}
 */
function readCargoVersion(text) {
  const section = extractTomlSection(text, "package");
  const match = section.match(/^\s*version\s*=\s*"([^"]+)"\s*$/mu);
  if (!match) {
    throw new Error('Cargo.toml missing [package] version = "x.y.z"');
  }
  return match[1];
}

/**
 * @param {string} text
 * @returns {string}
 */
function readPyprojectVersion(text) {
  const project = extractTomlSection(text, "project");
  const poetry = extractTomlSection(text, "tool.poetry");

  const projectMatch = project.match(/^\s*version\s*=\s*"([^"]+)"\s*$/mu);
  if (projectMatch) {
    return projectMatch[1];
  }
  const poetryMatch = poetry.match(/^\s*version\s*=\s*"([^"]+)"\s*$/mu);
  if (poetryMatch) {
    return poetryMatch[1];
  }
  throw new Error(
    "pyproject.toml missing supported version layout. Expected [project] version or [tool.poetry] version."
  );
}

/**
 * @param {string} text
 * @param {string} section
 * @param {string} nextVersion
 * @returns {string}
 */
function updateTomlSectionVersion(text, section, nextVersion) {
  const escapedSection = section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const sectionPattern = new RegExp(`(\\[${escapedSection}\\][\\s\\S]*?^\\s*version\\s*=\\s*")([^"]+)(")`, "m");
  if (!sectionPattern.test(text)) {
    return text;
  }
  return text.replace(sectionPattern, `$1${nextVersion}$3`);
}

/**
 * @param {string} filePath
 * @param {ManifestType} type
 * @returns {Promise<string>}
 */
export async function readManifestVersion(filePath, type) {
  const text = await readText(filePath);

  if (type === "node-package-json") {
    const parsed = JSON.parse(text);
    const version = String(parsed?.version ?? "").trim();
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

  throw new Error(`Unsupported manifest type "${type}"`);
}

/**
 * @param {string} filePath
 * @param {ManifestType} type
 * @param {string} nextVersion
 * @returns {Promise<void>}
 */
export async function writeManifestVersion(filePath, type, nextVersion) {
  const text = await readText(filePath);
  let updated = text;

  if (type === "node-package-json") {
    const parsed = JSON.parse(text);
    parsed.version = nextVersion;
    updated = `${JSON.stringify(parsed, null, 2)}\n`;
    await writeText(filePath, updated);
    return;
  }

  if (type === "rust-cargo-toml") {
    updated = updateTomlSectionVersion(text, "package", nextVersion);
    if (updated === text) {
      throw new Error(`Target manifest "${filePath}" missing [package] version field`);
    }
    await writeText(filePath, updated);
    return;
  }

  if (type === "python-pyproject-toml") {
    const fromProject = updateTomlSectionVersion(text, "project", nextVersion);
    if (fromProject !== text) {
      await writeText(filePath, fromProject);
      return;
    }
    const fromPoetry = updateTomlSectionVersion(text, "tool.poetry", nextVersion);
    if (fromPoetry === text) {
      throw new Error(
        `Target manifest "${filePath}" missing [project] version or [tool.poetry] version field`
      );
    }
    await writeText(filePath, fromPoetry);
    return;
  }

  throw new Error(`Unsupported manifest type "${type}"`);
}
