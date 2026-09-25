import OpenAI from "openai";
import type { AiGenerateInput, AiGenerateOutput, AiProvider } from "./types";

/**
 * OpenAI provider. Uses the chat completions API with JSON mode
 * (`response_format: { type: "json_object" }`) to force a JSON object; the
 * system prompt pins the exact SerializedLayout shape and the output is
 * hard-validated downstream.
 */
export class OpenAiProvider implements AiProvider {
  readonly name = "openai" as const;

  async generate(input: AiGenerateInput): Promise<AiGenerateOutput> {
    const client = new OpenAI({ apiKey: input.apiKey });
    const completion = await client.chat.completions.create({
      model: input.model,
      max_tokens: input.maxTokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: input.system },
        ...input.messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    });
    const json = completion.choices[0]?.message?.content ?? "";
    return {
      json,
      tokensIn: completion.usage?.prompt_tokens ?? 0,
      tokensOut: completion.usage?.completion_tokens ?? 0,
    };
  }
}
