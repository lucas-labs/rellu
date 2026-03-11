#!/usr/bin/env node
import { confirm, select } from '@inquirer/prompts';
import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import semver, { type ParsedSemver } from '../src/utils/semver';

// Release Script for rellu
// this script automates the release process of the rellu gh action by updating the version,
// creating git tags, and pushing changes to the remote repository.

/** execute a shell command and return the output */
function exec(command: string, silent = false): string {
  try {
    const result = execSync(command, {
      encoding: 'utf-8',
      stdio: silent ? 'pipe' : 'inherit',
    });
    return result?.toString().trim() || '';
  } catch (error) {
    if (!silent) {
      console.error(`Error executing command: ${command}`);
      throw error;
    }
    return '';
  }
}

/** execute a shell command that returns output */
function execOutput(command: string): string {
  return execSync(command, { encoding: 'utf-8' }).toString().trim();
}

/** get the current version from package.json */
function getCurrentVersion(): string {
  const packageJsonPath = resolve(process.cwd(), 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  return packageJson.version;
}

/** update the version in package.json */
function updatePackageVersion(newVersion: string): void {
  const packageJsonPath = resolve(process.cwd(), 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  packageJson.version = newVersion;
  writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf-8');
}

/** get the major version tag (e.g., "v1" from "1.2.3") */
function getMajorTag(version: string): string {
  const { major } = semver.parse(version);
  return `v${major}`;
}

/** get the full version tag (e.g., "v1.2.3" from "1.2.3") */
function getFullTag(version: string): string {
  return `v${version}`;
}

/** check if a tag exists locally or remotely */
function tagExists(tag: string): boolean {
  try {
    execOutput(`git rev-parse ${tag}`);
    return true;
  } catch {
    return false;
  }
}

/** get the latest tag (excluding the current release tag) */
function getLatestTag(): string | null {
  try {
    const tags = execOutput('git tag --sort=-version:refname');
    const tagList = tags.split('\n').filter((t) => t.trim());
    return tagList.length > 0 ? tagList[0] : null;
  } catch {
    return null;
  }
}

/** generate release notes from git commits since the last tag */
function generateReleaseNotes(fromTag: string | null, toRef: string): string {
  try {
    const range = fromTag ? `${fromTag}..${toRef}` : toRef;
    const commits = execOutput(`git log ${range} --pretty=format:"- %s (%h)" --no-merges`);

    if (!commits.trim()) {
      return 'No changes since last release.';
    }

    const lines = commits.split('\n').filter((line) => {
      // Filter out release commits
      return !line.match(/^-\s*release:/i);
    });

    if (lines.length === 0) {
      return 'No changes since last release.';
    }

    const grouped: Record<string, string[]> = {
      Features: [],
      Fixes: [],
      Chores: [],
      Other: [],
    };

    // Group commits by type (conventional commits style)
    for (const line of lines) {
      if (line.match(/^-\s*(feat|feature):/i)) {
        grouped.Features.push(line.replace(/^-\s*(feat|feature):\s*/i, '- '));
      } else if (line.match(/^-\s*fix:/i)) {
        grouped.Fixes.push(line.replace(/^-\s*fix:\s*/i, '- '));
      } else if (line.match(/^-\s*(chore|ci|docs|style|refactor|perf|test):/i)) {
        grouped.Chores.push(
          line.replace(/^-\s*(chore|ci|docs|style|refactor|perf|test):\s*/i, '- '),
        );
      } else {
        grouped.Other.push(line);
      }
    }

    // Build the release notes
    let notes = '';

    if (grouped.Features.length > 0) {
      notes += '## ✨ Features\n\n' + grouped.Features.join('\n') + '\n\n';
    }

    if (grouped.Fixes.length > 0) {
      notes += '## 🐛 Bug Fixes\n\n' + grouped.Fixes.join('\n') + '\n\n';
    }

    if (grouped.Chores.length > 0) {
      notes += '## 🧹 Chores\n\n' + grouped.Chores.join('\n') + '\n\n';
    }

    if (grouped.Other.length > 0) {
      notes += '## 📝 Other Changes\n\n' + grouped.Other.join('\n') + '\n\n';
    }

    return notes.trim();
  } catch {
    console.error('⚠️  Failed to generate release notes from git log');
    return 'Release notes could not be generated automatically.';
  }
}

/** main release function */
async function release() {
  console.log('\n🚀 Starting release process...\n');

  // step 0: fail fast if there are uncommitted changes
  const status = execOutput('git status --porcelain');
  if (status) {
    console.error(status);
    console.error('\n❌ You have uncommitted changes:');
    console.error('Please commit or stash your changes before running the release script.');
    process.exit(1);
  }

  // step 1: update tags from remote
  console.log('📥 Step 1: Fetching tags from remote...');
  const shouldFetch = await confirm({
    message: 'Fetch tags from remote?',
    default: true,
  });

  if (shouldFetch) {
    exec('git fetch --tags');
    console.log('✅ Tags fetched successfully\n');
  } else {
    console.log('⏭️  Skipped fetching tags\n');
  }

  // step 2: get previous tag for release notes (before creating new tags)
  const previousTag = getLatestTag();
  if (previousTag) {
    console.log(`📝 Previous release: ${previousTag}\n`);
  } else {
    console.log(`📝 No previous releases found\n`);
  }

  // step 3: get current version
  const currentVersion = getCurrentVersion();
  console.log(`📦 Current version: ${currentVersion}\n`);

  // clean the version (remove pre-release tags like -rc1)
  let parsedVersion: ParsedSemver | undefined = undefined;

  try {
    parsedVersion = semver.parse(currentVersion);
    if (parsedVersion.prerelease) {
      parsedVersion = semver.parse(semver.next(parsedVersion, 'release'));
    }
  } catch (error) {
    console.error(
      '❌ Error parsing current version, revise current package.json version:',
      error,
    );
    process.exit(1);
  }

  // step 4: ask for release type
  const releaseType: 'major' | 'minor' | 'patch' = await select({
    message: 'Select release type:',
    choices: [
      { name: 'Major (breaking changes)', value: 'major' },
      { name: 'Minor (new features)', value: 'minor' },
      { name: 'Patch (bug fixes)', value: 'patch' },
    ],
  });

  // Generate new version
  let newVersion = undefined;
  try {
    newVersion = semver.next(parsedVersion, releaseType);
  } catch (error) {
    console.error('❌ Error generating new version:', error);
    process.exit(1);
  }

  console.log(`\n📈 New version will be: ${newVersion}`);

  const majorTag = getMajorTag(newVersion);
  const fullTag = getFullTag(newVersion);
  const isMajorRelease = releaseType === 'major';

  console.log(`\n📌 Tags to create/update:`);
  console.log(`   - ${fullTag}`);
  console.log(`   - ${majorTag} (${isMajorRelease ? 'new' : 'updated'})`);

  // step 5: update package.json
  console.log('\n📝 Step 5: Updating package.json...');
  const shouldUpdate = await confirm({
    message: `Update package.json version to ${newVersion}?`,
    default: true,
  });

  if (!shouldUpdate) {
    console.log('❌ Release cancelled');
    process.exit(0);
  }

  updatePackageVersion(newVersion);
  console.log('✅ package.json updated\n');

  // step 6: commit package.json
  console.log('💾 Step 6: Committing changes...');
  const commitMessage = `release: 🔖 v${newVersion}`;

  const shouldCommit = await confirm({
    message: `Commit package.json with message: "${commitMessage}"?`,
    default: true,
  });

  if (!shouldCommit) {
    console.log('❌ Release cancelled');
    console.log('⚠️  Note: package.json has been updated but not committed');
    process.exit(0);
  }

  exec('git add package.json');
  exec(`git commit -m "${commitMessage}"`);
  console.log('✅ Changes committed\n');

  // step 7: create tags
  console.log('🏷️  Step 7: Creating tags...');
  const shouldTag = await confirm({
    message: `Create tag ${fullTag}${isMajorRelease ? ` and ${majorTag}` : ''}?`,
    default: true,
  });

  if (!shouldTag) {
    console.log('❌ Release cancelled');
    console.log('⚠️  Note: Changes have been committed but tags not created');
    process.exit(0);
  }

  // create the full version tag
  exec(`git tag -a ${fullTag} -m "Release ${newVersion}"`);
  console.log(`✅ Created tag: ${fullTag}`);

  // handle major tag
  if (isMajorRelease) {
    // for a new major release, create the major tag
    exec(`git tag -a ${majorTag} -m "Major version ${majorTag}"`);
    console.log(`✅ Created tag: ${majorTag}`);
  } else {
    // for minor/patch, update the major tag to point to the same commit
    if (tagExists(majorTag)) {
      // delete the old major tag locally and remotely
      exec(`git tag -d ${majorTag}`, true);
      exec(`git push origin :refs/tags/${majorTag}`, true);
      console.log(`🔄 Deleted old ${majorTag} tag`);
    } else {
      console.log(`📣 Major tag ${majorTag} does not exist, creating new one`);
    }

    // create new major tag pointing to current commit
    exec(`git tag -a ${majorTag} -m "Major version ${majorTag}"`);
    console.log(`✅ Created/updated tag: ${majorTag}`);
  }

  // step 8: push tags
  console.log('\n📤 Step 8: Pushing tags...');
  const shouldPush = await confirm({
    message: 'Push commit and tags to remote?',
    default: true,
  });

  if (!shouldPush) {
    console.log('⚠️  Release completed locally but not pushed to remote');
    console.log(`   To push manually, run:`);
    console.log(`   git push && git push origin ${fullTag} ${majorTag} --force`);
    process.exit(0);
  }

  // push the commit
  exec('git push');
  console.log('✅ Commit pushed');

  // push the tags (use --force for major tag in case it was updated)
  exec(`git push origin ${fullTag}`);
  console.log(`✅ Pushed tag: ${fullTag}`);

  exec(`git push origin ${majorTag} --force`);
  console.log(`✅ Pushed tag: ${majorTag}`);

  // step 9: create gh release
  console.log('\n📝 Step 9: Creating Github release...');
  const shouldCreateRelease = await confirm({
    message: 'Create a release in Github?',
    default: true,
  });

  const releaseTitle = `v${newVersion}`;

  if (shouldCreateRelease) {
    // generate release notes from git commits
    console.log(
      `\n📝 Generating release notes from commits${previousTag ? ` since ${previousTag}` : ''}...`,
    );
    const autoNotes = generateReleaseNotes(previousTag, 'HEAD');

    // create a temporary directory and file for the release notes
    const tempDir = mkdtempSync(join(tmpdir(), 'rellu-release-'));
    const notesFile = join(tempDir, 'RELEASE_NOTES.md');
    writeFileSync(notesFile, autoNotes, 'utf-8');

    console.log('✅ Release notes generated\n');

    try {
      // create the release using the gh cli
      exec(
        `gh release create ${fullTag} --title "${releaseTitle}" --notes-file "${notesFile}"`,
      );
      console.log('✅ Github release created successfully');
    } catch {
      console.error('⚠️  Failed to create Github release');
      console.error('   Make sure:');
      console.error('   - The gh CLI is installed and configured');
      console.error('   - You are logged in to your Github instance (run: gh auth login)');
      console.error('   - You have permission to create releases in this repo');
      console.error('\n   To create the release manually, run:');

      // backup the notes to .
      const backupNotesFilePath = resolve(
        process.cwd(),
        `RELEASE_NOTES_${fullTag.replace(/\./g, '_')}.md`,
      );
      writeFileSync(backupNotesFilePath, autoNotes, 'utf-8');

      console.error(
        `   gh release create ${fullTag} --title "${releaseTitle}" --notes-file "${notesFile}"`,
      );
      console.error(`\n   Note: The release notes file is at: ${backupNotesFilePath}`);
    } finally {
      // clean up the temporary directory
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch {
        console.warn(`⚠️  Failed to clean up temporary files at ${tempDir}`);
      }
    }
  } else {
    console.log('⏭️  Skipped creating Github release');
    console.log(`   To create manually later, run:`);
    console.log(`   gh release create ${fullTag} --title "${releaseTitle}"`);
    console.log(
      `   (You can add --note "Your release notes" or --note-file path/to/notes.md)`,
    );
  }

  console.log('\n🎉 Release completed successfully!');
  console.log(`\n📦 Released version: ${newVersion}`);
  console.log(`🏷️  Tags: ${fullTag}, ${majorTag}`);
}

// run the release script
release().catch((error) => {
  console.error('\n❌ Release failed:', error.message);
  process.exit(1);
});
