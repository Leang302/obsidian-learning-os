import { parse as parseYaml } from "yaml";

export interface ExerciseSpec {
  id: string;
  prompt: string;
  type: "short-answer" | "multiple-choice";
  choices?: string[];
}

export type LessonSegment = { kind: "markdown"; text: string } | { kind: "exercise"; spec: ExerciseSpec };

const EXERCISE_FENCE_RE = /```exercise\r?\n([\s\S]*?)```/g;

/** Lesson bodies are plain Markdown with one extra, plain-text-readable
 * convention: a fenced ```exercise``` block containing a small YAML
 * exercise spec. Viewed outside the plugin it just renders as a code
 * block (still useful, per "Markdown must remain useful even if I
 * uninstall the plugin"); viewed inside the plugin, each block becomes an
 * interactive answer widget. */
export function parseLessonBody(body: string): LessonSegment[] {
  const segments: LessonSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  EXERCISE_FENCE_RE.lastIndex = 0;
  while ((match = EXERCISE_FENCE_RE.exec(body))) {
    const before = body.slice(lastIndex, match.index);
    if (before.trim()) segments.push({ kind: "markdown", text: before });
    try {
      const raw = parseYaml(match[1]);
      if (raw && typeof raw === "object" && raw.id && raw.prompt) {
        segments.push({
          kind: "exercise",
          spec: {
            id: String(raw.id),
            prompt: String(raw.prompt),
            type: raw.type === "multiple-choice" ? "multiple-choice" : "short-answer",
            choices: Array.isArray(raw.choices) ? raw.choices.map(String) : undefined,
          },
        });
      } else {
        // Malformed spec: keep it visible as plain markdown rather than
        // silently dropping content the lesson author wrote.
        segments.push({ kind: "markdown", text: match[0] });
      }
    } catch {
      segments.push({ kind: "markdown", text: match[0] });
    }
    lastIndex = match.index + match[0].length;
  }
  const rest = body.slice(lastIndex);
  if (rest.trim()) segments.push({ kind: "markdown", text: rest });
  if (segments.length === 0) segments.push({ kind: "markdown", text: body });
  return segments;
}

export function exerciseBlock(spec: ExerciseSpec): string {
  const lines = [`id: ${spec.id}`, `type: ${spec.type}`, `prompt: |`, ...spec.prompt.split("\n").map((l) => `  ${l}`)];
  if (spec.choices) {
    lines.push("choices:");
    for (const c of spec.choices) lines.push(`  - ${c}`);
  }
  return "```exercise\n" + lines.join("\n") + "\n```";
}
