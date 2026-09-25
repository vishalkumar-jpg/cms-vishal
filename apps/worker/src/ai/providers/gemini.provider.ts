import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AiGenerateInput, AiGenerateOutput, AiProvider } from "./types";

/**
 * Gemini provider. Uses @google/generative-ai with a JSON response MIME type to
 * force a JSON object; the system prompt pins the SerializedLayout shape. Output
 * is hard-validated downstream. Gemini has no separate system role, so the
 * system prompt is passed via `systemInstruction`.
 */
export class GeminiProvider implements AiProvider {
  readonly name = "gemini" as const;

  async generate(input: AiGenerateInput): Promise<AiGenerateOutput> {
    const genai = new GoogleGenerativeAI(input.apiKey);
    const model = genai.getGenerativeModel({
      model: input.model,
      systemInstruction: input.system,
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: input.maxTokens,
      },
    });

    // Map our user/assistant turns to Gemini's user/model roles.
    const contents = input.messages.map((m) => ({
      role: m.role === "assistant" ? ("model" as const) : ("user" as const),
      parts: [{ text: m.content }],
    }));

    const result = await model.generateContent({ contents });
    const json = result.response.text();
    const usage = result.response.usageMetadata;
    return {
      json,
      tokensIn: usage?.promptTokenCount ?? 0,
      tokensOut: usage?.candidatesTokenCount ?? 0,
    };
  }
}
