import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { deserializeLayout } from "@ob-cms/block-schema";
import {
  TEMPLATE_SKELETON_STORAGE,
  TemplateSkeletonStorageError,
  TemplateSkeletonValidationError,
  parseCreateTemplateSkeletonInput,
  parseTemplateSkeletonListQuery,
  parseUpdateTemplateSkeletonInput,
  type CreateTemplateSkeletonInput,
  type TemplateSkeletonListQuery,
  type TemplateSkeletonRecord,
  type TemplateSkeletonStorage,
  type UpdateTemplateSkeletonInput,
} from "@ob-cms/template-registry";
import type { AuthUser } from "@common/decorators/current-user.decorator";
import { TemplateSkeletonVersionService } from "./template-skeleton-version.service";

/** Template skeleton domain service — validation, storage delegation, error mapping. */
@Injectable()
export class TemplateSkeletonsService {
  constructor(
    @Inject(TEMPLATE_SKELETON_STORAGE)
    private readonly storage: TemplateSkeletonStorage,
    private readonly versions: TemplateSkeletonVersionService,
  ) {}

  list(rawQuery: unknown): Promise<TemplateSkeletonRecord[]> {
    const query = this.parseListQuery(rawQuery);
    return this.storage.list(query);
  }

  getById(id: string): Promise<TemplateSkeletonRecord> {
    return this.requireById(id);
  }

  getByKey(templateKey: string): Promise<TemplateSkeletonRecord> {
    return this.requireByKey(templateKey);
  }

  async create(raw: unknown, actor: AuthUser): Promise<TemplateSkeletonRecord> {
    const input = this.parseCreate(raw);
    input.content.layout = this.normalizeLayout(input.content.layout);
    try {
      return await this.storage.create(input, actor.userId);
    } catch (err) {
      throw this.mapStorageError(err);
    }
  }

  async update(
    id: string,
    raw: unknown,
    actor: AuthUser,
  ): Promise<TemplateSkeletonRecord> {
    const input = this.parseUpdate(raw);
    if (input.content?.layout !== undefined) {
      input.content.layout = this.normalizeLayout(input.content.layout);
    }
    try {
      return await this.storage.update(id, input, actor.userId);
    } catch (err) {
      throw this.mapStorageError(err);
    }
  }

  async remove(id: string, actor: AuthUser): Promise<{ ok: true }> {
    try {
      await this.storage.delete(id, actor.userId);
      return { ok: true };
    } catch (err) {
      throw this.mapStorageError(err);
    }
  }

  private async requireById(id: string): Promise<TemplateSkeletonRecord> {
    try {
      const row = await this.storage.findById(id);
      if (!row) throw new NotFoundException("Template skeleton not found");
      return row;
    } catch (err) {
      throw this.mapStorageError(err);
    }
  }

  private async requireByKey(templateKey: string): Promise<TemplateSkeletonRecord> {
    try {
      const row = await this.storage.findByKey(templateKey);
      if (!row) throw new NotFoundException("Template skeleton not found");
      return row;
    } catch (err) {
      throw this.mapStorageError(err);
    }
  }

  private normalizeLayout(layout: Record<string, unknown>): Record<string, unknown> {
    try {
      const normalized = deserializeLayout(JSON.stringify(layout));
      return normalized as unknown as Record<string, unknown>;
    } catch (err) {
      throw new BadRequestException(`Invalid layout: ${(err as Error).message}`);
    }
  }

  private parseCreate(raw: unknown): CreateTemplateSkeletonInput {
    try {
      return parseCreateTemplateSkeletonInput(raw);
    } catch (err) {
      if (err instanceof TemplateSkeletonValidationError) {
        throw new BadRequestException(this.formatValidationMessage(err));
      }
      throw err;
    }
  }

  private parseUpdate(raw: unknown): UpdateTemplateSkeletonInput {
    try {
      return parseUpdateTemplateSkeletonInput(raw);
    } catch (err) {
      if (err instanceof TemplateSkeletonValidationError) {
        throw new BadRequestException(this.formatValidationMessage(err));
      }
      throw err;
    }
  }

  private parseListQuery(raw: unknown): TemplateSkeletonListQuery {
    try {
      return parseTemplateSkeletonListQuery(raw);
    } catch (err) {
      if (err instanceof TemplateSkeletonValidationError) {
        throw new BadRequestException(this.formatValidationMessage(err));
      }
      throw err;
    }
  }

  private formatValidationMessage(err: TemplateSkeletonValidationError): string {
    const detail = err.issues.map((i) => i.message).join("; ");
    return `${err.message}: ${detail}`;
  }

  private mapStorageError(err: unknown): never {
    if (err instanceof NotFoundException) throw err;
    if (err instanceof BadRequestException) throw err;
    if (err instanceof TemplateSkeletonStorageError) {
      if (err.code === "NOT_FOUND") throw new NotFoundException(err.message);
      if (err.code === "DUPLICATE_KEY") throw new ConflictException(err.message);
      throw new BadRequestException(err.message);
    }
    throw err;
  }
}
