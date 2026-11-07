import { describe, it, expect } from "vitest";
import { parseMarkdown, stringifyMarkdown, updateFrontmatter } from "../src/util/frontmatter";

describe("parseMarkdown", () => {
  it("parses valid frontmatter and body", () => {
    const content = "---\nid: foo\nstatus: active\n---\n\n# Hello\nBody text\n";
    const { frontmatter, body, frontmatterInvalid } = parseMarkdown<{ id: string; status: string }>(content);
    expect(frontmatterInvalid).toBe(false);
    expect(frontmatter).toEqual({ id: "foo", status: "active" });
    expect(body).toContain("# Hello");
  });

  it("returns null frontmatter when none present", () => {
    const content = "# Just a note\nNo frontmatter here.\n";
    const { frontmatter, body, frontmatterInvalid } = parseMarkdown(content);
    expect(frontmatter).toBeNull();
    expect(frontmatterInvalid).toBe(false);
    expect(body).toBe(content);
  });

  it("flags invalid YAML as frontmatterInvalid instead of throwing", () => {
    const content = "---\nid: [unterminated\n---\nBody\n";
    const { frontmatterInvalid, body } = parseMarkdown(content);
    expect(frontmatterInvalid).toBe(true);
    // Must preserve the original content untouched when invalid.
    expect(body).toBe(content);
  });

  it("flags non-object frontmatter (e.g. a bare scalar or list) as invalid", () => {
    const content = "---\n- just\n- a\n- list\n---\nBody\n";
    const { frontmatterInvalid } = parseMarkdown(content);
    expect(frontmatterInvalid).toBe(true);
  });
});

describe("stringifyMarkdown / round trip", () => {
  it("round-trips frontmatter and body", () => {
    const fm = { id: "foo", nested: { a: 1 }, list: ["x", "y"] };
    const body = "\n## Section\nSome text\n";
    const content = stringifyMarkdown(fm, body);
    const parsed = parseMarkdown(content);
    expect(parsed.frontmatterInvalid).toBe(false);
    expect(parsed.frontmatter).toEqual(fm);
    expect(parsed.body).toContain("## Section");
  });
});

describe("updateFrontmatter", () => {
  it("merges updates while preserving the body", () => {
    const content = "---\nid: foo\nstatus: not-started\n---\n\nBody text.\n";
    const { content: next, hadInvalidFrontmatter } = updateFrontmatter(content, { status: "completed" });
    expect(hadInvalidFrontmatter).toBe(false);
    const parsed = parseMarkdown<{ id: string; status: string }>(next);
    expect(parsed.frontmatter?.status).toBe("completed");
    expect(parsed.frontmatter?.id).toBe("foo");
    expect(parsed.body).toContain("Body text.");
  });

  it("refuses to merge into invalid frontmatter rather than guessing", () => {
    const content = "---\nid: [bad\n---\nBody\n";
    const { content: next, hadInvalidFrontmatter } = updateFrontmatter(content, { status: "completed" });
    expect(hadInvalidFrontmatter).toBe(true);
    expect(next).toBe(content); // unchanged
  });

  it("is idempotent: applying the same update twice yields the same result", () => {
    const content = "---\nid: foo\nstatus: not-started\n---\n\nBody.\n";
    const once = updateFrontmatter(content, { status: "completed" }).content;
    const twice = updateFrontmatter(once, { status: "completed" }).content;
    expect(twice).toBe(once);
  });
});
