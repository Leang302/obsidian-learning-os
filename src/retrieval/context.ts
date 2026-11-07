import { Indexer, IndexedChunk, ChunkKind } from "./indexer";
import { classifyIntent, QueryIntent } from "./intent";
import { ProgressFrontmatter } from "../types";

export interface UIContext {
  topicId?: string;
  lessonId?: string;
  lessonTitle?: string;
  objective?: string;
  moduleId?: string;
  exerciseId?: string;
  selectedText?: string;
}

export interface ContextItem {
  source: string; // human-readable: "Lesson: 002-sentence-patterns § Grammar"
  path: string;
  text: string;
  priorityTier: 1 | 2 | 3 | 4 | 5 | 6;
  reason: string;
  estTokens: number;
}

export interface AssembledContext {
  items: ContextItem[];
  totalTokens: number;
  budget: number;
  intent: QueryIntent;
  /** Items that were considered but dropped for budget reasons -- shown in
   * the Context Inspector so dropping is never silent. */
  dropped: { source: string; reason: string }[];
}

export interface RecentMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AssembleOptions {
  userMessage: string;
  ui: UIContext;
  recentMessages: RecentMessage[]; // already-trimmed short window from the chat manager
  rollingSummary?: string; // compact durable summary for the current lesson, if any
  progress?: ProgressFrontmatter | null;
  estimateTokens: (text: string) => number;
  budget: number;
}

const WEIGHT: Record<QueryIntent, Partial<Record<ChunkKind, number>>> = {
  "explain-again": { lesson: 1 },
  simplify: { lesson: 1 },
  example: { lesson: 1 },
  why: { lesson: 1 },
  "what-if": { lesson: 1 },
  quiz: { lesson: 1, progress: 1 },
  "real-world-example": { lesson: 1 },
  stuck: { lesson: 1 },
  "next-lesson": { roadmap: 1, progress: 1 },
  "mistakes-review": { progress: 1, exercise: 1, review: 1 },
  general: { lesson: 1 },
};

/** Builds the smallest sufficient context for one AI request, following
 * the priority order from the spec: (1) current question/selection,
 * (2) active lesson/objective, (3) relevant recent conversation,
 * (4) relevant mistakes/progress, (5) relevant related notes, (6) other.
 * Lower-priority items are the first to be shrunk/dropped once the token
 * budget is hit; a kept item is never partially truncated in a way that
 * changes its meaning -- it's included whole or not at all. */
export function assembleContext(indexer: Indexer, opts: AssembleOptions): AssembledContext {
  const intent = classifyIntent(opts.userMessage);
  const items: ContextItem[] = [];
  const dropped: { source: string; reason: string }[] = [];
  let used = 0;

  const tryAdd = (item: Omit<ContextItem, "estTokens">): boolean => {
    const estTokens = opts.estimateTokens(item.text);
    if (used + estTokens > opts.budget) {
      dropped.push({ source: item.source, reason: "token budget exceeded" });
      return false;
    }
    items.push({ ...item, estTokens });
    used += estTokens;
    return true;
  };

  // Tier 1: current question + explicit selection (always included, never
  // dropped for budget -- if this alone blows the budget that's a config
  // problem the user should see, not silent omission of the question).
  if (opts.ui.selectedText) {
    items.push({
      source: "Selected text",
      path: "",
      text: opts.ui.selectedText,
      priorityTier: 1,
      reason: "User selected this text and is asking about it.",
      estTokens: opts.estimateTokens(opts.ui.selectedText),
    });
    used += items[items.length - 1].estTokens;
  }

  // Tier 2: active lesson objective + relevant lesson chunk(s).
  if (opts.ui.lessonId && opts.ui.topicId) {
    if (opts.ui.objective) {
      tryAdd({
        source: `Lesson objective: ${opts.ui.lessonTitle ?? opts.ui.lessonId}`,
        path: "",
        text: opts.ui.objective,
        priorityTier: 2,
        reason: "The learning objective of the lesson currently open.",
      });
    }
    const lessonPath = `LearningOS/Topics/${opts.ui.topicId}/Lessons/${opts.ui.lessonId}.md`;
    const lessonChunks = indexer.query(opts.userMessage, {
      topicId: opts.ui.topicId,
      kinds: ["lesson"],
      limit: 3,
    });
    const relevant = lessonChunks.filter((c) => c.path === lessonPath);
    const withinLesson = relevant.length ? relevant : indexer.getChunksForPath(lessonPath).slice(0, 2);
    for (const c of withinLesson) {
      tryAdd({
        source: `Lesson: ${opts.ui.lessonTitle ?? opts.ui.lessonId}${c.heading ? ` § ${c.heading}` : ""}`,
        path: c.path,
        text: c.text,
        priorityTier: 2,
        reason: "Content from the lesson currently open, relevant to the question.",
      });
    }
  }

  // Tier 3: recent conversation (already compressed by the chat manager).
  if (opts.recentMessages.length) {
    const convoText = opts.recentMessages.map((m) => `${m.role}: ${m.content}`).join("\n");
    tryAdd({
      source: "Recent conversation",
      path: "",
      text: convoText,
      priorityTier: 3,
      reason: "Recent turns in this chat, for continuity.",
    });
  }
  if (opts.rollingSummary) {
    tryAdd({
      source: "Conversation summary",
      path: "",
      text: opts.rollingSummary,
      priorityTier: 3,
      reason: "Compact rolling summary of earlier discussion on this lesson.",
    });
  }

  // Tier 4: relevant mistakes / progress, weighted by intent.
  const wantsProgress = intent === "mistakes-review" || intent === "quiz" || intent === "next-lesson";
  if (wantsProgress && opts.progress) {
    if (opts.progress.weakConcepts.length) {
      tryAdd({
        source: "Weak concepts (progress)",
        path: `LearningOS/Topics/${opts.ui.topicId}/Progress.md`,
        text: `Weak concepts flagged for review: ${opts.progress.weakConcepts.join(", ")}`,
        priorityTier: 4,
        reason: "Directly relevant to a mistakes/review/next-lesson question.",
      });
    }
    if (opts.progress.masteredConcepts.length && intent === "next-lesson") {
      tryAdd({
        source: "Mastered concepts (progress)",
        path: `LearningOS/Topics/${opts.ui.topicId}/Progress.md`,
        text: `Already mastered: ${opts.progress.masteredConcepts.join(", ")}`,
        priorityTier: 4,
        reason: "Helps avoid recommending already-mastered material.",
      });
    }
  }
  if (intent === "mistakes-review" && opts.ui.topicId) {
    const reviewChunks = indexer.query(opts.userMessage, { topicId: opts.ui.topicId, kinds: ["review", "exercise"], limit: 4 });
    for (const c of reviewChunks) {
      tryAdd({
        source: `${c.kind === "review" ? "Review" : "Exercise"}: ${c.heading || c.path}`,
        path: c.path,
        text: c.text,
        priorityTier: 4,
        reason: "Past mistake/exercise record relevant to the question.",
      });
    }
  }

  // Tier 5: other related notes within the same topic -- only when budget
  // remains and the question doesn't already have a strong tier-2 match.
  const weights = WEIGHT[intent] ?? {};
  if (Object.keys(weights).length && opts.ui.topicId) {
    const already = new Set(items.map((i) => i.path));
    const related = indexer.query(opts.userMessage, {
      topicId: opts.ui.topicId,
      kinds: Object.keys(weights) as ChunkKind[],
      limit: 4,
      excludePaths: already.size ? [...already] : undefined,
    });
    for (const c of related) {
      if (already.has(c.path)) continue;
      tryAdd({
        source: `${c.kind}: ${c.heading || c.path}`,
        path: c.path,
        text: c.text,
        priorityTier: 5,
        reason: "Related note in the same topic, ranked relevant to the question.",
      });
    }
  }

  return { items, totalTokens: used, budget: opts.budget, intent, dropped };
}

/** Renders the assembled context into the plain text block that gets
 * placed in the system/user prompt. Kept separate from assembly so the
 * Context Inspector can show items structured and the prompt can show
 * them flattened. */
export function renderContextBlock(ctx: AssembledContext): string {
  if (!ctx.items.length) return "";
  return ctx.items
    .map((i) => `### ${i.source}\n${i.text}`)
    .join("\n\n");
}
