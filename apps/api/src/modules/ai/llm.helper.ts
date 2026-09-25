import { BadRequestException } from "@nestjs/common";
import type { AiProvider } from "@database/schema";

/**
 * Tiny, dependency-free SYNC LLM helper for the in-canvas AI assist endpoints.
 *
 * Unlike the worker's generate/refine path (which is async, job-based, and uses
 * the heavy provider SDKs), the in-canvas text-ops need a single round-trip that
 * returns the result inline. We therefore do a small fetch-based call per
 * provider — OpenAI (`/v1/chat/completions`), Anthropic (`/v1/messages`), Gemini
 * (`generateContent`) — rather than pulling the SDKs into the API. Node 24 ships
 * a global `fetch`, so there are no new dependencies.
 *
 * `AI_MOCK=true` short-circuits every call: callers pass a deterministic
 * `mock()` fn so the whole feature works offline with no BYOK key.
 *
 * Provider/network failures are surfaced as a clean 400 (BadRequestException)
 * with a helpful message — never a raw 500.
 */

const ANTHROPIC_MODEL = "claude-opus-4-8";
const OPENAI_MODEL = "gpt-4o";
const GEMINI_MODEL = "gemini-1.5-pro";

export interface LlmCall {
  /** System / instruction text. */
  system: string;
  /** The user content (already prompt-injection-isolated by the caller). */
  user: string;
  /** Hard output cap — text-ops are low-token; section generation is larger. */
  maxTokens: number;
  /** Optional base64 image (data only) for vision calls (alt-text). */
  image?: { mediaType: string; dataBase64: string };
}

/** Mock-aware single-shot completion. Returns the model's raw text. */
export async function llmComplete(
  provider: AiProvider,
  apiKey: string | null,
  call: LlmCall,
  mock: () => string,
): Promise<string> {
  if (process.env.AI_MOCK === "true") return mock();

  if (!apiKey) {
    throw new BadRequestException(
      `No ${provider} API key configured. Add an AI key in Settings, then try again.`,
    );
  }

  try {
    switch (provider) {
      case "claude":
        return await callAnthropic(apiKey, call);
      case "openai":
        return await callOpenAi(apiKey, call);
      case "gemini":
        return await callGemini(apiKey, call);
      default:
        throw new BadRequestException(`Unsupported AI provider "${provider}".`);
    }
  } catch (e) {
    if (e instanceof BadRequestException) throw e;
    const msg = e instanceof Error ? e.message : "AI provider request failed";
    throw new BadRequestException(`AI request failed: ${msg}`);
  }
}

// ---- Anthropic ------------------------------------------------------------

async function callAnthropic(apiKey: string, call: LlmCall): Promise<string> {
  const content: unknown[] = [];
  if (call.image) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: call.image.mediaType,
        data: call.image.dataBase64,
      },
    });
  }
  content.push({ type: "text", text: call.user });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: call.maxTokens,
      system: call.system,
      messages: [{ role: "user", content }],
    }),
  });
  if (!res.ok) throw new Error(await providerError(res));
  const body = (await res.json()) as {
    stop_reason?: string;
    content?: { type: string; text?: string }[];
  };
  if (body.stop_reason === "refusal") {
    throw new BadRequestException("The AI declined this request.");
  }
  return (body.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");
}

// ---- OpenAI ---------------------------------------------------------------

async function callOpenAi(apiKey: string, call: LlmCall): Promise<string> {
  const userContent: unknown = call.image
    ? [
        { type: "text", text: call.user },
        {
          type: "image_url",
          image_url: {
            url: `data:${call.image.mediaType};base64,${call.image.dataBase64}`,
          },
        },
      ]
    : call.user;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      max_tokens: call.maxTokens,
      messages: [
        { role: "system", content: call.system },
        { role: "user", content: userContent },
      ],
    }),
  });
  if (!res.ok) throw new Error(await providerError(res));
  const body = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return body.choices?.[0]?.message?.content ?? "";
}

// ---- Gemini ---------------------------------------------------------------

async function callGemini(apiKey: string, call: LlmCall): Promise<string> {
  const parts: unknown[] = [{ text: call.user }];
  if (call.image) {
    parts.push({
      inline_data: { mime_type: call.image.mediaType, data: call.image.dataBase64 },
    });
  }
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent` +
    `?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: call.system }] },
      contents: [{ role: "user", parts }],
      generationConfig: { maxOutputTokens: call.maxTokens },
    }),
  });
  if (!res.ok) throw new Error(await providerError(res));
  const body = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  return (
    body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? ""
  );
}

/** Extract a short provider error message from a non-2xx response. */
async function providerError(res: Response): Promise<string> {
  let detail = "";
  try {
    const j = (await res.json()) as { error?: { message?: string } | string };
    detail =
      typeof j.error === "string" ? j.error : j.error?.message ?? "";
  } catch {
    /* non-JSON body */
  }
  return `provider returned ${res.status}${detail ? ` — ${detail}` : ""}`;
}
