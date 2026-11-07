// Core domain types for the Learning OS. These mirror the YAML frontmatter
// schemas written into Markdown files under LearningOS/Topics/<Topic>/...
// Markdown is the source of truth; these types are just typed views over it.

export type LessonStatus =
  | "not-started"
  | "in-progress"
  | "completed"
  | "review-needed"
  | "mastered";

export type SubjectKind = "language" | "programming" | "math" | "other";

export interface TopicFrontmatter {
  id: string; // stable slug, e.g. "korean"
  title: string;
  subjectKind: SubjectKind;
  goal: string; // the learner's stated goal for this topic
  level: string; // current self/AI-assessed level, free text (e.g. "beginner")
  createdAt: string; // ISO date
  updatedAt: string; // ISO date
  status: "active" | "paused" | "archived";
}

export interface ModuleEntry {
  id: string; // stable slug within the topic
  title: string;
  status: LessonStatus;
  estMinutes?: number;
  prerequisites?: string[]; // module ids
}

export interface RoadmapFrontmatter {
  topicId: string;
  updatedAt: string;
  modules: ModuleEntry[];
}

export interface LessonEntry {
  id: string; // stable slug, e.g. "002-sentence-patterns"
  moduleId: string;
  title: string;
  order: number;
  status: LessonStatus;
  prerequisites?: string[]; // lesson ids
  estMinutes?: number;
}

export interface LessonFrontmatter {
  id: string;
  topicId: string;
  moduleId: string;
  title: string;
  order: number;
  status: LessonStatus;
  objective: string; // the single learning objective this lesson targets
  prerequisites?: string[];
  estMinutes?: number;
  updatedAt: string;
}

export interface ExerciseResult {
  exerciseId: string;
  lessonId: string;
  attempt: number;
  correct: boolean;
  timestamp: string; // ISO
  misconception?: string; // short tag describing the error, if any
}

export interface AssessmentResult {
  assessmentId: string;
  topicId: string;
  moduleId?: string;
  score: number; // 0..1
  timestamp: string;
  notes?: string;
}

export type ReviewReason = "exercise-error" | "assessment-low-score" | "elapsed-time" | "manual";

export interface ReviewItem {
  conceptId: string; // free-text concept/lesson slug this review targets
  lessonId: string;
  reason: ReviewReason;
  dueAt: string; // ISO date
  createdAt: string;
  resolved?: boolean;
}

export interface ProgressFrontmatter {
  topicId: string;
  updatedAt: string;
  lessonStatuses: Record<string, LessonStatus>; // lessonId -> status
  masteredConcepts: string[];
  weakConcepts: string[];
}

/** A compact, durable rolling summary of tutor interaction for one lesson.
 * This is what gets written to Markdown -- never the raw chat transcript. */
export interface LessonChatSummary {
  lessonId: string;
  updatedAt: string;
  summary: string; // 1-3 short paragraphs
  unresolvedQuestions: string[];
  savedExplanations: { title: string; text: string }[];
}

export interface RecommendedNext {
  topicId: string;
  lessonId: string;
  reason: string;
}
