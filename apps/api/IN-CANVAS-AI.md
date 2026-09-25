# In-Canvas AI Assist

Magical, in-place AI for the page builder: select text and rewrite / shorten /
expand / fix-grammar / change-tone / translate it, auto-generate image alt-text,
and generate a whole section from a prompt — all without leaving the canvas.

This is the **SYNC** half of the AI module. The existing `generate` / `refine`
endpoints are async (they enqueue a job on the `ai-generate` queue and the
worker runs a schema-grounded LLM, polled via `GET /ai/jobs/:id`). In-canvas
assist instead returns the result **inline** in the HTTP response so the builder
can apply it immediately.

## How sync text-ops avoid the async worker path

The async path exists to do heavy, multi-step page generation (BYOK decrypt →
theme load → schema-grounded prompt → provider SDK → validate/repair → write a
DRAFT page) on a worker, decoupled from the request. In-canvas ops need a single
low-token round-trip with the answer in hand. So instead of pulling the
provider SDKs into the API, `AiService` makes a **small fetch-based LLM call**
(`llm.helper.ts`, Node 24 global `fetch`, no new deps) per provider:

- **Claude** → `POST https://api.anthropic.com/v1/messages`
- **OpenAI** → `POST https://api.openai.com/v1/chat/completions`
- **Gemini** → `POST .../v1beta/models/{model}:generateContent`

The same per-site BYOK key lookup + decrypt (`EncryptionService.decrypt`,
`ScopedRepository`-scoped) is reused; the result is returned directly from the
controller via `responseUtils`. No queue, no job row, no polling.

## Endpoints (all `@Roles("editor")`, tenant-scoped, rate-limited)

| Method/Path | Body | Returns |
|---|---|---|
| `POST /api/ai/text` | `{ op, text, tone?, targetLang?, provider? }` | `{ text }` (transformed, sanitized plain text) |
| `POST /api/ai/alt-text` | `{ imageUrl, provider? }` | `{ altText }` (concise alt description) |
| `POST /api/ai/section` | `{ prompt, context?, provider? }` | `{ layout }` (a `SerializedLayout` rooted at a canvas `Section`) |

`op` ∈ `rewrite | shorten | expand | fix-grammar | change-tone | translate`.
`tone` ∈ `professional | friendly | bold | concise` (for `change-tone`).
Input text is capped (4000 chars); output is sanitized to **plain text** (no
markdown fences, no HTML/scripts) via `sanitizeText` so it drops straight into a
block prop.

`POST /ai/section` is **schema-grounded**: the model is given the live block
catalog (derived from `@ob-cms/block-schema`'s zod schemas), and the output is
hard-validated against the registry + repaired (`section-gen.ts`,
`validateSection`). On a validation failure it does ONE self-correction retry
(feeding the errors back) so the returned layout always renders.

### Errors
Provider/network failures and a missing BYOK key produce a clean **400** with a
helpful message (e.g. _"No claude API key configured. Add an AI key in Settings,
then try again."_) — never a 500. A provider safety refusal also returns 400.

## Mock behavior — `AI_MOCK=true`

When `AI_MOCK=true`, every sync op short-circuits before any network call and
**no BYOK key is required**, so the whole feature works offline:

- `/ai/text` → a deterministic transform of the input (e.g. shorten halves the
  words; translate prefixes `[lang]`; change-tone appends `(tone)`).
- `/ai/alt-text` → a sensible placeholder derived from the URL filename
  (e.g. `Image of hero banner`).
- `/ai/section` → a simple themed hero + CTA Section preset, run through
  migrate/repair so it always renders.

## Provider / BYOK calls

Keys are stored encrypted per site (`aiProviderKeys`, AES-256-GCM envelope) and
decrypted only inside the provider call (`AiService.resolveKey`). The plaintext
key is never logged or returned. Provider/model defaults mirror `ai.constants.ts`
(Claude `claude-opus-4-8`, OpenAI `gpt-4o`, Gemini `gemini-1.5-pro`).

## Builder AI UX (apps/admin/src/views/builder)

- **Text AI popover** (`components/AiBlockMenu.tsx`): a floating **✨ AI** pill
  pinned to the selected block (top-left, mirroring the inline toolbar). For
  text blocks (Heading, Paragraph, Button, Hero Section, Section Heading) it
  offers Rewrite / Shorten / Expand / Fix grammar, a **Change tone** submenu and
  a **Translate** language submenu. The chosen op calls `/ai/text` with the
  block's current text and writes the result back via Craft's `setProp` — so it
  flows through autosave + undo/redo like any manual edit. Loading + toast.
- **Image alt-text**: when an `Image` block is selected, the same menu shows
  **Generate alt text** → `/ai/alt-text` → sets the `altText` prop.
- **Generate section** (`components/AiGenerateSectionDialog.tsx`): a floating
  **✨ Generate section** button over the canvas opens a prompt dialog →
  `/ai/section` → inserts each top-level child of the returned Section under the
  canvas ROOT using the same path as the Section Library
  (`layoutToCraft` → `buildTreeFromSerializedMap` → `addNodeTree`), which mints
  **fresh node ids** on insert, so the section is fully editable and never
  collides.

The text-prop mapping (which prop holds editable text per block) lives in
`ai/textProps.ts`; the typed `/ai/*` client in `ai/aiApi.ts` (routes through the
shared axios `request`, which injects the active-site header and unwraps the
`{ data }` envelope). Missing-key errors surface the API's message as a toast
("Add an AI key in Settings").

## Env

- `AI_MOCK=true` — offline, deterministic transforms; no BYOK key needed.
- `AI_DEFAULT_PROVIDER` — `claude` (default) | `openai` | `gemini`.
- `ENCRYPTION_KEY` / `KMS_DATA_KEY` — at-rest key for BYOK decryption (existing).
