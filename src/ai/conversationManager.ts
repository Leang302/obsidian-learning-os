import { RecentMessage } from "../retrieval/context";

const RECENT_WINDOW = 6; // messages kept verbatim, per lesson
const SUMMARIZE_EVERY_N_TURNS = 8; // update the rolling summary every N user turns, not every message

export interface ConversationState {
  lessonKey: string; // `${topicId}/${lessonId}`
  messages: RecentMessage[]; // full in-memory transcript for the active session (never written to Markdown)
  rollingSummary: string;
  turnsSinceSummary: number;
}

/** Keeps per-lesson chat state in memory only (never persisted verbatim to
 * the vault, per the spec's durable-knowledge/temporary-state split). The
 * recent window is what actually gets sent to the model for continuity;
 * the rolling summary covers everything older than that window. */
export class ConversationManager {
  private states = new Map<string, ConversationState>();

  private key(topicId: string, lessonId: string): string {
    return `${topicId}/${lessonId}`;
  }

  getOrCreate(topicId: string, lessonId: string): ConversationState {
    const key = this.key(topicId, lessonId);
    let s = this.states.get(key);
    if (!s) {
      s = { lessonKey: key, messages: [], rollingSummary: "", turnsSinceSummary: 0 };
      this.states.set(key, s);
    }
    return s;
  }

  addMessage(topicId: string, lessonId: string, msg: RecentMessage): void {
    const s = this.getOrCreate(topicId, lessonId);
    s.messages.push(msg);
    if (msg.role === "user") s.turnsSinceSummary++;
  }

  /** The window actually sent to the model: recent messages only. */
  recentWindow(topicId: string, lessonId: string): RecentMessage[] {
    const s = this.getOrCreate(topicId, lessonId);
    return s.messages.slice(-RECENT_WINDOW);
  }

  rollingSummary(topicId: string, lessonId: string): string {
    return this.getOrCreate(topicId, lessonId).rollingSummary;
  }

  /** Whether enough has happened to justify spending a call to refresh the
   * summary. Checked by the caller before actually asking the AI to
   * summarize -- "update summaries only when useful" means we don't pay
   * for a summarization call after every single message. */
  shouldRefreshSummary(topicId: string, lessonId: string): boolean {
    const s = this.getOrCreate(topicId, lessonId);
    return s.turnsSinceSummary >= SUMMARIZE_EVERY_N_TURNS;
  }

  setRollingSummary(topicId: string, lessonId: string, summary: string): void {
    const s = this.getOrCreate(topicId, lessonId);
    s.rollingSummary = summary;
    s.turnsSinceSummary = 0;
  }

  clear(topicId: string, lessonId: string): void {
    this.states.delete(this.key(topicId, lessonId));
  }
}
