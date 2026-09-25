import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { eq } from "drizzle-orm";
import {
  aiGenerationJobs,
  aiProviderKeys,
  pages,
  type AiGenerationJobRow,
  type AiProvider,
  type AiProviderKeyRow,
} from "@database/schema";
import { ScopedRepository } from "@common/tenancy/scoped-repository";
import { AuditService } from "@common/audit/audit.service";
import type { AuthUser } from "@common/decorators/current-user.decorator";
import { QueueService } from "@modules/queue/queue.service";
import type { SerializedLayout } from "@ob-cms/block-schema";
import { EncryptionService } from "./encryption.service";
import { defaultModelFor, defaultProvider } from "./ai.constants";
import { llmComplete } from "./llm.helper";
import {
  buildTextSystemPrompt,
  buildTextUserMessage,
  mockAltText,
  mockTextTransform,
  toPlainText,
  type TextOpRequest,
} from "./text-ops";
import {
  buildSectionRepairMessage,
  buildSectionSystemPrompt,
  buildSectionUserMessage,
  mockSection,
  validateSection,
} from "./section-gen";
import type {
  AltTextDto,
  GenerateDto,
  RefineDto,
  SectionDto,
  SetAiKeyDto,
  TextOpDto,
} from "./dto/ai.dto";

/** Public (masked) view of a stored BYOK key — never exposes ciphertext. */
export interface MaskedKey {
  id: string;
  provider: string;
  label: string | null;
  keyHint: string;
  lastUsedAt: Date | null;
  createdAt: Date;
}

/**
 * AI copilot service (WAVE4a). Owns BYOK key storage (encrypted) and enqueues
 * schema-grounded generation jobs onto the `ai-generate` queue (the worker runs
 * the LLM + validation/repair + draft creation). All queries are tenant-scoped
 * via ScopedRepository; keys are decrypted only in the worker's provider call.
 */
@Injectable()
export class AiService {
  constructor(
    private readonly repo: ScopedRepository,
    private readonly audit: AuditService,
    private readonly queue: QueueService,
    private readonly encryption: EncryptionService,
  ) {}

  // ---- BYOK keys ----------------------------------------------------------

  async setKey(dto: SetAiKeyDto, actor: AuthUser): Promise<MaskedKey> {
    const encryptedKey = this.encryption.encrypt(dto.apiKey);
    const keyHint = this.encryption.mask(dto.apiKey);

    const existing = await this.repo.db
      .select()
      .from(aiProviderKeys)
      .where(this.repo.scope(aiProviderKeys, eq(aiProviderKeys.provider, dto.provider)))
      .limit(1);

    let row: AiProviderKeyRow;
    if (existing[0]) {
      [row] = await this.repo.db
        .update(aiProviderKeys)
        .set({
          encryptedKey,
          keyHint,
          label: dto.label ?? existing[0].label,
          updatedBy: actor.userId,
        })
        .where(this.repo.scope(aiProviderKeys, eq(aiProviderKeys.id, existing[0].id)))
        .returning();
    } else {
      [row] = await this.repo.db
        .insert(aiProviderKeys)
        .values({
          ...this.repo.insertDefaults(),
          provider: dto.provider,
          encryptedKey,
          keyHint,
          label: dto.label ?? null,
        })
        .returning();
    }

    await this.audit.record({
      siteId: this.repo.siteId,
      actorId: actor.userId,
      action: existing[0] ? "ai.key_rotated" : "ai.key_set",
      category: "settings",
      entityType: "ai_provider_key",
      entityId: row.id,
      metadata: { provider: dto.provider }, // never the key
    });
    return this.toMasked(row);
  }

  async listKeys(): Promise<MaskedKey[]> {
    const rows = await this.repo.db
      .select()
      .from(aiProviderKeys)
      .where(this.repo.scope(aiProviderKeys));
    return rows.map((r) => this.toMasked(r));
  }

  async deleteKey(provider: AiProvider, actor: AuthUser): Promise<{ deleted: boolean }> {
    const [row] = await this.repo.db
      .delete(aiProviderKeys)
      .where(this.repo.scope(aiProviderKeys, eq(aiProviderKeys.provider, provider)))
      .returning();
    if (!row) throw new NotFoundException("No key configured for that provider");
    await this.audit.record({
      siteId: this.repo.siteId,
      actorId: actor.userId,
      action: "ai.key_deleted",
      category: "settings",
      entityType: "ai_provider_key",
      entityId: row.id,
      metadata: { provider },
    });
    return { deleted: true };
  }

  // ---- Generation ---------------------------------------------------------

  async generate(dto: GenerateDto, actor: AuthUser): Promise<{ jobId: string; status: string }> {
    const provider = dto.provider ?? defaultProvider();
    const model = dto.model ?? defaultModelFor(provider);
    await this.assertProviderUsable(provider);

    if (dto.targetPageId) {
      // Verify the target page belongs to this tenant.
      await this.requirePage(dto.targetPageId);
    }

    const [row] = await this.repo.db
      .insert(aiGenerationJobs)
      .values({
        ...this.repo.insertDefaults(),
        prompt: dto.prompt,
        provider,
        model,
        status: "queued",
        targetPageId: dto.targetPageId ?? null,
      })
      .returning();

    await this.enqueue(row, actor);
    return { jobId: row.id, status: row.status };
  }

  async refine(dto: RefineDto, actor: AuthUser): Promise<{ jobId: string; status: string }> {
    const provider = dto.provider ?? defaultProvider();
    const model = dto.model ?? defaultModelFor(provider);
    await this.assertProviderUsable(provider);
    await this.requirePage(dto.pageId);

    const [row] = await this.repo.db
      .insert(aiGenerationJobs)
      .values({
        ...this.repo.insertDefaults(),
        prompt: dto.instruction,
        provider,
        model,
        status: "queued",
        targetPageId: dto.pageId,
      })
      .returning();

    await this.enqueue(row, actor);
    return { jobId: row.id, status: row.status };
  }

  async getJob(id: string): Promise<AiGenerationJobRow> {
    const [row] = await this.repo.db
      .select()
      .from(aiGenerationJobs)
      .where(this.repo.scope(aiGenerationJobs, eq(aiGenerationJobs.id, id)))
      .limit(1);
    if (!row) throw new NotFoundException("Generation job not found");
    return row;
  }

  // ---- In-canvas SYNC AI ops ----------------------------------------------
  //
  // These bypass the async worker/job path entirely: they make a single
  // fetch-based provider call (llm.helper) and return the result inline so the
  // builder can apply it immediately. BYOK key lookup + decrypt is shared; in
  // AI_MOCK mode no key is needed and a deterministic transform is returned.

  /** Transform a snippet of text (rewrite/shorten/expand/…). Returns plain text. */
  async textOp(dto: TextOpDto): Promise<{ text: string }> {
    const provider = dto.provider ?? defaultProvider();
    const apiKey = await this.resolveKey(provider);
    const req: TextOpRequest = {
      op: dto.op,
      text: dto.text.slice(0, 4000),
      tone: dto.tone,
      targetLang: dto.targetLang,
    };
    const raw = await llmComplete(
      provider,
      apiKey,
      {
        system: buildTextSystemPrompt(),
        user: buildTextUserMessage(req),
        maxTokens: 600,
      },
      () => mockTextTransform(req),
    );
    const text = toPlainText(raw);
    return { text: text || req.text };
  }

  /** Generate concise alt text for an image URL. */
  async altText(dto: AltTextDto): Promise<{ altText: string }> {
    const provider = dto.provider ?? defaultProvider();
    const apiKey = await this.resolveKey(provider);
    const raw = await llmComplete(
      provider,
      apiKey,
      {
        system:
          "You write concise, descriptive alt text for website images. Return ONLY the alt text (no quotes, no 'image of' boilerplate unless natural), under 125 characters.",
        user: `Write concise alt text for the image at this URL (infer from the filename/path if you cannot see it): ${dto.imageUrl}`,
        maxTokens: 120,
      },
      () => mockAltText(dto.imageUrl),
    );
    const altText = toPlainText(raw).slice(0, 200);
    return { altText: altText || mockAltText(dto.imageUrl) };
  }

  /**
   * Generate a single Section subtree from a prompt. Schema-grounded: the model
   * is given the live block catalog, output is hard-validated + repaired, and a
   * self-correction retry is attempted on failure so the result always renders.
   */
  async section(dto: SectionDto): Promise<{ layout: SerializedLayout }> {
    const provider = dto.provider ?? defaultProvider();

    if (process.env.AI_MOCK === "true") {
      return { layout: mockSection(dto.prompt) };
    }

    const apiKey = await this.resolveKey(provider);
    const system = buildSectionSystemPrompt();
    let user = buildSectionUserMessage(dto.prompt.slice(0, 2000), dto.context?.slice(0, 2000));

    let lastErrors: string[] = [];
    for (let attempt = 0; attempt < 2; attempt++) {
      const raw = await llmComplete(provider, apiKey, { system, user, maxTokens: 4000 }, () =>
        JSON.stringify(mockSection(dto.prompt)),
      );
      const result = validateSection(raw);
      if (result.ok && result.layout) return { layout: result.layout };
      lastErrors = result.errors;
      user = buildSectionRepairMessage(result.errors);
    }
    throw new BadRequestException(
      `The AI could not generate a valid section: ${lastErrors.slice(0, 3).join("; ")}`,
    );
  }

  /** Look up + decrypt the tenant's BYOK key for a provider (null in mock mode). */
  private async resolveKey(provider: AiProvider): Promise<string | null> {
    if (process.env.AI_MOCK === "true") return null;
    const [row] = await this.repo.db
      .select()
      .from(aiProviderKeys)
      .where(this.repo.scope(aiProviderKeys, eq(aiProviderKeys.provider, provider)))
      .limit(1);
    if (!row) {
      throw new BadRequestException(
        `No ${provider} API key configured. Add an AI key in Settings, then try again.`,
      );
    }
    return this.encryption.decrypt(row.encryptedKey);
  }

  // ---- internals ----------------------------------------------------------

  private async enqueue(row: AiGenerationJobRow, actor: AuthUser): Promise<void> {
    await this.queue.enqueueAiGenerate({
      jobId: row.id,
      siteId: this.repo.siteId,
      actorId: actor.userId,
    });
    await this.audit.record({
      siteId: this.repo.siteId,
      actorId: actor.userId,
      action: "ai.generation_requested",
      category: "content",
      entityType: "ai_generation_job",
      entityId: row.id,
      metadata: { provider: row.provider, model: row.model, targetPageId: row.targetPageId },
    });
  }

  /** In mock mode no real key is needed; otherwise require a stored key. */
  private async assertProviderUsable(provider: AiProvider): Promise<void> {
    if (process.env.AI_MOCK === "true") return;
    const [row] = await this.repo.db
      .select()
      .from(aiProviderKeys)
      .where(this.repo.scope(aiProviderKeys, eq(aiProviderKeys.provider, provider)))
      .limit(1);
    if (!row) {
      throw new BadRequestException(`No ${provider} API key configured. Set one via POST /api/ai/keys.`);
    }
  }

  private async requirePage(pageId: string): Promise<void> {
    const [row] = await this.repo.db
      .select({ id: pages.id })
      .from(pages)
      .where(this.repo.scope(pages, eq(pages.id, pageId)))
      .limit(1);
    if (!row) throw new NotFoundException("Page not found");
  }

  private toMasked(r: AiProviderKeyRow): MaskedKey {
    return {
      id: r.id,
      provider: r.provider,
      label: r.label,
      keyHint: r.keyHint,
      lastUsedAt: r.lastUsedAt,
      createdAt: r.createdAt,
    };
  }
}
