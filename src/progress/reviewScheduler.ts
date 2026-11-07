import { ExerciseResult, AssessmentResult, ReviewItem, ReviewReason } from "../types";

const DAY_MS = 24 * 60 * 60 * 1000;
const LOW_SCORE_THRESHOLD = 0.7;
const MASTERY_SCORE_THRESHOLD = 0.85;
const ELAPSED_REVIEW_DAYS = 14;

/** Pure, deterministic review-scheduling logic -- no AI call needed to
 * decide "is this due for review". Intentionally simple (lightweight
 * spaced-repetition-ish, not a full SM-2 implementation): due date is
 * nudged out by error/score severity and decays based on elapsed time
 * since last touch. */
export function computeReviewItems(opts: {
  lessonId: string;
  conceptId: string;
  exerciseResults: ExerciseResult[];
  assessmentResults: AssessmentResult[];
  now?: number;
}): ReviewItem[] {
  const now = opts.now ?? Date.now();
  const items: ReviewItem[] = [];

  const wrongExercises = opts.exerciseResults.filter((r) => !r.correct);
  if (wrongExercises.length) {
    const latest = wrongExercises.reduce((a, b) => (a.timestamp > b.timestamp ? a : b));
    items.push({
      conceptId: opts.conceptId,
      lessonId: opts.lessonId,
      reason: "exercise-error",
      dueAt: new Date(now + 1 * DAY_MS).toISOString(),
      createdAt: new Date(now).toISOString(),
    });
    void latest;
  }

  const lowAssessments = opts.assessmentResults.filter((r) => r.score < LOW_SCORE_THRESHOLD);
  if (lowAssessments.length) {
    items.push({
      conceptId: opts.conceptId,
      lessonId: opts.lessonId,
      reason: "assessment-low-score",
      dueAt: new Date(now + 2 * DAY_MS).toISOString(),
      createdAt: new Date(now).toISOString(),
    });
  }

  return items;
}

/** Flags already-mastered concepts whose last touch was too long ago,
 * so "mastered" doesn't quietly mean "mastered once, forgotten since". */
export function elapsedTimeReviews(opts: {
  masteredConcepts: { conceptId: string; lessonId: string; lastTouchedAt: string }[];
  now?: number;
}): ReviewItem[] {
  const now = opts.now ?? Date.now();
  return opts.masteredConcepts
    .filter((m) => now - new Date(m.lastTouchedAt).getTime() > ELAPSED_REVIEW_DAYS * DAY_MS)
    .map((m) => ({
      conceptId: m.conceptId,
      lessonId: m.lessonId,
      reason: "elapsed-time" as ReviewReason,
      dueAt: new Date(now).toISOString(),
      createdAt: new Date(now).toISOString(),
    }));
}

/** Whether a concept should be promoted to "mastered". Deliberately
 * conservative: opening/reading a lesson never qualifies. Requires either
 * a high-scoring assessment, or at least two consecutive correct exercise
 * attempts with no intervening miss, on *this* concept. */
export function shouldMarkMastered(opts: {
  exerciseResults: ExerciseResult[]; // for this concept/lesson, chronological or not
  assessmentResults: AssessmentResult[];
}): boolean {
  if (opts.assessmentResults.some((r) => r.score >= MASTERY_SCORE_THRESHOLD)) return true;

  const sorted = [...opts.exerciseResults].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  let consecutiveCorrect = 0;
  for (const r of sorted) {
    consecutiveCorrect = r.correct ? consecutiveCorrect + 1 : 0;
    if (consecutiveCorrect >= 2) return true;
  }
  return false;
}

/** Due-now filter for surfacing in Dashboard/Roadmap. */
export function dueReviews(items: ReviewItem[], now: number = Date.now()): ReviewItem[] {
  return items.filter((i) => !i.resolved && new Date(i.dueAt).getTime() <= now);
}
