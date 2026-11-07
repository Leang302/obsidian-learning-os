import { describe, it, expect } from "vitest";
import { slugify, dedupeSlug, lessonPath, overviewPath } from "../src/data/paths";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("System Design")).toBe("system-design");
  });
  it("strips punctuation", () => {
    expect(slugify("What's Up?! Korean.")).toBe("whats-up-korean");
  });
  it("collapses whitespace", () => {
    expect(slugify("  too    many   spaces  ")).toBe("too-many-spaces");
  });
  it("falls back to 'untitled' for empty/symbol-only input", () => {
    expect(slugify("???")).toBe("untitled");
    expect(slugify("")).toBe("untitled");
  });
});

describe("dedupeSlug", () => {
  it("returns the base unchanged if not taken", () => {
    expect(dedupeSlug("korean", new Set())).toBe("korean");
  });
  it("appends -2, -3, ... for duplicates (duplicate topic/lesson titles)", () => {
    const existing = new Set(["korean", "korean-2"]);
    expect(dedupeSlug("korean", existing)).toBe("korean-3");
  });
});

describe("path builders", () => {
  it("builds correct nested paths", () => {
    expect(overviewPath("korean")).toBe("LearningOS/Topics/korean/Overview.md");
    expect(lessonPath("korean", "001-intro")).toBe("LearningOS/Topics/korean/Lessons/001-intro.md");
  });
});
