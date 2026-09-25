import type { AiProvider } from "@database/schema";

/**
 * Centralized AI model defaults for the API side (mirrors the worker's
 * providers/models.ts). Claude is the recommended default. AI_DEFAULT_PROVIDER
 * env can override the default provider.
 */
export const DEFAULT_MODELS: Record<AiProvider, string> = {
  claude: "claude-opus-4-8",
  openai: "gpt-4o",
  gemini: "gemini-1.5-pro",
};

export function defaultProvider(): AiProvider {
  const p = (process.env.AI_DEFAULT_PROVIDER ?? "claude").trim();
  return p === "openai" || p === "gemini" ? p : "claude";
}

export function defaultModelFor(provider: AiProvider): string {
  return DEFAULT_MODELS[provider];
}
