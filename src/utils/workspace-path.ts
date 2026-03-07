import path from "node:path";

interface WorkspacePathOptions {
  workspaceRoot?: string;
  targetLabel?: string;
}

function resolveWorkspaceRoot(workspaceRoot?: string): string {
  const rawRoot = workspaceRoot?.trim() || process.env.GITHUB_WORKSPACE?.trim() || process.cwd();
  return path.resolve(rawRoot);
}

function manifestPathValidationError(configuredPath: string, targetLabel: string | undefined, reason: string): Error {
  const targetPrefix = targetLabel ? ` for target "${targetLabel}"` : "";
  return new Error(`Manifest path validation failed${targetPrefix} for configured path "${configuredPath}": ${reason}`);
}

export function resolveManifestPathInWorkspace(filePath: string, options: WorkspacePathOptions = {}): string {
  const configuredPath = String(filePath ?? "");
  if (!configuredPath.trim()) {
    throw manifestPathValidationError(configuredPath, options.targetLabel, "path is empty");
  }

  const workspaceRoot = resolveWorkspaceRoot(options.workspaceRoot);
  const resolvedPath = path.resolve(workspaceRoot, configuredPath);
  const relative = path.relative(workspaceRoot, resolvedPath);
  const isOutsideWorkspace = relative.startsWith("..") || path.isAbsolute(relative);

  if (isOutsideWorkspace) {
    throw manifestPathValidationError(
      configuredPath,
      options.targetLabel,
      `resolved path "${resolvedPath}" is outside workspace root "${workspaceRoot}"`
    );
  }

  return resolvedPath;
}
