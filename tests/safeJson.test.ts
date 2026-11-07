import { describe, it, expect } from "vitest";
import { safeParseJson } from "../src/util/safeJson";

describe("safeParseJson", () => {
  it("parses plain JSON", () => {
    expect(safeParseJson<{ a: number }>('{"a": 1}')).toEqual({ a: 1 });
  });

  it("strips a ```json fenced block", () => {
    const text = "```json\n{\"a\": 1}\n```";
    expect(safeParseJson<{ a: number }>(text)).toEqual({ a: 1 });
  });

  it("strips a bare ``` fenced block without language tag", () => {
    const text = "```\n{\"a\": 1}\n```";
    expect(safeParseJson<{ a: number }>(text)).toEqual({ a: 1 });
  });

  it("recovers JSON embedded in stray prose by locating braces", () => {
    const text = "Sure, here you go: {\"a\": 1} Hope that helps!";
    expect(safeParseJson<{ a: number }>(text)).toEqual({ a: 1 });
  });

  it("returns null for genuinely unparsable text rather than throwing", () => {
    expect(safeParseJson("not json at all")).toBeNull();
  });
});
