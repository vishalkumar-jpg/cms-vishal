import type { AiProvider as ProviderName } from "../../db/schema";
import type { AiProvider } from "./types";
import { MockProvider } from "./mock.provider";

/**
 * Resolve a provider implementation for a tenant request. When AI_MOCK=true the
 * MockProvider is returned for ALL providers so the loop runs offline with no
 * real key. Otherwise the real SDK-backed providers are loaded lazily (so the
 * worker boots even if an optional SDK isn't installed and a provider isn't
 * used). The decrypted key is passed per-call, not held here.
 */
export async function resolveProvider(provider: ProviderName): Promise<AiProvider> {
  if (process.env.AI_MOCK === "true") {
    return new MockProvider();
  }
  switch (provider) {
    case "claude": {
      const { ClaudeProvider } = await import("./claude.provider");
      return new ClaudeProvider();
    }
    case "openai": {
      const { OpenAiProvider } = await import("./openai.provider");
      return new OpenAiProvider();
    }
    case "gemini": {
      const { GeminiProvider } = await import("./gemini.provider");
      return new GeminiProvider();
    }
    default:
      throw new Error(`Unknown AI provider: ${provider as string}`);
  }
}
