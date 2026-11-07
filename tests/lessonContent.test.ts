import { describe, it, expect } from "vitest";
import { parseLessonBody, exerciseBlock } from "../src/data/lessonContent";

describe("parseLessonBody", () => {
  it("returns a single markdown segment when there's no exercise block", () => {
    const body = "## Heading\nSome text.\n";
    const segments = parseLessonBody(body);
    expect(segments).toHaveLength(1);
    expect(segments[0].kind).toBe("markdown");
  });

  it("extracts an exercise block into a typed exercise segment", () => {
    const body = [
      "## Practice",
      "Try this one:",
      "```exercise",
      "id: ex1",
      "type: short-answer",
      "prompt: |",
      "  What is 2 + 2?",
      "```",
      "More text after.",
    ].join("\n");
    const segments = parseLessonBody(body);
    expect(segments.map((s) => s.kind)).toEqual(["markdown", "exercise", "markdown"]);
    const exSeg = segments[1];
    if (exSeg.kind !== "exercise") throw new Error("expected exercise segment");
    expect(exSeg.spec.id).toBe("ex1");
    expect(exSeg.spec.type).toBe("short-answer");
    expect(exSeg.spec.prompt.trim()).toBe("What is 2 + 2?");
  });

  it("keeps a malformed exercise block visible as plain markdown instead of dropping it", () => {
    const body = "```exercise\nnot: valid: yaml: at: all: :::\n```";
    const segments = parseLessonBody(body);
    // Either kept as markdown (malformed) -- never silently discarded.
    const allText = segments.map((s) => (s.kind === "markdown" ? s.text : "")).join("");
    expect(allText.length).toBeGreaterThan(0);
  });

  it("round-trips an exercise block built with exerciseBlock()", () => {
    const block = exerciseBlock({ id: "ex2", type: "multiple-choice", prompt: "Pick one", choices: ["A", "B"] });
    const segments = parseLessonBody(block);
    expect(segments).toHaveLength(1);
    expect(segments[0].kind).toBe("exercise");
    if (segments[0].kind === "exercise") {
      expect(segments[0].spec.choices).toEqual(["A", "B"]);
    }
  });
});
