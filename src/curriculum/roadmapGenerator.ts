import { AIProvider } from "../ai/provider";
import { buildRoadmapGenerationPrompt } from "./prompts";
import { safeParseJson } from "../util/safeJson";
import { SubjectKind } from "../types";

export interface GeneratedLesson {
  id: string;
  title: string;
  objective: string;
  estMinutes: number;
}

export interface GeneratedModule {
  id: string;
  title: string;
  estMinutes: number;
  prerequisites: string[];
  lessons: GeneratedLesson[];
}

export interface GeneratedCurriculum {
  modules: GeneratedModule[];
}

export class CurriculumGenerationError extends Error {}

/** AI-driven curriculum generation. Validates the model's JSON shape
 * strictly rather than trusting it -- an AI that returns something
 * malformed must surface as an explicit error, never as a silently
 * half-built roadmap. */
export async function generateCurriculum(
  provider: AIProvider,
  apiKey: string,
  model: string,
  args: { goal: string; subjectKind: SubjectKind; priorLevel: string; priorProgressSummary?: string }
): Promise<GeneratedCurriculum> {
  const { system, user } = buildRoadmapGenerationPrompt(args);
  const result = await provider.complete(
    { model, system, messages: [{ role: "user", content: user }], maxTokens: 4096, temperature: 0.4 },
    apiKey
  );
  const parsed = safeParseJson<GeneratedCurriculum>(result.text);
  if (!parsed || !Array.isArray(parsed.modules) || parsed.modules.length === 0) {
    throw new CurriculumGenerationError(
      "The AI's curriculum response could not be parsed into a valid roadmap. Try again, or adjust the goal description."
    );
  }
  const seenIds = new Set<string>();
  for (const mod of parsed.modules) {
    if (!mod.id || !mod.title || !Array.isArray(mod.lessons) || mod.lessons.length === 0) {
      throw new CurriculumGenerationError("The AI's curriculum response was missing required fields.");
    }
    if (seenIds.has(mod.id)) throw new CurriculumGenerationError(`Duplicate module id in generated curriculum: ${mod.id}`);
    seenIds.add(mod.id);
    for (const lesson of mod.lessons) {
      if (!lesson.id || !lesson.title || !lesson.objective) {
        throw new CurriculumGenerationError("The AI's curriculum response had a lesson missing required fields.");
      }
      if (seenIds.has(lesson.id)) throw new CurriculumGenerationError(`Duplicate lesson id in generated curriculum: ${lesson.id}`);
      seenIds.add(lesson.id);
      mod.prerequisites = mod.prerequisites ?? [];
      lesson.estMinutes = lesson.estMinutes ?? 20;
    }
    mod.estMinutes = mod.estMinutes ?? mod.lessons.reduce((s, l) => s + l.estMinutes, 0);
  }
  return parsed;
}
