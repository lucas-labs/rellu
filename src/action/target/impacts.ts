import pathUtils from '@/utils/paths';
import type { Target } from '../config/schema';

export type CommitLike = {
  sha: string;
  files: string[];
};

export interface TargetImpact<TCommit extends CommitLike> {
  label: string;
  changed: boolean;
  matchedFiles: string[];
  commitCount: number;
  relevantCommits: TCommit[];
}

function matchFilesForTarget(target: Target, files: string[]): string[] {
  return files.filter((file) => target.paths.some((glob) => pathUtils.glob.match(file, glob)));
}

/** analyzes the impacts of the given commits on the specified targets based on their paths */
export const analyzeTargetImpacts = <TCommit extends CommitLike>(
  targets: Target[],
  commits: TCommit[],
): TargetImpact<TCommit>[] => {
  return targets.map((target) => {
    const matchedFiles = new Set<string>();
    const relevantCommits: TCommit[] = [];

    for (const commit of commits) {
      const normalizedFiles = commit.files.map(pathUtils.asPosix);
      const matches = matchFilesForTarget(target, normalizedFiles);
      if (matches.length > 0) {
        relevantCommits.push(commit);
        for (const file of matches) {
          matchedFiles.add(file);
        }
      }
    }

    const matchedFilesList = pathUtils.dedupAndSort([...matchedFiles]);
    return {
      label: target.label,
      changed: matchedFilesList.length > 0,
      matchedFiles: matchedFilesList,
      commitCount: relevantCommits.length,
      relevantCommits,
    };
  });
};
