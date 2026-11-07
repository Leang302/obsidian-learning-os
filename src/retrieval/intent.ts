export type QueryIntent =
  | "explain-again"
  | "simplify"
  | "example"
  | "why"
  | "what-if"
  | "quiz"
  | "real-world-example"
  | "stuck"
  | "next-lesson"
  | "mistakes-review"
  | "general";

/** Cheap local-rules intent classification -- no AI call spent just to
 * figure out what kind of question this is (per "deterministic local
 * operations without AI calls"). Falls back to "general" when nothing
 * matches, which just means "use the default context mix". */
export function classifyIntent(message: string): QueryIntent {
  const m = message.toLowerCase();
  if (/what should i (learn|study|do) next|next lesson|recommend/.test(m)) return "next-lesson";
  if (/mistakes?|keep getting wrong|what.*wrong with me|weak (area|spot|topic)/.test(m)) return "mistakes-review";
  if (/quiz me|test my knowledge|test me/.test(m)) return "quiz";
  if (/real.world|in practice|in real life/.test(m)) return "real-world-example";
  if (/another example|give me an example|example of/.test(m)) return "example";
  if (/simpler|simplify|easier terms|in simple terms|dumb it down/.test(m)) return "simplify";
  if (/why does|why is|why do|what.s the reason/.test(m)) return "why";
  if (/what (happens|if) .*(instead|differently)|what if i/.test(m)) return "what-if";
  if (/explain (this |it )?again|explain again|re-?explain/.test(m)) return "explain-again";
  if (/i (still )?don.t understand|i.m (lost|stuck|confused)/.test(m)) return "stuck";
  return "general";
}
