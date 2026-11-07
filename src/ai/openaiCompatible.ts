import { AIProvider, AIProviderError, CompletionChunk, CompletionRequest, CompletionResult, estimateTokensHeuristic } from "./provider";

function classifyHttpError(status: number, body: string): AIProviderError {
  if (status === 401 || status === 403) return new AIProviderError("Invalid or unauthorized API key.", "auth", false);
  if (status === 429) return new AIProviderError("Rate limited by the provider.", "rate-limit", true);
  if (status === 400 && /context|too long|maximum/i.test(body)) {
    return new AIProviderError("Request exceeded the model's context window.", "overflow", false);
  }
  if (status >= 500) return new AIProviderError("Provider server error.", "network", true);
  return new AIProviderError(`Provider returned ${status}: ${body.slice(0, 200)}`, "unknown", false);
}

/** Works against OpenAI's Chat Completions API, and against any
 * self-hosted/third-party endpoint that mirrors that same wire format
 * (the de-facto standard for "OpenAI-compatible" servers). `baseUrl` is
 * configurable so this one adapter covers OpenAI itself plus compatible
 * backends, satisfying "configurable AI providers" without one class per
 * vendor. */
export class OpenAICompatibleProvider implements AIProvider {
  readonly id = "openai-compatible";
  readonly label = "OpenAI / OpenAI-compatible";
  readonly defaultModel = "gpt-5.1";
  readonly models = ["gpt-5.1", "gpt-5.1-mini"];

  constructor(private baseUrl: string = "https://api.openai.com/v1") {}

  estimateTokens(text: string): number {
    return estimateTokensHeuristic(text);
  }

  private url(): string {
    return `${this.baseUrl.replace(/\/$/, "")}/chat/completions`;
  }

  private toBody(req: CompletionRequest, stream: boolean) {
    const messages = req.system ? [{ role: "system", content: req.system }, ...req.messages] : req.messages;
    return {
      model: req.model,
      messages,
      max_tokens: req.maxTokens ?? 1024,
      temperature: req.temperature,
      stream,
    };
  }

  async complete(req: CompletionRequest, apiKey: string): Promise<CompletionResult> {
    let res: Response;
    try {
      res = await fetch(this.url(), {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(this.toBody(req, false)),
      });
    } catch (e) {
      throw new AIProviderError(`Network error contacting provider: ${String(e)}`, "network", true);
    }
    const text = await res.text();
    if (!res.ok) throw classifyHttpError(res.status, text);
    const json = JSON.parse(text);
    const content = json.choices?.[0]?.message?.content ?? "";
    return {
      text: content,
      inputTokens: json.usage?.prompt_tokens,
      outputTokens: json.usage?.completion_tokens,
      stopReason: json.choices?.[0]?.finish_reason,
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
      res = await fetch(this.url(), {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(this.toBody(req, true)),
        signal,
      });
    } catch (e) {
      if (signal.aborted) return { text: "", stopReason: "aborted" };
      throw new AIProviderError(`Network error contacting provider: ${String(e)}`, "network", true);
    }
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      throw classifyHttpError(res.status, text);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let full = "";
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
          if (!payload || payload === "[DONE]") continue;
          let evt: { choices?: { delta?: { content?: string }; finish_reason?: string }[] };
          try {
            evt = JSON.parse(payload);
          } catch {
            continue;
          }
          const delta = evt.choices?.[0]?.delta?.content;
          if (delta) {
            full += delta;
            onChunk({ textDelta: delta });
          }
          const fr = evt.choices?.[0]?.finish_reason;
          if (fr) stopReason = fr;
        }
      }
    } catch (e) {
      if (signal.aborted) return { text: full, stopReason: "aborted" };
      throw new AIProviderError(`Stream reading failed: ${String(e)}`, "network", true);
    }

    return { text: full, stopReason };
  }
}
