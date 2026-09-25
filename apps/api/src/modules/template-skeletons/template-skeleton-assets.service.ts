import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  TEMPLATE_SKELETON_ASSET_STORAGE,
  TemplateSkeletonAssetStorageError,
  TemplateSkeletonAssetValidationError,
  assertMimeMatchesAssetType,
  parseCreateTemplateSkeletonAssetInput,
  parseUpdateTemplateSkeletonAssetInput,
  type CreateTemplateSkeletonAssetInput,
  type TemplateSkeletonAssetRecord,
  type TemplateSkeletonAssetStorage,
  type UpdateTemplateSkeletonAssetInput,
} from "@ob-cms/template-registry";
import type { AuthUser } from "@common/decorators/current-user.decorator";
import { TemplateSkeletonsService } from "./template-skeletons.service";

/** Domain service for template skeleton preview assets — validation and storage delegation. */
@Injectable()
export class TemplateSkeletonAssetsService {
  constructor(
    @Inject(TEMPLATE_SKELETON_ASSET_STORAGE)
    private readonly storage: TemplateSkeletonAssetStorage,
    private readonly skeletons: TemplateSkeletonsService,
  ) {}

  async list(skeletonId: string): Promise<TemplateSkeletonAssetRecord[]> {
    await this.requireSkeleton(skeletonId);
    return this.storage.listBySkeleton(skeletonId);
  }

  async create(
    skeletonId: string,
    raw: unknown,
    actor: AuthUser,
  ): Promise<TemplateSkeletonAssetRecord> {
    await this.requireSkeleton(skeletonId);
    const input = this.parseCreate(raw);
    this.assertCompatibleMime(input.assetType, input.mimeType);
    try {
      return await this.storage.create(skeletonId, input, actor.userId);
    } catch (err) {
      throw this.mapStorageError(err);
    }
  }

  async update(
    skeletonId: string,
    assetId: string,
    raw: unknown,
    actor: AuthUser,
  ): Promise<TemplateSkeletonAssetRecord> {
    await this.requireSkeleton(skeletonId);
    const input = this.parseUpdate(raw);
    const existing = await this.requireAsset(skeletonId, assetId);
    if (input.mimeType !== undefined && input.mimeType !== null) {
      this.assertCompatibleMime(existing.assetType, input.mimeType);
    }
    try {
      return await this.storage.update(skeletonId, assetId, input, actor.userId);
    } catch (err) {
      throw this.mapStorageError(err);
    }
  }

  async remove(
    skeletonId: string,
    assetId: string,
    actor: AuthUser,
  ): Promise<{ ok: true }> {
    await this.requireSkeleton(skeletonId);
    try {
      await this.storage.delete(skeletonId, assetId, actor.userId);
      return { ok: true };
    } catch (err) {
      throw this.mapStorageError(err);
    }
  }

  private async requireSkeleton(skeletonId: string): Promise<void> {
    await this.skeletons.getById(skeletonId);
  }

  private async requireAsset(
    skeletonId: string,
    assetId: string,
  ): Promise<TemplateSkeletonAssetRecord> {
    try {
      const row = await this.storage.findById(skeletonId, assetId);
      if (!row) throw new NotFoundException("Template skeleton asset not found");
      return row;
    } catch (err) {
      throw this.mapStorageError(err);
    }
  }

  private parseCreate(raw: unknown): CreateTemplateSkeletonAssetInput {
    try {
      return parseCreateTemplateSkeletonAssetInput(raw);
    } catch (err) {
      if (err instanceof TemplateSkeletonAssetValidationError) {
        throw new BadRequestException(this.formatValidationMessage(err));
      }
      throw err;
    }
  }

  private parseUpdate(raw: unknown): UpdateTemplateSkeletonAssetInput {
    try {
      return parseUpdateTemplateSkeletonAssetInput(raw);
    } catch (err) {
      if (err instanceof TemplateSkeletonAssetValidationError) {
        throw new BadRequestException(this.formatValidationMessage(err));
      }
      throw err;
    }
  }

  private assertCompatibleMime(
    assetType: TemplateSkeletonAssetRecord["assetType"],
    mimeType: string | undefined,
  ): void {
    try {
      assertMimeMatchesAssetType(assetType, mimeType);
    } catch (err) {
      if (err instanceof TemplateSkeletonAssetValidationError) {
        throw new BadRequestException(this.formatValidationMessage(err));
      }
      throw err;
    }
  }

  private formatValidationMessage(err: TemplateSkeletonAssetValidationError): string {
    const detail = err.issues.map((issue) => issue.message).join("; ");
    return detail ? `${err.message}: ${detail}` : err.message;
  }

  private mapStorageError(err: unknown): never {
    if (err instanceof NotFoundException) throw err;
    if (err instanceof BadRequestException) throw err;
    if (err instanceof TemplateSkeletonAssetStorageError) {
      if (err.code === "NOT_FOUND" || err.code === "SKELETON_NOT_FOUND") {
        throw new NotFoundException(err.message);
      }
      if (err.code === "DUPLICATE_ASSET") {
        throw new ConflictException(err.message);
      }
      throw new BadRequestException(err.message);
    }
    throw err;
  }
}
