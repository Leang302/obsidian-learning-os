import { AIProvider } from "../ai/provider";
import { SubjectKind } from "../types";

const ADAPTATION: Record<SubjectKind, string> = {
  language: "Include sentence patterns, example dialogues, and notes on common phrasing mistakes.",
  programming: "Include runnable code examples (fenced code blocks with language tags) and a debugging-style common-mistakes section.",
  math: "Include formulas (LaTeX, using $ and $$ delimiters) and fully worked examples.",
  other: "Use whatever explanation/example mix fits the subject.",
};

/** Generates one lesson's full Markdown body on first open (lazy, not
 * pre-generated for the whole roadmap) -- this is the token-cost-optimal
 * choice: we only ever pay for lesson content the learner actually opens. */
export async function generateLessonBody(
  provider: AIProvider,
  apiKey: string,
  model: string,
  args: { topicGoal: string; subjectKind: SubjectKind; moduleTitle: string; lessonTitle: string; objective: string; priorLessonTitles: string[] }
): Promise<string> {
  const system = [
    "You write one self-contained lesson in Markdown for a personal learning app.",
    "Follow this structure with headings: ## What it is, ## Why it matters, ## How it works, ## Example(s), ## Common mistakes, then end with one or two practice exercises.",
    ADAPTATION[args.subjectKind],
    "For each practice exercise, emit a fenced block with language 'exercise' containing YAML with fields id, type (short-answer or multiple-choice), prompt, and choices (only for multiple-choice). Example:\n```exercise\nid: ex1\ntype: short-answer\nprompt: |\n  Question text here.\n```",
    "Do not include a top-level title heading (the app shows the lesson title separately). Keep the lesson focused and appropriately sized for one sitting (roughly 400-900 words of prose, excluding code).",
  ].join("\n");
  const user = [
    `Overall learning goal: ${args.topicGoal}`,
    `Module: ${args.moduleTitle}`,
    `Lesson: ${args.lessonTitle}`,
    `Lesson objective: ${args.objective}`,
    args.priorLessonTitles.length ? `Already-covered prior lessons: ${args.priorLessonTitles.join(", ")}` : "This is the first lesson.",
  ].join("\n");
  const result = await provider.complete(
    { model, system, messages: [{ role: "user", content: user }], maxTokens: 2048, temperature: 0.5 },
    apiKey
  );
  return result.text.trim();
}
