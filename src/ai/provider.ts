export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompletionRequest {
  model: string;
  system?: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface CompletionChunk {
  textDelta: string;
}

export interface CompletionResult {
  text: string;
  inputTokens?: number;
  outputTokens?: number;
  stopReason?: string;
}

export class AIProviderError extends Error {
  constructor(
    message: string,
    public kind: "auth" | "rate-limit" | "network" | "overflow" | "unknown",
    public retryable: boolean
  ) {
    super(message);
  }
}

/** Clean adapter boundary: every concrete AI backend (Anthropic,
 * OpenAI-compatible, future providers) implements this and nothing in the
 * rest of the plugin depends on a specific vendor's API shape. */
export interface AIProvider {
  readonly id: string;
  readonly label: string;
  readonly defaultModel: string;
  readonly models: string[];

  /** Non-streaming completion, used for short deterministic calls (grading,
   * classification fallback) where streaming adds no value. */
  complete(req: CompletionRequest, apiKey: string): Promise<CompletionResult>;

  /** Streaming completion. `onChunk` fires per text delta; the returned
   * promise resolves with the final aggregated result once done, or
   * rejects with AIProviderError. Honors `signal` for user-initiated stop. */
  stream(
    req: CompletionRequest,
    apiKey: string,
    onChunk: (chunk: CompletionChunk) => void,
    signal: AbortSignal
  ): Promise<CompletionResult>;

  /** Rough token estimate for budget enforcement before a call is made.
   * Doesn't need to be exact -- just consistent enough to enforce budgets
   * and show the user a meaningful number in the Context Inspector. */
  estimateTokens(text: string): number;
}

/** ~4 chars/token is the standard rough heuristic used across providers
 * when no real tokenizer is available client-side. Shared so every
 * provider's estimate is consistent and comparable in the UI. */
export function estimateTokensHeuristic(text: string): number {
  return Math.ceil(text.length / 4);
}
