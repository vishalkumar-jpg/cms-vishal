import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from "@nestjs/common";
import { and, eq, isNull } from "drizzle-orm";
import { DRIZZLE } from "@database/drizzle.providers";
import type { Database } from "@database/db";
import { forms } from "@database/schema";
import { SiteResolver } from "@modules/seo/site-resolver.service";
import { StorageService } from "@modules/media/storage.service";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB per form-upload field
const ALLOWED_MIME =
  /^(image\/(png|jpe?g|gif|webp|svg\+xml)|application\/pdf|text\/(plain|csv)|application\/(msword|vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet)))$/i;

/**
 * Public presign for a FORM file-upload field (FORMS-ADVANCED §file-upload).
 * Mirrors the media presign path (browser PUTs directly to S3/MinIO) but is
 * @Public + host-resolved: the form must be published for the resolved site, the
 * content-type is allow-listed, and the key is namespaced under the tenant +
 * `form-uploads/`. The browser uploads, then submits the returned public URL as
 * the field's value (stored verbatim in the submission data). No DB media row is
 * created — these are lead attachments, not library assets.
 */
@Injectable()
export class PublicFormUploadService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly resolver: SiteResolver,
    private readonly storage: StorageService,
  ) {}

  async presign(
    host: string | undefined,
    formId: string,
    input: { filename: string; contentType: string; size?: number },
  ): Promise<{ uploadUrl: string; fileUrl: string; key: string }> {
    if (input.size != null && input.size > MAX_UPLOAD_BYTES) {
      throw new PayloadTooLargeException("File exceeds the 10 MB limit");
    }
    if (!ALLOWED_MIME.test(input.contentType)) {
      throw new BadRequestException("Unsupported file type");
    }

    const site = await this.resolver.resolve(host);
    if (!site) throw new NotFoundException("Site not found for host");
    const [form] = await this.db
      .select({ id: forms.id })
      .from(forms)
      .where(
        and(
          eq(forms.id, formId),
          eq(forms.siteId, site.id),
          eq(forms.status, "published"),
          isNull(forms.deletedAt),
        ),
      )
      .limit(1);
    if (!form) throw new NotFoundException("Form not found");

    const key = this.storage.buildKey(site.id, `form-uploads/${input.filename}`);
    const uploadUrl = await this.storage.presignUpload(
      key,
      input.contentType,
      900,
      "privateFormAttachments",
    );
    // Shared mode keeps a stable public URL (legacy). Isolated private buckets
    // have no public base — fall back to a short-lived presigned GET.
    const fileUrl = await this.storage.resolveObjectUrl(key, "privateFormAttachments");
    return { uploadUrl, fileUrl, key };
  }
}
