import { AIProvider } from "./provider";
import { AnthropicProvider } from "./anthropic";
import { OpenAICompatibleProvider } from "./openaiCompatible";

export type ProviderId = "anthropic" | "openai-compatible";

export function createProvider(id: ProviderId, openaiBaseUrl?: string): AIProvider {
  switch (id) {
    case "anthropic":
      return new AnthropicProvider();
    case "openai-compatible":
      return new OpenAICompatibleProvider(openaiBaseUrl);
    default:
      throw new Error(`Unknown provider id: ${id}`);
  }
}

export const AVAILABLE_PROVIDERS: { id: ProviderId; label: string }[] = [
  { id: "anthropic", label: "Anthropic (Claude)" },
  { id: "openai-compatible", label: "OpenAI / OpenAI-compatible" },
];
