export interface ManifestVersioningHandler {
  read: (filePath: string) => Promise<string>;
  update: (text: string, nextVersion: string) => Promise<string>;
}
