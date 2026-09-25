import type { AiProvider as ProviderName } from "../../db/schema";

/**
 * Centralized model defaults + pricing. Claude is the recommended/default
 * provider (latest Opus). Pricing is per-million tokens in micro-USD so cost
 * estimates stay integer (no float drift) — see costMicroUsd().
 */
export const DEFAULT_PROVIDER: ProviderName = "claude";

export const DEFAULT_MODELS: Record<ProviderName, string> = {
  claude: "claude-opus-4-8",
  openai: "gpt-4o",
  gemini: "gemini-1.5-pro",
};

/** Recommended cap for a single generation (streamed where the SDK supports it). */
export const MAX_OUTPUT_TOKENS = 16000;

/** $/1M tokens (input, output) in micro-USD per token. Coarse estimates. */
const PRICING: Record<string, { in: number; out: number }> = {
  // Claude Opus 4.8: $5 in / $25 out per 1M tokens.
  "claude-opus-4-8": { in: 5, out: 25 },
  "claude-sonnet-4-6": { in: 3, out: 15 },
  "gpt-4o": { in: 2.5, out: 10 },
  "gemini-1.5-pro": { in: 1.25, out: 5 },
};

/** Estimated cost of a call in micro-USD (integer). */
export function costMicroUsd(model: string, tokensIn: number, tokensOut: number): number {
  const p = PRICING[model] ?? { in: 5, out: 25 };
  // price is $/1M tokens => micro-USD per token = price (since $1 = 1e6 micro and /1e6 tokens).
  return Math.round(tokensIn * p.in + tokensOut * p.out);
}

export function defaultModelFor(provider: ProviderName): string {
  return DEFAULT_MODELS[provider];
}
