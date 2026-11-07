import { describe, it, expect } from "vitest";
import { computeReviewItems, shouldMarkMastered, dueReviews, elapsedTimeReviews } from "../src/progress/reviewScheduler";
import { ExerciseResult, AssessmentResult } from "../src/types";

const ex = (correct: boolean, timestamp: string): ExerciseResult => ({
  exerciseId: "e1",
  lessonId: "l1",
  attempt: 1,
  correct,
  timestamp,
});

describe("shouldMarkMastered", () => {
  it("is false for a single correct answer -- opening/answering once is not mastery", () => {
    expect(shouldMarkMastered({ exerciseResults: [ex(true, "2024-01-01T00:00:00Z")], assessmentResults: [] })).toBe(false);
  });

  it("is true after two consecutive correct answers", () => {
    const results = [ex(true, "2024-01-01T00:00:00Z"), ex(true, "2024-01-02T00:00:00Z")];
    expect(shouldMarkMastered({ exerciseResults: results, assessmentResults: [] })).toBe(true);
  });

  it("resets the consecutive-correct streak after a miss", () => {
    const results = [
      ex(true, "2024-01-01T00:00:00Z"),
      ex(false, "2024-01-02T00:00:00Z"),
      ex(true, "2024-01-03T00:00:00Z"),
    ];
    expect(shouldMarkMastered({ exerciseResults: results, assessmentResults: [] })).toBe(false);
  });

  it("is true for a high-scoring assessment regardless of exercise history", () => {
    const assessment: AssessmentResult = { assessmentId: "a1", topicId: "t1", score: 0.9, timestamp: "2024-01-01T00:00:00Z" };
    expect(shouldMarkMastered({ exerciseResults: [], assessmentResults: [assessment] })).toBe(true);
  });

  it("is false for a borderline-but-not-high-enough assessment score", () => {
    const assessment: AssessmentResult = { assessmentId: "a1", topicId: "t1", score: 0.8, timestamp: "2024-01-01T00:00:00Z" };
    expect(shouldMarkMastered({ exerciseResults: [], assessmentResults: [assessment] })).toBe(false);
  });
});

describe("computeReviewItems", () => {
  it("schedules an exercise-error review after a wrong answer", () => {
    const items = computeReviewItems({
      lessonId: "l1",
      conceptId: "c1",
      exerciseResults: [ex(false, "2024-01-01T00:00:00Z")],
      assessmentResults: [],
      now: Date.parse("2024-01-01T00:00:00Z"),
    });
    expect(items).toHaveLength(1);
    expect(items[0].reason).toBe("exercise-error");
  });

  it("does not schedule a review when all attempts are correct", () => {
    const items = computeReviewItems({
      lessonId: "l1",
      conceptId: "c1",
      exerciseResults: [ex(true, "2024-01-01T00:00:00Z")],
      assessmentResults: [],
    });
    expect(items).toHaveLength(0);
  });

  it("schedules an assessment-low-score review for a low assessment", () => {
    const items = computeReviewItems({
      lessonId: "l1",
      conceptId: "c1",
      exerciseResults: [],
      assessmentResults: [{ assessmentId: "a1", topicId: "t1", score: 0.5, timestamp: "2024-01-01T00:00:00Z" }],
    });
    expect(items.map((i) => i.reason)).toContain("assessment-low-score");
  });
});

describe("dueReviews", () => {
  it("excludes resolved items and items not yet due", () => {
    const now = Date.parse("2024-02-01T00:00:00Z");
    const items = [
      { conceptId: "a", lessonId: "l", reason: "exercise-error" as const, dueAt: "2024-01-01T00:00:00Z", createdAt: "2024-01-01T00:00:00Z" },
      { conceptId: "b", lessonId: "l", reason: "exercise-error" as const, dueAt: "2024-03-01T00:00:00Z", createdAt: "2024-01-01T00:00:00Z" },
      { conceptId: "c", lessonId: "l", reason: "exercise-error" as const, dueAt: "2024-01-01T00:00:00Z", createdAt: "2024-01-01T00:00:00Z", resolved: true },
    ];
    const due = dueReviews(items, now);
    expect(due.map((d) => d.conceptId)).toEqual(["a"]);
  });
});

describe("elapsedTimeReviews", () => {
  it("flags a mastered concept untouched for over 14 days", () => {
    const now = Date.parse("2024-02-01T00:00:00Z");
    const items = elapsedTimeReviews({
      masteredConcepts: [{ conceptId: "c1", lessonId: "l1", lastTouchedAt: "2024-01-01T00:00:00Z" }],
      now,
    });
    expect(items).toHaveLength(1);
    expect(items[0].reason).toBe("elapsed-time");
  });

  it("does not flag a recently touched mastered concept", () => {
    const now = Date.parse("2024-01-05T00:00:00Z");
    const items = elapsedTimeReviews({
      masteredConcepts: [{ conceptId: "c1", lessonId: "l1", lastTouchedAt: "2024-01-01T00:00:00Z" }],
      now,
    });
    expect(items).toHaveLength(0);
  });
});
