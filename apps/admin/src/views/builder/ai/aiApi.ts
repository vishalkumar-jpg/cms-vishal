import type { SerializedLayout } from "@ob-cms/block-schema";
import { request } from "@/services/AxiosService";

/**
 * Thin client for the in-canvas SYNC AI assist endpoints (api/modules/ai). These
 * return their result inline (unlike the async generate/refine job path), so the
 * builder can apply the transform immediately. `request` already unwraps the
 * `{ data }` envelope and injects the active-site header; baseURL includes /api.
 */

export type TextOp =
  | "rewrite"
  | "shorten"
  | "expand"
  | "fix-grammar"
  | "change-tone"
  | "translate";

export type Tone = "professional" | "friendly" | "bold" | "concise";

export interface TextOpBody {
  op: TextOp;
  text: string;
  tone?: Tone;
  targetLang?: string;
}

export const aiTextOp = (body: TextOpBody): Promise<{ text: string }> =>
  request<{ text: string }>({ url: "/ai/text", method: "post", data: body });

export const aiAltText = (imageUrl: string): Promise<{ altText: string }> =>
  request<{ altText: string }>({ url: "/ai/alt-text", method: "post", data: { imageUrl } });

export const aiSection = (
  prompt: string,
  context?: string,
): Promise<{ layout: SerializedLayout }> =>
  request<{ layout: SerializedLayout }>({
    url: "/ai/section",
    method: "post",
    data: { prompt, context },
  });

/** Best-effort, user-friendly message from an axios error (handles the API's 400 shape). */
export function aiErrorMessage(e: unknown): string {
  const err = e as { response?: { data?: { message?: string } }; message?: string };
  return (
    err?.response?.data?.message ||
    err?.message ||
    "AI request failed. Add an AI key in Settings, or try again."
  );
}
