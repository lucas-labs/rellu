import type { ManifestVersioningHandler } from './types.js';

function updateTomlSectionVersion(text: string, section: string, nextVersion: string): string {
  const escapedSection = section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const sectionPattern = new RegExp(
    `(\\[${escapedSection}\\][\\s\\S]*?^\\s*version\\s*=\\s*")([^"]+)(")`,
    'm',
  );
  if (!sectionPattern.test(text)) {
    return text;
  }
  return text.replace(sectionPattern, `$1${nextVersion}$3`);
}

function extractTomlSection(text: string, section: string): string {
  const escapedSection = section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const sectionRegex = new RegExp(`\\[${escapedSection}\\]([\\s\\S]*?)(?=\\n\\[[^\\]]+\\]|$)`);
  const match = text.match(sectionRegex);
  return match?.[1] ?? '';
}

const makeReader = (section: string) => {
  return async (text: string): Promise<string> => {
    const extractedSection = extractTomlSection(text, section);
    const match = extractedSection.match(/^\s*version\s*=\s*"([^"]+)"\s*$/mu);
    if (!match) {
      throw new Error('Cargo.toml missing [package] version = "x.y.z"');
    }
    const version = match[1];
    if (!version) {
      throw new Error('Cargo.toml missing [package] version = "x.y.z"');
    }
    return version;
  };
};

const makeUpdater = (section: string) => {
  return async (text: string, nextVersion: string): Promise<string> => {
    const updated = updateTomlSectionVersion(text, section, nextVersion);
    if (updated === text) {
      throw new Error(`Target manifest missing [${section}] version = "x.y.z" field`);
    }
    return updated;
  };
};

const getTomlHandler = (section: string): ManifestVersioningHandler => {
  return {
    read: makeReader(section),
    update: makeUpdater(section),
  };
};

const cargoToml: ManifestVersioningHandler = getTomlHandler('package');
const pyprojectToml: ManifestVersioningHandler = getTomlHandler('project');

export { cargoToml, pyprojectToml };
