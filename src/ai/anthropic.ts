import { AIProvider, AIProviderError, CompletionChunk, CompletionRequest, CompletionResult, estimateTokensHeuristic } from "./provider";

const API_URL = "https://api.anthropic.com/v1/messages";

function classifyHttpError(status: number, body: string): AIProviderError {
  if (status === 401 || status === 403) return new AIProviderError("Invalid or unauthorized API key.", "auth", false);
  if (status === 429) return new AIProviderError("Rate limited by the provider.", "rate-limit", true);
  if (status === 400 && /context|too long|maximum/i.test(body)) {
    return new AIProviderError("Request exceeded the model's context window.", "overflow", false);
  }
  if (status >= 500) return new AIProviderError("Provider server error.", "network", true);
  return new AIProviderError(`Provider returned ${status}: ${body.slice(0, 200)}`, "unknown", false);
}

export class AnthropicProvider implements AIProvider {
  readonly id = "anthropic";
  readonly label = "Anthropic (Claude)";
  readonly defaultModel = "claude-sonnet-4-5";
  readonly models = ["claude-opus-4-1", "claude-sonnet-4-5", "claude-haiku-4-5"];

  estimateTokens(text: string): number {
    return estimateTokensHeuristic(text);
  }

  private headers(apiKey: string) {
    return {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      // Required to let a browser-context fetch call this API directly
      // (we run inside Obsidian's Electron renderer, which enforces
      // normal browser CORS rules).
      "anthropic-dangerous-direct-browser-access": "true",
    };
  }

  private toBody(req: CompletionRequest, stream: boolean) {
    return {
      model: req.model,
      system: req.system,
      max_tokens: req.maxTokens ?? 1024,
      temperature: req.temperature,
      stream,
      messages: req.messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role, content: m.content })),
    };
  }

  async complete(req: CompletionRequest, apiKey: string): Promise<CompletionResult> {
    let res: Response;
    try {
      res = await fetch(API_URL, {
        method: "POST",
        headers: this.headers(apiKey),
        body: JSON.stringify(this.toBody(req, false)),
      });
    } catch (e) {
      throw new AIProviderError(`Network error contacting Anthropic: ${String(e)}`, "network", true);
    }
    const text = await res.text();
    if (!res.ok) throw classifyHttpError(res.status, text);
    const json = JSON.parse(text);
    const content = (json.content ?? []).map((b: { text?: string }) => b.text ?? "").join("");
    return {
      text: content,
      inputTokens: json.usage?.input_tokens,
      outputTokens: json.usage?.output_tokens,
      stopReason: json.stop_reason,
    };
  }

  async stream(
    req: CompletionRequest,
    apiKey: string,
    onChunk: (chunk: CompletionChunk) => void,
    signal: AbortSignal
  ): Promise<CompletionResult> {
    let res: Response;
    try {
      res = await fetch(API_URL, {
        method: "POST",
        headers: this.headers(apiKey),
        body: JSON.stringify(this.toBody(req, true)),
        signal,
      });
    } catch (e) {
      if (signal.aborted) return { text: "", stopReason: "aborted" };
      throw new AIProviderError(`Network error contacting Anthropic: ${String(e)}`, "network", true);
    }
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      throw classifyHttpError(res.status, text);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let full = "";
    let inputTokens: number | undefined;
    let outputTokens: number | undefined;
    let stopReason: string | undefined;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (!payload) continue;
          let evt: Record<string, unknown>;
          try {
            evt = JSON.parse(payload);
          } catch {
            continue;
          }
          if (evt.type === "content_block_delta") {
            const delta = (evt.delta as { text?: string } | undefined)?.text ?? "";
            if (delta) {
              full += delta;
              onChunk({ textDelta: delta });
            }
          } else if (evt.type === "message_delta") {
            const usage = evt.usage as { output_tokens?: number } | undefined;
            if (usage?.output_tokens) outputTokens = usage.output_tokens;
            stopReason = (evt.delta as { stop_reason?: string } | undefined)?.stop_reason ?? stopReason;
          } else if (evt.type === "message_start") {
            const usage = (evt.message as { usage?: { input_tokens?: number } } | undefined)?.usage;
            if (usage?.input_tokens) inputTokens = usage.input_tokens;
          } else if (evt.type === "error") {
            const err = evt.error as { message?: string } | undefined;
            throw new AIProviderError(err?.message ?? "Unknown stream error", "unknown", false);
          }
        }
      }
    } catch (e) {
      if (signal.aborted) {
        return { text: full, inputTokens, outputTokens, stopReason: "aborted" };
      }
      if (e instanceof AIProviderError) throw e;
      throw new AIProviderError(`Stream reading failed: ${String(e)}`, "network", true);
    }

    return { text: full, inputTokens, outputTokens, stopReason };
  }
}
