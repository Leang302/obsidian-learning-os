import { Repository } from "../data/repository";
import { VaultStore } from "../data/vaultStore";
import * as paths from "../data/paths";
import { slugify, dedupeSlug } from "../data/paths";
import { stringifyMarkdown } from "../util/frontmatter";
import { AIProvider } from "../ai/provider";
import { generateCurriculum } from "./roadmapGenerator";
import { generateLessonBody } from "./lessonGenerator";
import { computeReviewItems, shouldMarkMastered } from "../progress/reviewScheduler";
import {
  TopicFrontmatter,
  RoadmapFrontmatter,
  LessonFrontmatter,
  LessonStatus,
  ModuleEntry,
  ExerciseResult,
  AssessmentResult,
  SubjectKind,
  RecommendedNext,
} from "../types";

const nowIso = () => new Date().toISOString();

/** The learning engine: everything that decides *what* the learner should
 * see or do next, independent of UI and independent of chat. Views call
 * this; this calls Repository (persistence) and AIProvider (generation)
 * but never touches raw Obsidian APIs directly. */
export class LearningService {
  constructor(private repo: Repository, private store: VaultStore, private provider: AIProvider, private apiKey: string, private model: string) {}

  async startTopic(args: { goal: string; subjectKind: SubjectKind; priorLevel: string }): Promise<TopicFrontmatter> {
    const existingIds = new Set(await this.repo.listTopicIds());
    const id = dedupeSlug(slugify(args.goal), existingIds);

    const curriculum = await generateCurriculum(this.provider, this.apiKey, this.model, {
      goal: args.goal,
      subjectKind: args.subjectKind,
      priorLevel: args.priorLevel,
    });

    const topic: TopicFrontmatter = {
      id,
      title: args.goal,
      subjectKind: args.subjectKind,
      goal: args.goal,
      level: args.priorLevel,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      status: "active",
    };
    await this.repo.createTopic(topic, `\n> Goal: ${args.goal}\n\n> Level at start: ${args.priorLevel}\n`);

    const modules: ModuleEntry[] = curriculum.modules.map((m, i) => ({
      id: m.id,
      title: m.title,
      status: i === 0 ? ("not-started" as LessonStatus) : ("not-started" as LessonStatus),
      estMinutes: m.estMinutes,
      prerequisites: m.prerequisites,
    }));
    const roadmap: RoadmapFrontmatter = { topicId: id, updatedAt: nowIso(), modules };
    const roadmapBody = [
      "\n## Curriculum",
      ...curriculum.modules.map(
        (m) => `\n### ${m.title}\n${m.lessons.map((l) => `- [ ] ${l.title} — ${l.objective}`).join("\n")}`
      ),
    ].join("\n");
    await this.repo.createRoadmap(roadmap, roadmapBody);

    let order = 1;
    for (const mod of curriculum.modules) {
      for (const lesson of mod.lessons) {
        const fm: LessonFrontmatter = {
          id: lesson.id,
          topicId: id,
          moduleId: mod.id,
          title: lesson.title,
          order: order++,
          status: "not-started",
          objective: lesson.objective,
          prerequisites: [],
          estMinutes: lesson.estMinutes,
          updatedAt: nowIso(),
        };
        // Body is generated lazily on first open (see openLesson) to avoid
        // spending an AI call per lesson before the learner ever reads it.
        await this.repo.createLesson(fm, `\n_Content for this lesson hasn't been generated yet. Open it to generate it._\n`);
      }
    }

    await this.repo.ensureProgress(id);
    return topic;
  }

  /** Opens a lesson, lazily generating its body via AI on first access.
   * Marks the module's status "in-progress" if it was "not-started" --
   * opening is allowed to move not-started -> in-progress, but never to
   * "completed" or "mastered" (those require explicit learner action). */
  async openLesson(topicId: string, lessonId: string): Promise<{ frontmatter: LessonFrontmatter; body: string }> {
    const existing = await this.repo.getLesson(topicId, lessonId);
    if (!existing) throw new Error(`Lesson not found: ${topicId}/${lessonId}`);

    const needsGeneration = /hasn't been generated yet/.test(existing.body);
    let body = existing.body;
    if (needsGeneration) {
      const topic = await this.repo.getTopic(topicId);
      const lessons = await this.repo.listLessons(topicId);
      const priorTitles = lessons.filter((l) => l.order < existing.frontmatter.order).map((l) => l.title);
      const roadmap = await this.repo.getRoadmap(topicId);
      const moduleTitle = roadmap?.modules.find((m) => m.id === existing.frontmatter.moduleId)?.title ?? existing.frontmatter.moduleId;
      body = await generateLessonBody(this.provider, this.apiKey, this.model, {
        topicGoal: topic?.topic.goal ?? topicId,
        subjectKind: topic?.topic.subjectKind ?? "other",
        moduleTitle,
        lessonTitle: existing.frontmatter.title,
        objective: existing.frontmatter.objective,
        priorLessonTitles: priorTitles,
      });
      const content = stringifyMarkdown(existing.frontmatter as unknown as Record<string, unknown>, `\n${body}\n`);
      await this.store.write(paths.lessonPath(topicId, lessonId), content, { force: true });
    }

    if (existing.frontmatter.status === "not-started") {
      await this.repo.setLessonStatus(topicId, lessonId, "in-progress");
      await this.repo.recordLessonStatus(topicId, lessonId, "in-progress");
      existing.frontmatter.status = "in-progress";
    }

    return { frontmatter: existing.frontmatter, body };
  }

  /** Marks a lesson "completed" -- distinct from "mastered". Idempotent:
   * calling this repeatedly on the same lesson just re-confirms the same
   * state rather than compounding anything. */
  async completeLesson(topicId: string, lessonId: string): Promise<void> {
    await this.repo.setLessonStatus(topicId, lessonId, "completed");
    await this.repo.recordLessonStatus(topicId, lessonId, "completed");
  }

  /** Persists the new attempt to the exercise's durable Markdown log first,
   * then decides mastery/review from the *full* cross-session history --
   * never from just the single most recent attempt. `assessmentResults`
   * may be passed in when a formal assessment (not a single exercise) was
   * just graded; otherwise pass an empty array. */
  async recordExerciseOutcome(
    topicId: string,
    lessonId: string,
    conceptId: string,
    result: ExerciseResult,
    assessmentResults: AssessmentResult[] = []
  ): Promise<{ mastered: boolean; reviewScheduled: boolean }> {
    const exerciseResults = await this.repo.appendExerciseAttempt(topicId, lessonId, result);
    const mastered = shouldMarkMastered({ exerciseResults, assessmentResults });
    await this.repo.recordMastery(topicId, conceptId, mastered);
    if (mastered) {
      await this.repo.setLessonStatus(topicId, lessonId, "mastered");
      await this.repo.recordLessonStatus(topicId, lessonId, "mastered");
    }
    const reviews = computeReviewItems({
      lessonId,
      conceptId,
      exerciseResults,
      assessmentResults,
    });
    if (!mastered && reviews.length) {
      await this.repo.setLessonStatus(topicId, lessonId, "review-needed");
      await this.repo.recordLessonStatus(topicId, lessonId, "review-needed");
    }
    return { mastered, reviewScheduled: !mastered && reviews.length > 0 };
  }

  /** Recommends the next lesson: first lesson of the first module whose
   * prerequisites are satisfied and that isn't already completed/mastered,
   * preferring "review-needed" lessons first. Pure local logic -- no AI
   * call needed to answer "what's next" once progress data is loaded. */
  async recommendNext(topicId: string): Promise<RecommendedNext | null> {
    const lessons = await this.repo.listLessons(topicId);
    if (!lessons.length) return null;

    const reviewNeeded = lessons.find((l) => l.status === "review-needed");
    if (reviewNeeded) {
      return { topicId, lessonId: reviewNeeded.id, reason: "This lesson was flagged for review after a recent mistake or low score." };
    }

    const inProgress = lessons.find((l) => l.status === "in-progress");
    if (inProgress) {
      return { topicId, lessonId: inProgress.id, reason: "Continuing the lesson already in progress." };
    }

    const doneOrMastered = new Set(lessons.filter((l) => l.status === "completed" || l.status === "mastered").map((l) => l.id));
    const next = lessons
      .filter((l) => l.status === "not-started")
      .find((l) => (l.prerequisites ?? []).every((p) => doneOrMastered.has(p)));

    if (next) return { topicId, lessonId: next.id, reason: "Next lesson in sequence with prerequisites satisfied." };
    return null;
  }
}
