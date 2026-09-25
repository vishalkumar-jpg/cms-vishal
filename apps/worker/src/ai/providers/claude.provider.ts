import Anthropic from "@anthropic-ai/sdk";
import type { AiGenerateInput, AiGenerateOutput, AiProvider } from "./types";

/**
 * Claude provider (recommended default). Uses @anthropic-ai/sdk with the
 * tenant's BYOK key. We force JSON-only via the system prompt (the layout's
 * `nodes` is an open record, which structured-output json_schema can't express
 * cleanly) and hard-validate downstream. Thinking is left off for fast,
 * deterministic JSON; we stream to stay under HTTP timeouts at high max_tokens.
 */
export class ClaudeProvider implements AiProvider {
  readonly name = "claude" as const;

  async generate(input: AiGenerateInput): Promise<AiGenerateOutput> {
    const client = new Anthropic({ apiKey: input.apiKey });
    const stream = client.messages.stream({
      model: input.model,
      max_tokens: input.maxTokens,
      system: input.system,
      messages: input.messages.map((m) => ({ role: m.role, content: m.content })),
    });
    const message = await stream.finalMessage();

    if (message.stop_reason === "refusal") {
      throw new Error("Claude refused the request (safety classifier)");
    }
    const json = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    return {
      json,
      tokensIn: message.usage.input_tokens ?? 0,
      tokensOut: message.usage.output_tokens ?? 0,
    };
  }
}
