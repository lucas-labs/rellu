import { isGlobMatch, toPosixPath, uniqueSortedPosix } from "./utils/paths.ts";

/**
 * @typedef {{
 *   label: string;
 *   paths: string[];
 *   version: { file: string; type: string };
 * }} TargetConfig
 *
 * @typedef {{
 *   sha: string;
 *   files: string[];
 * }} CommitLike
 */

/**
 * @param {TargetConfig} target
 * @param {string[]} files
 * @returns {string[]}
 */
function matchFilesForTarget(target, files) {
  return files.filter((file) => target.paths.some((glob) => isGlobMatch(file, glob)));
}

/**
 * @param {TargetConfig[]} targets
 * @param {CommitLike[]} commits
 */
export function analyzeTargetImpacts(targets, commits) {
  return targets.map((target) => {
    const matchedFiles = new Set();
    const relevantCommits = [];

    for (const commit of commits) {
      const normalizedFiles = commit.files.map(toPosixPath);
      const matches = matchFilesForTarget(target, normalizedFiles);
      if (matches.length > 0) {
        relevantCommits.push(commit);
        for (const file of matches) {
          matchedFiles.add(file);
        }
      }
    }

    const matchedFilesList = uniqueSortedPosix([...matchedFiles]);
    return {
      label: target.label,
      changed: matchedFilesList.length > 0,
      matchedFiles: matchedFilesList,
      commitCount: relevantCommits.length,
      relevantCommits
    };
  });
}
