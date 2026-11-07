import { describe, it, expect } from "vitest";
import { classifyIntent } from "../src/retrieval/intent";

describe("classifyIntent", () => {
  it("classifies next-lesson questions", () => {
    expect(classifyIntent("What should I learn next?")).toBe("next-lesson");
  });
  it("classifies mistakes-review questions", () => {
    expect(classifyIntent("What mistakes do I keep making?")).toBe("mistakes-review");
  });
  it("classifies quiz requests", () => {
    expect(classifyIntent("Quiz me on this")).toBe("quiz");
  });
  it("classifies simplify requests", () => {
    expect(classifyIntent("Can you explain this in simpler terms?")).toBe("simplify");
  });
  it("classifies explain-again requests", () => {
    expect(classifyIntent("Explain this again please")).toBe("explain-again");
  });
  it("classifies stuck/confused signals", () => {
    expect(classifyIntent("I still don't understand this")).toBe("stuck");
  });
  it("falls back to general for anything unmatched", () => {
    expect(classifyIntent("How does TCP handshake work in detail?")).toBe("general");
  });
});
