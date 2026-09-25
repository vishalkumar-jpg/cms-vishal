import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { desc, eq } from "drizzle-orm";
import { isReservedRootSlug } from "@ob-cms/shared";
import { redirects, type RedirectRow } from "@database/schema";
import { AuditService } from "@common/audit/audit.service";
import { ScopedRepository } from "@common/tenancy/scoped-repository";
import type { AuthUser } from "@common/decorators/current-user.decorator";
import { parseCsv } from "@utils/csv.utils";
import { REDIRECT_CODES, type CreateRedirectDto, type UpdateRedirectDto } from "./dto/redirect.dto";

export interface ImportResult {
  created: number;
  updated: number;
  skipped: Array<{ fromPath: string; reason: string }>;
}

@Injectable()
export class RedirectsService {
  constructor(
    private readonly repo: ScopedRepository,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<RedirectRow[]> {
    return this.repo.db
      .select()
      .from(redirects)
      .where(this.repo.scope(redirects))
      .orderBy(desc(redirects.createdAt))
      .limit(2000);
  }

  async get(id: string): Promise<RedirectRow> {
    const [row] = await this.repo.db
      .select()
      .from(redirects)
      .where(this.repo.scope(redirects, eq(redirects.id, id)))
      .limit(1);
    if (!row) throw new NotFoundException("Redirect not found");
    return row;
  }

  async create(dto: CreateRedirectDto, actor: AuthUser): Promise<RedirectRow> {
    this.assertNotTrivialLoop(dto.fromPath, dto.toPath);
    this.assertFromPathNotReserved(dto.fromPath);
    await this.assertFromFree(dto.fromPath);
    await this.assertNoChainLoop(dto.fromPath, dto.toPath);
    const [row] = await this.repo.db
      .insert(redirects)
      .values({
        ...this.repo.insertDefaults(),
        fromPath: dto.fromPath,
        toPath: dto.toPath,
        statusCode: dto.statusCode ?? 301,
      })
      .returning();
    await this.recordAudit(actor, "redirect.created", row.id, { from: row.fromPath, to: row.toPath });
    return row;
  }

  async update(id: string, dto: UpdateRedirectDto, actor: AuthUser): Promise<RedirectRow> {
    const existing = await this.get(id);
    const fromPath = dto.fromPath ?? existing.fromPath;
    const toPath = dto.toPath ?? existing.toPath;
    this.assertNotTrivialLoop(fromPath, toPath);
    if (dto.fromPath && dto.fromPath !== existing.fromPath) {
      this.assertFromPathNotReserved(dto.fromPath);
      await this.assertFromFree(dto.fromPath, id);
    }
    await this.assertNoChainLoop(fromPath, toPath, id);
    const [row] = await this.repo.db
      .update(redirects)
      .set({
        fromPath,
        toPath,
        statusCode: dto.statusCode ?? existing.statusCode,
        updatedBy: actor.userId,
      })
      .where(this.repo.scope(redirects, eq(redirects.id, id)))
      .returning();
    await this.recordAudit(actor, "redirect.updated", id);
    return row;
  }

  async remove(id: string, actor: AuthUser): Promise<{ ok: true }> {
    await this.get(id);
    await this.repo.db
      .update(redirects)
      .set({ deletedAt: new Date(), updatedBy: actor.userId })
      .where(this.repo.scope(redirects, eq(redirects.id, id)));
    await this.recordAudit(actor, "redirect.deleted", id);
    return { ok: true };
  }

  /** Bulk CSV import: header fromPath,toPath,statusCode. Loop-safe + dedupes. */
  async importCsv(csv: string, actor: AuthUser): Promise<ImportResult> {
    const rows = parseCsv(csv);
    const result: ImportResult = { created: 0, updated: 0, skipped: [] };
    for (const r of rows) {
      const fromPath = (r.fromPath ?? r.from ?? "").trim();
      const toPath = (r.toPath ?? r.to ?? "").trim();
      const statusCode = Number(r.statusCode ?? r.status ?? 301);
      // Same destination safety as the DTO: /path or http(s) only — never a
      // javascript:/data: scheme in a Location header (XSS sink).
      const destOk = /^(\/[^\s]*|https?:\/\/[^\s]+)$/i.test(toPath);
      if (!fromPath.startsWith("/") || !toPath || !destOk) {
        result.skipped.push({ fromPath, reason: "invalid from/to path" });
        continue;
      }
      if (fromPath === toPath) {
        result.skipped.push({ fromPath, reason: "self-redirect loop" });
        continue;
      }
      try {
        this.assertFromPathNotReserved(fromPath);
      } catch {
        result.skipped.push({ fromPath, reason: "reserved system path" });
        continue;
      }
      const code = REDIRECT_CODES.includes(statusCode) ? statusCode : 301;
      try {
        await this.assertNoChainLoop(fromPath, toPath);
      } catch {
        result.skipped.push({ fromPath, reason: "redirect loop" });
        continue;
      }
      const [existing] = await this.repo.db
        .select({ id: redirects.id })
        .from(redirects)
        .where(this.repo.scope(redirects, eq(redirects.fromPath, fromPath)))
        .limit(1);
      if (existing) {
        await this.repo.db
          .update(redirects)
          .set({ toPath, statusCode: code, updatedBy: actor.userId })
          .where(this.repo.scope(redirects, eq(redirects.id, existing.id)));
        result.updated++;
      } else {
        await this.repo.db
          .insert(redirects)
          .values({ ...this.repo.insertDefaults(), fromPath, toPath, statusCode: code });
        result.created++;
      }
    }
    await this.recordAudit(actor, "redirect.imported", "bulk", {
      created: result.created,
      updated: result.updated,
      skipped: result.skipped.length,
    });
    return result;
  }

  // -- loop detection --------------------------------------------------------

  private assertNotTrivialLoop(fromPath: string, toPath: string): void {
    if (fromPath === toPath) throw new BadRequestException("A redirect cannot point to itself");
  }

  /**
   * Reject `fromPath`s that sit in front of the renderer's reserved namespaces
   * (RESERVED_ROOT_SLUGS in @ob-cms/shared). The public-site middleware applies
   * redirects BEFORE any file route, so a redirect from `/blog`, `/collect`,
   * `/identify` or `/__preview/...` would hijack the system route (blog index,
   * analytics collectors, preview); ones from `/api/*`, `/_next/*`,
   * `/sitemap.xml`, `/robots.txt` are excluded by the middleware matcher and
   * would silently never fire. Both are footguns → reject with a clear 400.
   *
   * EXCEPTION: deep paths under the content namespaces (`/blog/...`, `/c/...`)
   * are legitimate and common — e.g. redirecting an old blog-post or
   * collection-item URL after a slug change — so only their ROOT is blocked.
   */
  private assertFromPathNotReserved(fromPath: string): void {
    const segments = fromPath.split("/").filter(Boolean);
    const first = segments[0]?.toLowerCase();
    if (!first || !isReservedRootSlug(first)) return;
    if (segments.length > 1 && (first === "blog" || first === "c")) return;
    throw new BadRequestException(
      `'${fromPath}' is reserved for system routes (blog index, collections, feeds, preview, analytics, APIs) and cannot be redirected`,
    );
  }

  /**
   * Follow the would-be redirect chain (from → to → ...) through existing rules.
   * If it revisits a path already seen we'd create an infinite loop → reject.
   */
  private async assertNoChainLoop(fromPath: string, toPath: string, excludeId?: string): Promise<void> {
    const all = await this.repo.db
      .select({ id: redirects.id, fromPath: redirects.fromPath, toPath: redirects.toPath })
      .from(redirects)
      .where(this.repo.scope(redirects));
    const map = new Map<string, string>();
    for (const r of all) {
      if (r.id === excludeId) continue;
      map.set(r.fromPath, r.toPath);
    }
    map.set(fromPath, toPath); // include the candidate

    const seen = new Set<string>([fromPath]);
    let cursor = toPath;
    let hops = 0;
    while (map.has(cursor)) {
      if (seen.has(cursor) || hops++ > 50) {
        throw new BadRequestException("This redirect would create a loop");
      }
      seen.add(cursor);
      cursor = map.get(cursor) as string;
    }
  }

  private async assertFromFree(fromPath: string, excludeId?: string): Promise<void> {
    const [row] = await this.repo.db
      .select({ id: redirects.id })
      .from(redirects)
      .where(this.repo.scope(redirects, eq(redirects.fromPath, fromPath)))
      .limit(1);
    if (row && row.id !== excludeId) throw new ConflictException("A redirect for this path already exists");
  }

  private async recordAudit(
    actor: AuthUser,
    action: string,
    entityId: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.audit.record({
      siteId: this.repo.siteId,
      actorId: actor.userId,
      action,
      category: "settings",
      entityType: "redirect",
      entityId,
      metadata,
    });
  }
}
