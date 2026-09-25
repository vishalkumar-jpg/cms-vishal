/**
 * Provider abstraction (WAVE4a). All three BYOK providers (Claude/OpenAI/Gemini)
 * plus the offline Mock implement this one interface. The generation service is
 * provider-agnostic: it builds the system+user prompt, calls `generate`, and
 * validates/repairs the returned JSON. Model defaults are centralized in
 * `models.ts`. The plaintext key is passed in per-call and never stored.
 */
export interface AiGenerateInput {
  system: string;
  /** Conversation turns: the initial user message and any self-correction follow-up. */
  messages: { role: "user" | "assistant"; content: string }[];
  model: string;
  apiKey: string;
  maxTokens: number;
}

export interface AiGenerateOutput {
  /** Raw text the model returned — expected to be a JSON object (parsed downstream). */
  json: string;
  tokensIn: number;
  tokensOut: number;
}

export interface AiProvider {
  readonly name: "claude" | "openai" | "gemini" | "mock";
  generate(input: AiGenerateInput): Promise<AiGenerateOutput>;
}
