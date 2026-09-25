import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { TEMPLATE_SKELETON_STORAGE, type TemplateSkeletonRecord, type TemplateSkeletonStorage } from "@ob-cms/template-registry";
import {
  TemplateSkeletonVersionRepository,
  type TemplateSkeletonVersionDetail,
  type TemplateSkeletonVersionSummary,
} from "./template-skeleton-version.repository";

@Injectable()
export class TemplateSkeletonVersionService {
  constructor(
    private readonly versions: TemplateSkeletonVersionRepository,
    @Inject(TEMPLATE_SKELETON_STORAGE)
    private readonly storage: TemplateSkeletonStorage,
  ) {}

  async appendIfChanged(
    record: TemplateSkeletonRecord,
    createdBy?: string | null,
  ): Promise<boolean> {
    return this.versions.appendIfChanged(record, createdBy);
  }

  async listHistory(skeletonId: string): Promise<TemplateSkeletonVersionSummary[]> {
    await this.requireSkeleton(skeletonId);
    return this.versions.listBySkeletonId(skeletonId);
  }

  async getVersion(skeletonId: string, version: string): Promise<TemplateSkeletonVersionDetail> {
    await this.requireSkeleton(skeletonId);
    const row = await this.versions.findBySkeletonIdAndVersion(skeletonId, version);
    if (!row) {
      throw new NotFoundException(`Template skeleton version not found: ${version}`);
    }
    return row;
  }

  private async requireSkeleton(skeletonId: string): Promise<TemplateSkeletonRecord> {
    const skeleton = await this.storage.findById(skeletonId);
    if (!skeleton) throw new NotFoundException("Template skeleton not found");
    return skeleton;
  }
}

export type { TemplateSkeletonVersionDetail, TemplateSkeletonVersionSummary };
