import { VaultStore } from "./vaultStore";
import * as paths from "./paths";
import { stringifyMarkdown } from "../util/frontmatter";
import {
  TopicFrontmatter,
  RoadmapFrontmatter,
  LessonFrontmatter,
  ProgressFrontmatter,
  LessonStatus,
  ModuleEntry,
  ExerciseResult,
} from "../types";

interface ExerciseLog {
  exerciseId: string;
  lessonId: string;
  topicId: string;
  attempts: ExerciseResult[];
}

export interface TopicBundle {
  topic: TopicFrontmatter;
  overviewBody: string;
}

const nowIso = () => new Date().toISOString();

/** Typed read/write layer over the Markdown vault. This is the only module
 * the rest of the plugin should use to load or persist learning data --
 * everything here round-trips through VaultStore, so safe-write/conflict
 * rules apply uniformly. */
export class Repository {
  constructor(private store: VaultStore) {}

  // ---------- Topics ----------

  async listTopicIds(): Promise<string[]> {
    return this.store.listTopicFolders();
  }

  async getTopic(topicId: string): Promise<TopicBundle | null> {
    const parsed = await this.store.readParsed<TopicFrontmatter>(paths.overviewPath(topicId));
    if (!parsed || parsed.frontmatterInvalid || !parsed.frontmatter) return null;
    return { topic: parsed.frontmatter, overviewBody: parsed.body };
  }

  async createTopic(topic: TopicFrontmatter, overviewBody: string): Promise<void> {
    const content = stringifyMarkdown(topic as unknown as Record<string, unknown>, overviewBody);
    await this.store.create(paths.overviewPath(topic.id), content);
  }

  async touchTopic(topicId: string): Promise<void> {
    await this.store.updateParsed<TopicFrontmatter>(paths.overviewPath(topicId), (p) => ({
      frontmatter: { ...(p.frontmatter ?? {}), updatedAt: nowIso() },
      body: p.body,
    }));
  }

  // ---------- Roadmap ----------

  async getRoadmap(topicId: string): Promise<RoadmapFrontmatter | null> {
    const parsed = await this.store.readParsed<RoadmapFrontmatter>(paths.roadmapPath(topicId));
    if (!parsed || parsed.frontmatterInvalid || !parsed.frontmatter) return null;
    return parsed.frontmatter;
  }

  async createRoadmap(roadmap: RoadmapFrontmatter, body: string): Promise<void> {
    const content = stringifyMarkdown(roadmap as unknown as Record<string, unknown>, body);
    await this.store.create(paths.roadmapPath(roadmap.topicId), content);
  }

  async setModuleStatus(topicId: string, moduleId: string, status: LessonStatus): Promise<boolean> {
    const result = await this.store.updateParsed<RoadmapFrontmatter>(paths.roadmapPath(topicId), (p) => {
      const fm = (p.frontmatter ?? { topicId, modules: [] as ModuleEntry[] }) as RoadmapFrontmatter;
      const modules = fm.modules.map((m) => (m.id === moduleId ? { ...m, status } : m));
      return {
        frontmatter: { ...fm, modules, updatedAt: nowIso() } as unknown as Record<string, unknown>,
        body: p.body,
      };
    });
    return result.ok;
  }

  // ---------- Lessons ----------

  async listLessons(topicId: string): Promise<LessonFrontmatter[]> {
    const files = await this.store.listFiles(paths.lessonsFolder(topicId));
    const out: LessonFrontmatter[] = [];
    for (const f of files) {
      const parsed = await this.store.readParsed<LessonFrontmatter>(f.path);
      if (parsed && !parsed.frontmatterInvalid && parsed.frontmatter) out.push(parsed.frontmatter);
    }
    return out.sort((a, b) => a.order - b.order);
  }

  async getLesson(
    topicId: string,
    lessonId: string
  ): Promise<{ frontmatter: LessonFrontmatter; body: string } | null> {
    const parsed = await this.store.readParsed<LessonFrontmatter>(paths.lessonPath(topicId, lessonId));
    if (!parsed || parsed.frontmatterInvalid || !parsed.frontmatter) return null;
    return { frontmatter: parsed.frontmatter, body: parsed.body };
  }

  async createLesson(frontmatter: LessonFrontmatter, body: string): Promise<void> {
    const content = stringifyMarkdown(frontmatter as unknown as Record<string, unknown>, body);
    await this.store.create(paths.lessonPath(frontmatter.topicId, frontmatter.id), content);
  }

  /** Marks a lesson's status. `completed` and `mastered` are distinct and
   * must be set explicitly by the caller (finishing a lesson sets
   * `completed`; demonstrated mastery via assessment sets `mastered` --
   * never conflate the two here). */
  async setLessonStatus(topicId: string, lessonId: string, status: LessonStatus): Promise<boolean> {
    const result = await this.store.updateParsed<LessonFrontmatter>(paths.lessonPath(topicId, lessonId), (p) => ({
      frontmatter: { ...(p.frontmatter ?? {}), status, updatedAt: nowIso() } as unknown as Record<string, unknown>,
      body: p.body,
    }));
    return result.ok;
  }

  // ---------- Progress ----------

  async getProgress(topicId: string): Promise<ProgressFrontmatter | null> {
    const parsed = await this.store.readParsed<ProgressFrontmatter>(paths.progressPath(topicId));
    if (!parsed || parsed.frontmatterInvalid || !parsed.frontmatter) return null;
    return parsed.frontmatter;
  }

  async ensureProgress(topicId: string): Promise<ProgressFrontmatter> {
    const existing = await this.getProgress(topicId);
    if (existing) return existing;
    const fresh: ProgressFrontmatter = {
      topicId,
      updatedAt: nowIso(),
      lessonStatuses: {},
      masteredConcepts: [],
      weakConcepts: [],
    };
    const content = stringifyMarkdown(fresh as unknown as Record<string, unknown>, "\n## Notes\n");
    await this.store.create(paths.progressPath(topicId), content);
    return fresh;
  }

  /** Idempotent: setting the same status twice is a no-op in effect, and
   * concurrent calls always read-modify-write the latest frontmatter. */
  async recordLessonStatus(topicId: string, lessonId: string, status: LessonStatus): Promise<boolean> {
    await this.ensureProgress(topicId);
    const result = await this.store.updateParsed<ProgressFrontmatter>(paths.progressPath(topicId), (p) => {
      const fm = p.frontmatter as ProgressFrontmatter;
      const lessonStatuses = { ...fm.lessonStatuses, [lessonId]: status };
      return {
        frontmatter: { ...fm, lessonStatuses, updatedAt: nowIso() } as unknown as Record<string, unknown>,
        body: p.body,
      };
    });
    return result.ok;
  }

  async recordMastery(topicId: string, conceptId: string, mastered: boolean): Promise<boolean> {
    await this.ensureProgress(topicId);
    const result = await this.store.updateParsed<ProgressFrontmatter>(paths.progressPath(topicId), (p) => {
      const fm = p.frontmatter as ProgressFrontmatter;
      const mastered_ = new Set(fm.masteredConcepts);
      const weak = new Set(fm.weakConcepts);
      if (mastered) {
        mastered_.add(conceptId);
        weak.delete(conceptId);
      } else {
        weak.add(conceptId);
        mastered_.delete(conceptId);
      }
      return {
        frontmatter: {
          ...fm,
          masteredConcepts: [...mastered_],
          weakConcepts: [...weak],
          updatedAt: nowIso(),
        } as unknown as Record<string, unknown>,
        body: p.body,
      };
    });
    return result.ok;
  }

  // ---------- Exercise history ----------
  // Durable, cross-session record of every attempt at one exercise, stored
  // in Markdown under Exercises/. This is what mastery decisions are
  // actually computed from (reviewScheduler.shouldMarkMastered) -- without
  // it, "two consecutive correct answers" would only ever be checkable
  // within a single Obsidian session, which would quietly stop working
  // after a restart.

  async getExerciseHistory(topicId: string, lessonId: string, exerciseId: string): Promise<ExerciseResult[]> {
    const parsed = await this.store.readParsed<ExerciseLog>(paths.exercisePath(topicId, lessonId, exerciseId));
    if (!parsed || parsed.frontmatterInvalid || !parsed.frontmatter) return [];
    return parsed.frontmatter.attempts ?? [];
  }

  async appendExerciseAttempt(topicId: string, lessonId: string, result: ExerciseResult): Promise<ExerciseResult[]> {
    const path = paths.exercisePath(topicId, lessonId, result.exerciseId);
    if (!this.store.exists(path)) {
      const log: ExerciseLog = { exerciseId: result.exerciseId, lessonId, topicId, attempts: [result] };
      const content = stringifyMarkdown(log as unknown as Record<string, unknown>, "\n_Attempt log for this exercise. Edit cautiously -- mastery tracking reads this._\n");
      await this.store.create(path, content);
      return log.attempts;
    }
    let finalAttempts: ExerciseResult[] = [];
    await this.store.updateParsed<ExerciseLog>(path, (p) => {
      const fm = (p.frontmatter ?? { exerciseId: result.exerciseId, lessonId, topicId, attempts: [] }) as ExerciseLog;
      finalAttempts = [...fm.attempts, result];
      return { frontmatter: { ...fm, attempts: finalAttempts } as unknown as Record<string, unknown>, body: p.body };
    });
    return finalAttempts;
  }
}
