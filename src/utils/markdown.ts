const MARKDOWN_ESCAPABLE_PATTERN = /([\\`*_{}\[\]()#+.!|>@])/gu;

export function escapeMarkdownText(value: string): string {
  return value.replace(MARKDOWN_ESCAPABLE_PATTERN, "\\$1");
}
