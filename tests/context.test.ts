import { describe, it, expect } from "vitest";
import { assembleContext } from "../src/retrieval/context";
import { Indexer, IndexedChunk } from "../src/retrieval/indexer";

function chunk(partial: Partial<IndexedChunk>): IndexedChunk {
  return {
    id: "x",
    path: "LearningOS/Topics/korean/Lessons/001.md",
    topicId: "korean",
    kind: "lesson",
    heading: "",
    text: "",
    updatedAt: Date.now(),
    termFreq: new Map(),
    length: 1,
    ...partial,
  };
}

function fakeIndexer(chunks: IndexedChunk[]): Indexer {
  return {
    query: (_text: string, opts: { excludePaths?: string[] } = {}) =>
      chunks.filter((c) => !opts.excludePaths?.includes(c.path)),
    getChunksForPath: (path: string) => chunks.filter((c) => c.path === path),
  } as unknown as Indexer;
}

const estimateTokens = (t: string) => Math.ceil(t.length / 4);

describe("assembleContext", () => {
  it("always includes selected text, even first, as tier 1", () => {
    const indexer = fakeIndexer([]);
    const result = assembleContext(indexer, {
      userMessage: "explain this",
      ui: { selectedText: "the selected passage" },
      recentMessages: [],
      estimateTokens,
      budget: 2000,
    });
    expect(result.items[0].priorityTier).toBe(1);
    expect(result.items[0].text).toBe("the selected passage");
  });

  it("includes the lesson objective and relevant lesson chunk when a lesson is active", () => {
    const lessonChunk = chunk({ heading: "Grammar", text: "Korean grammar basics." });
    const indexer = fakeIndexer([lessonChunk]);
    const result = assembleContext(indexer, {
      userMessage: "explain grammar",
      ui: { topicId: "korean", lessonId: "001", lessonTitle: "Intro", objective: "Learn basics" },
      recentMessages: [],
      estimateTokens,
      budget: 2000,
    });
    expect(result.items.some((i) => i.text === "Learn basics")).toBe(true);
    expect(result.items.some((i) => i.text.includes("Korean grammar basics"))).toBe(true);
  });

  it("drops lower-priority items once the token budget is exhausted, without truncating what it keeps", () => {
    const big = "x".repeat(4000); // ~1000 tokens
    const indexer = fakeIndexer([]);
    const result = assembleContext(indexer, {
      userMessage: "hello",
      ui: { selectedText: big },
      recentMessages: [{ role: "user", content: "a".repeat(4000) }],
      estimateTokens,
      budget: 300, // smaller than the selection alone -> selection still included whole
    });
    // Selected text (tier 1) is included whole, never partially truncated.
    expect(result.items[0].text).toBe(big);
    // Something must have been recorded as dropped since budget was tiny.
    expect(result.dropped.length).toBeGreaterThan(0);
  });

  it("never includes a partially-truncated passage: every kept item's text is a verbatim retrieved string", () => {
    const c1 = chunk({ text: "Full passage one.", heading: "A" });
    const indexer = fakeIndexer([c1]);
    const result = assembleContext(indexer, {
      userMessage: "example",
      ui: { topicId: "korean", lessonId: "001" },
      recentMessages: [],
      estimateTokens,
      budget: 5000,
    });
    for (const item of result.items) {
      expect(item.text.endsWith("...")).toBe(false);
    }
  });

  it("classifies intent and pulls progress data for mistakes-review questions", () => {
    const indexer = fakeIndexer([]);
    const result = assembleContext(indexer, {
      userMessage: "what mistakes do I keep making?",
      ui: { topicId: "korean" },
      recentMessages: [],
      progress: { topicId: "korean", updatedAt: "now", lessonStatuses: {}, masteredConcepts: [], weakConcepts: ["particles"] },
      estimateTokens,
      budget: 2000,
    });
    expect(result.intent).toBe("mistakes-review");
    expect(result.items.some((i) => i.text.includes("particles"))).toBe(true);
  });
});
