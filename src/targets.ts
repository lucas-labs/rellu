import type { CommitLike, TargetConfig, TargetImpact } from "./types.js";
import { isGlobMatch, toPosixPath, uniqueSortedPosix } from "./utils/paths.js";

function matchFilesForTarget(target: TargetConfig, files: string[]): string[] {
  return files.filter((file) => target.paths.some((glob) => isGlobMatch(file, glob)));
}

export function analyzeTargetImpacts<TCommit extends CommitLike>(
  targets: TargetConfig[],
  commits: TCommit[]
): TargetImpact<TCommit>[] {
  return targets.map((target) => {
    const matchedFiles = new Set<string>();
    const relevantCommits: TCommit[] = [];

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
