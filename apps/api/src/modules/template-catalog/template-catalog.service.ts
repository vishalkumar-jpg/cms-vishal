import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  TEMPLATE_CATALOG_STORAGE,
  TemplateCatalogStorageError,
  TemplateCatalogValidationError,
  parseTemplateCatalogQuery,
  type TemplateCatalogEntry,
  type TemplateCatalogStorage,
} from "@ob-cms/template-registry";

/** Read-only template catalog service — query validation and storage delegation. */
@Injectable()
export class TemplateCatalogService {
  constructor(
    @Inject(TEMPLATE_CATALOG_STORAGE)
    private readonly storage: TemplateCatalogStorage,
  ) {}

  list(rawQuery: unknown): Promise<TemplateCatalogEntry[]> {
    const query = this.parseListQuery(rawQuery);
    return this.storage.list(query);
  }

  getById(id: string): Promise<TemplateCatalogEntry> {
    return this.requireById(id);
  }

  getByKey(templateKey: string): Promise<TemplateCatalogEntry> {
    return this.requireByKey(templateKey);
  }

  private async requireById(id: string): Promise<TemplateCatalogEntry> {
    try {
      const row = await this.storage.getById(id);
      if (!row) throw new NotFoundException("Template catalog entry not found");
      return row;
    } catch (err) {
      throw this.mapStorageError(err);
    }
  }

  private async requireByKey(templateKey: string): Promise<TemplateCatalogEntry> {
    try {
      const row = await this.storage.getByKey(templateKey);
      if (!row) throw new NotFoundException("Template catalog entry not found");
      return row;
    } catch (err) {
      throw this.mapStorageError(err);
    }
  }

  private parseListQuery(raw: unknown) {
    try {
      return parseTemplateCatalogQuery(raw);
    } catch (err) {
      if (err instanceof TemplateCatalogValidationError) {
        throw new BadRequestException(this.formatValidationMessage(err));
      }
      throw err;
    }
  }

  private formatValidationMessage(err: TemplateCatalogValidationError): string {
    const detail = err.issues.map((issue) => issue.message).join("; ");
    return `${err.message}: ${detail}`;
  }

  private mapStorageError(err: unknown): never {
    if (err instanceof NotFoundException) throw err;
    if (err instanceof BadRequestException) throw err;
    if (err instanceof TemplateCatalogStorageError) {
      if (err.code === "NOT_FOUND") throw new NotFoundException(err.message);
      throw new BadRequestException(err.message);
    }
    throw err;
  }
}
