import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

export interface ParsedMarkdown<T = Record<string, unknown>> {
  frontmatter: T | null;
  /** True when frontmatter existed but failed to parse as YAML. The raw
   * text is preserved untouched so we never silently corrupt the file. */
  frontmatterInvalid: boolean;
  body: string;
}

const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/** Splits a Markdown file's content into frontmatter + body. Never throws:
 * invalid YAML is reported via `frontmatterInvalid` rather than crashing
 * the caller, per the edge-case requirement that bad frontmatter must be
 * handled gracefully, not fatally. */
export function parseMarkdown<T = Record<string, unknown>>(content: string): ParsedMarkdown<T> {
  const match = content.match(FM_RE);
  if (!match) {
    return { frontmatter: null, frontmatterInvalid: false, body: content };
  }
  const raw = match[1];
  const body = content.slice(match[0].length);
  try {
    const parsed = parseYaml(raw);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { frontmatter: null, frontmatterInvalid: true, body: content };
    }
    return { frontmatter: parsed as T, frontmatterInvalid: false, body };
  } catch {
    return { frontmatter: null, frontmatterInvalid: true, body: content };
  }
}

/** Serializes frontmatter + body back into a Markdown file's full text. */
export function stringifyMarkdown(frontmatter: Record<string, unknown>, body: string): string {
  const yaml = stringifyYaml(frontmatter, { lineWidth: 0 }).trimEnd();
  const trimmedBody = body.startsWith("\n") ? body : `\n${body}`;
  return `---\n${yaml}\n---\n${trimmedBody.replace(/^\n/, "\n")}`;
}

/** Merges a partial frontmatter update into existing content, preserving
 * the body untouched. Used for idempotent progress/status updates. */
export function updateFrontmatter(
  content: string,
  updates: Record<string, unknown>
): { content: string; hadInvalidFrontmatter: boolean } {
  const { frontmatter, frontmatterInvalid, body } = parseMarkdown(content);
  if (frontmatterInvalid) {
    // Don't guess at merging into malformed YAML -- surface it instead.
    return { content, hadInvalidFrontmatter: true };
  }
  const merged = { ...(frontmatter ?? {}), ...updates };
  return { content: stringifyMarkdown(merged, body), hadInvalidFrontmatter: false };
}
