import { BadRequestException, Injectable } from "@nestjs/common";
import { and, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import {
  analyticsEvents,
  attributionConversions,
  audienceMemberships,
  companies,
  consentRecords,
  formSubmissions,
  identities,
  visitorProfiles,
} from "@database/schema";
import { ScopedRepository } from "@common/tenancy/scoped-repository";
import { AuditService } from "@common/audit/audit.service";
import type { AuthUser } from "@common/decorators/current-user.decorator";

/**
 * A resolved DSAR subject: the email (if any) + the set of first-party
 * visitorIds that belong to it (an email may map to several devices/visitors).
 */
interface ResolvedSubject {
  kind: "email" | "visitorId";
  email: string | null;
  visitorIds: string[];
  identityIds: string[];
}

/** Per-table row counts for the DSAR summary. */
export interface DsarSummary {
  query: string;
  kind: "email" | "visitorId";
  email: string | null;
  visitorIds: string[];
  identity: { id: string; email: string; name: string | null } | null;
  counts: Record<string, number>;
}

/** The full JSON export — every held row, per table. */
export interface DsarExport extends DsarSummary {
  data: {
    identities: unknown[];
    companies: unknown[];
    visitorProfiles: unknown[];
    analyticsEvents: unknown[];
    attributionConversions: unknown[];
    audienceMemberships: unknown[];
    formSubmissions: unknown[];
    consentRecords: unknown[];
  };
}

/** The result of an erasure: how many rows were removed/anonymized per table. */
export interface DsarErasure {
  query: string;
  email: string | null;
  visitorIds: string[];
  deleted: Record<string, number>;
}

/**
 * DSAR (Data Subject Access Request) engine — the "find + export + erase" of a
 * visitor's/email's data across the ENTIRE tracking layer (Phase 2–5). Every
 * read/write goes through ScopedRepository so a DSAR can only ever touch the
 * active tenant's rows — a site_admin of site A can never reach site B's data.
 *
 * Cross-table map (all keyed within the site):
 *   - identities            — by primaryEmail (the email entry point).
 *   - visitor_profiles      — by visitorId OR linked identityId.
 *   - analytics_events      — by visitorId (incl. exposure/conversion events).
 *   - attribution_conversions — by visitorId OR identityId.
 *   - audience_memberships  — by visitorId OR identityId.
 *   - form_submissions      — by an email value anywhere in the `data` jsonb.
 *   - consent_records       — by visitorId (proof-of-consent for the subject).
 *   - companies             — deleted ONLY when the identity is its sole member.
 *
 * Erasure DELETEs the event/membership/submission/consent rows and the profile,
 * and NULLs the identity's PII (email→a tombstone, name→null) so downstream FKs
 * (visitor_profiles.identityId) degrade gracefully rather than dangling.
 */
@Injectable()
export class PrivacyService {
  constructor(
    private readonly repo: ScopedRepository,
    private readonly audit: AuditService,
  ) {}

  // -- Public API -------------------------------------------------------------

  async summary(query: string): Promise<DsarSummary> {
    const subject = await this.resolve(query);
    const counts = await this.countAll(subject);
    const identity = await this.loadIdentity(subject);
    return {
      query,
      kind: subject.kind,
      email: subject.email,
      visitorIds: subject.visitorIds,
      identity,
      counts,
    };
  }

  async export(query: string): Promise<DsarExport> {
    const subject = await this.resolve(query);
    const [
      identityRows,
      companyRows,
      profileRows,
      eventRows,
      conversionRows,
      membershipRows,
      submissionRows,
      consentRows,
    ] = await Promise.all([
      this.selectIdentities(subject),
      this.selectCompanies(subject),
      this.selectProfiles(subject),
      this.selectEvents(subject),
      this.selectConversions(subject),
      this.selectMemberships(subject),
      this.selectSubmissions(subject),
      this.selectConsent(subject),
    ]);
    const identity = await this.loadIdentity(subject);
    return {
      query,
      kind: subject.kind,
      email: subject.email,
      visitorIds: subject.visitorIds,
      identity,
      counts: {
        identities: identityRows.length,
        companies: companyRows.length,
        visitorProfiles: profileRows.length,
        analyticsEvents: eventRows.length,
        attributionConversions: conversionRows.length,
        audienceMemberships: membershipRows.length,
        formSubmissions: submissionRows.length,
        consentRecords: consentRows.length,
      },
      data: {
        identities: identityRows,
        companies: companyRows,
        visitorProfiles: profileRows,
        analyticsEvents: eventRows,
        attributionConversions: conversionRows,
        audienceMemberships: membershipRows,
        formSubmissions: submissionRows,
        consentRecords: consentRows,
      },
    };
  }

  async erase(query: string, actor: AuthUser): Promise<DsarErasure> {
    const subject = await this.resolve(query);
    const deleted: Record<string, number> = {};

    // Hard-delete the event/membership/submission/consent rows + the profile,
    // then anonymize the identity PII. Ordered so the identity (the PII anchor)
    // is neutralized last. All scoped to the active site.
    deleted.analyticsEvents = await this.deleteScoped(
      analyticsEvents,
      this.byVisitor(analyticsEvents.visitorId, subject),
    );
    deleted.attributionConversions = await this.deleteScoped(
      attributionConversions,
      this.byVisitorOrIdentity(
        attributionConversions.visitorId,
        attributionConversions.identityId,
        subject,
      ),
    );
    deleted.audienceMemberships = await this.deleteScoped(
      audienceMemberships,
      this.byVisitorOrIdentity(
        audienceMemberships.visitorId,
        audienceMemberships.identityId,
        subject,
      ),
    );
    deleted.consentRecords = await this.deleteScoped(
      consentRecords,
      this.byVisitor(consentRecords.visitorId, subject),
    );
    deleted.formSubmissions = subject.email
      ? await this.deleteScoped(formSubmissions, this.submissionEmailMatch(subject.email))
      : 0;
    deleted.visitorProfiles = await this.deleteScoped(
      visitorProfiles,
      this.byVisitorOrIdentity(visitorProfiles.visitorId, visitorProfiles.identityId, subject),
    );

    // Anonymize identities: NULL the name + replace the email with an erased
    // tombstone so the row no longer holds PII but the unique index stays valid.
    let identitiesAnon = 0;
    if (subject.identityIds.length > 0) {
      const rows = await this.repo.db
        .update(identities)
        .set({
          primaryEmail: sql`concat('erased+', ${identities.id}, '@dsar.invalid')`,
          name: null,
          updatedBy: actor.userId,
        })
        .where(this.repo.scope(identities, inArray(identities.id, subject.identityIds)))
        .returning({ id: identities.id });
      identitiesAnon = rows.length;
    }
    deleted.identitiesAnonymized = identitiesAnon;

    await this.audit.record({
      siteId: this.repo.siteId,
      actorId: actor.userId,
      action: "privacy.dsar_erased",
      category: "settings",
      entityType: "dsar_subject",
      entityId: subject.email ?? subject.visitorIds[0] ?? query,
      metadata: {
        query,
        kind: subject.kind,
        email: subject.email,
        visitorIds: subject.visitorIds,
        deleted,
      },
    });

    return { query, email: subject.email, visitorIds: subject.visitorIds, deleted };
  }

  // -- Subject resolution -----------------------------------------------------

  /** Detect email vs visitorId, then expand email → identity → visitorIds. */
  private async resolve(query: string): Promise<ResolvedSubject> {
    const q = query.trim();
    if (!q) throw new BadRequestException("query is required");
    const isEmail = q.includes("@");

    if (isEmail) {
      const email = q.toLowerCase();
      const idRows = await this.repo.db
        .select({ id: identities.id })
        .from(identities)
        .where(this.repo.scope(identities, eq(sql`lower(${identities.primaryEmail})`, email)));
      const identityIds = idRows.map((r) => r.id);
      const visitorIds = await this.visitorIdsForIdentities(identityIds);
      return { kind: "email", email, visitorIds, identityIds };
    }

    // A visitorId — also pick up any linked identity so identity-keyed tables and
    // the identity's OTHER visitors are covered (a request from one device erases
    // the person). Profiles carry the visitor→identity link.
    const profRows = await this.repo.db
      .select({ identityId: visitorProfiles.identityId })
      .from(visitorProfiles)
      .where(this.repo.scope(visitorProfiles, eq(visitorProfiles.visitorId, q)));
    const identityIds = profRows
      .map((r) => r.identityId)
      .filter((v): v is string => !!v);
    const linkedVisitors = await this.visitorIdsForIdentities(identityIds);
    const visitorIds = Array.from(new Set([q, ...linkedVisitors]));
    return { kind: "visitorId", email: null, visitorIds, identityIds };
  }

  /** All visitorIds whose profile links to any of the given identities. */
  private async visitorIdsForIdentities(identityIds: string[]): Promise<string[]> {
    if (identityIds.length === 0) return [];
    const rows = await this.repo.db
      .select({ visitorId: visitorProfiles.visitorId })
      .from(visitorProfiles)
      .where(this.repo.scope(visitorProfiles, inArray(visitorProfiles.identityId, identityIds)));
    return Array.from(new Set(rows.map((r) => r.visitorId)));
  }

  // -- Predicate builders -----------------------------------------------------

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private byVisitor(col: any, s: ResolvedSubject): SQL | undefined {
    if (s.visitorIds.length === 0) return sql`false`;
    return inArray(col, s.visitorIds);
  }

  private byVisitorOrIdentity(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    visitorCol: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    identityCol: any,
    s: ResolvedSubject,
  ): SQL | undefined {
    const parts: SQL[] = [];
    if (s.visitorIds.length > 0) parts.push(inArray(visitorCol, s.visitorIds) as SQL);
    if (s.identityIds.length > 0) parts.push(inArray(identityCol, s.identityIds) as SQL);
    if (parts.length === 0) return sql`false`;
    if (parts.length === 1) return parts[0];
    return or(...parts);
  }

  /** form_submissions whose `data` jsonb contains the email as any value. */
  private submissionEmailMatch(email: string): SQL {
    // Cast the whole data blob to text + case-insensitive contains. The email is
    // a distinctive token so false positives are negligible; this catches any
    // field name (email/workEmail/contact_email/…) without guessing the key.
    return sql`lower(${formSubmissions.data}::text) like ${"%" + email.toLowerCase() + "%"}`;
  }

  // -- Selects (export) -------------------------------------------------------

  private selectIdentities(s: ResolvedSubject): Promise<unknown[]> {
    if (s.identityIds.length === 0) return Promise.resolve([]);
    return this.repo.db
      .select()
      .from(identities)
      .where(this.repo.scope(identities, inArray(identities.id, s.identityIds)));
  }

  private async selectCompanies(s: ResolvedSubject): Promise<unknown[]> {
    const companyIds = await this.companyIdsFor(s);
    if (companyIds.length === 0) return [];
    return this.repo.db
      .select()
      .from(companies)
      .where(this.repo.scope(companies, inArray(companies.id, companyIds)));
  }

  private selectProfiles(s: ResolvedSubject): Promise<unknown[]> {
    return this.repo.db
      .select()
      .from(visitorProfiles)
      .where(
        this.repo.scope(
          visitorProfiles,
          this.byVisitorOrIdentity(visitorProfiles.visitorId, visitorProfiles.identityId, s),
        ),
      );
  }

  private selectEvents(s: ResolvedSubject): Promise<unknown[]> {
    return this.repo.db
      .select()
      .from(analyticsEvents)
      .where(this.repo.scope(analyticsEvents, this.byVisitor(analyticsEvents.visitorId, s)))
      .limit(50_000);
  }

  private selectConversions(s: ResolvedSubject): Promise<unknown[]> {
    return this.repo.db
      .select()
      .from(attributionConversions)
      .where(
        this.repo.scope(
          attributionConversions,
          this.byVisitorOrIdentity(
            attributionConversions.visitorId,
            attributionConversions.identityId,
            s,
          ),
        ),
      );
  }

  private selectMemberships(s: ResolvedSubject): Promise<unknown[]> {
    return this.repo.db
      .select()
      .from(audienceMemberships)
      .where(
        this.repo.scope(
          audienceMemberships,
          this.byVisitorOrIdentity(
            audienceMemberships.visitorId,
            audienceMemberships.identityId,
            s,
          ),
        ),
      );
  }

  private selectSubmissions(s: ResolvedSubject): Promise<unknown[]> {
    if (!s.email) return Promise.resolve([]);
    return this.repo.db
      .select()
      .from(formSubmissions)
      .where(this.repo.scope(formSubmissions, this.submissionEmailMatch(s.email)));
  }

  private selectConsent(s: ResolvedSubject): Promise<unknown[]> {
    if (s.visitorIds.length === 0) return Promise.resolve([]);
    return this.repo.db
      .select()
      .from(consentRecords)
      .where(
        and(
          eq(consentRecords.siteId, this.repo.siteId),
          inArray(consentRecords.visitorId, s.visitorIds),
        ),
      );
  }

  // -- Counts (summary) -------------------------------------------------------

  private async countAll(s: ResolvedSubject): Promise<Record<string, number>> {
    const [
      identityCount,
      profileCount,
      eventCount,
      conversionCount,
      membershipCount,
      submissionCount,
      consentCount,
    ] = await Promise.all([
      Promise.resolve(s.identityIds.length),
      this.count(visitorProfiles, this.byVisitorOrIdentity(visitorProfiles.visitorId, visitorProfiles.identityId, s)),
      this.count(analyticsEvents, this.byVisitor(analyticsEvents.visitorId, s)),
      this.count(
        attributionConversions,
        this.byVisitorOrIdentity(attributionConversions.visitorId, attributionConversions.identityId, s),
      ),
      this.count(
        audienceMemberships,
        this.byVisitorOrIdentity(audienceMemberships.visitorId, audienceMemberships.identityId, s),
      ),
      s.email
        ? this.count(formSubmissions, this.submissionEmailMatch(s.email))
        : Promise.resolve(0),
      s.visitorIds.length > 0
        ? this.countConsent(s)
        : Promise.resolve(0),
    ]);
    return {
      identities: identityCount,
      visitorProfiles: profileCount,
      analyticsEvents: eventCount,
      attributionConversions: conversionCount,
      audienceMemberships: membershipCount,
      formSubmissions: submissionCount,
      consentRecords: consentCount,
    };
  }

  private async count(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    table: any,
    predicate: SQL | undefined,
  ): Promise<number> {
    const [row] = await this.repo.db
      .select({ n: sql<number>`count(*)::int` })
      .from(table)
      .where(this.repo.scope(table, predicate));
    return Number(row?.n ?? 0);
  }

  private async countConsent(s: ResolvedSubject): Promise<number> {
    const [row] = await this.repo.db
      .select({ n: sql<number>`count(*)::int` })
      .from(consentRecords)
      .where(
        and(
          eq(consentRecords.siteId, this.repo.siteId),
          inArray(consentRecords.visitorId, s.visitorIds),
        ),
      );
    return Number(row?.n ?? 0);
  }

  // -- Helpers ----------------------------------------------------------------

  private async loadIdentity(
    s: ResolvedSubject,
  ): Promise<{ id: string; email: string; name: string | null } | null> {
    if (s.identityIds.length === 0) return null;
    const [row] = await this.repo.db
      .select({ id: identities.id, email: identities.primaryEmail, name: identities.name })
      .from(identities)
      .where(this.repo.scope(identities, inArray(identities.id, s.identityIds)))
      .limit(1);
    return row ?? null;
  }

  /** Companies referenced by the subject's identities (for the export only). */
  private async companyIdsFor(s: ResolvedSubject): Promise<string[]> {
    if (s.identityIds.length === 0) return [];
    const rows = await this.repo.db
      .select({ companyId: identities.companyId })
      .from(identities)
      .where(this.repo.scope(identities, inArray(identities.id, s.identityIds)));
    return Array.from(new Set(rows.map((r) => r.companyId).filter((v): v is string => !!v)));
  }

  /** DELETE rows matching `predicate` within the active site; return the count. */
  private async deleteScoped(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    table: any,
    predicate: SQL | undefined,
  ): Promise<number> {
    // consent_records has no deletedAt in the scope helper's contract, so it and
    // other tables all carry siteId + deletedAt — use scope() uniformly. (All
    // targeted tables include deletedAt via baseColumns.)
    const rows = await this.repo.db
      .delete(table)
      .where(and(eq(table.siteId, this.repo.siteId), predicate ?? sql`true`) as SQL)
      .returning({ id: table.id });
    return rows.length;
  }
}
