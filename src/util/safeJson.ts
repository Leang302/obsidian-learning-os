/** Defensively parses a JSON object out of an LLM response. Models
 * sometimes wrap JSON in ```json fences or add stray whitespace even when
 * explicitly told not to -- this strips that without trying to "fix" or
 * guess at malformed JSON itself. Returns null on failure so callers can
 * surface "I couldn't parse the AI's response" instead of crashing or
 * inventing data. */
export function safeParseJson<T>(text: string): T | null {
  let candidate = text.trim();
  const fenced = candidate.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) candidate = fenced[1].trim();
  try {
    return JSON.parse(candidate) as T;
  } catch {
    // Last resort: try to locate the first/last curly brace.
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}
