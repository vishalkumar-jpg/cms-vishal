import { randomBytes } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, desc, eq, isNull } from "drizzle-orm";
import { hasRoleAtLeast, type Role } from "@ob-cms/shared";
import { DRIZZLE } from "@database/drizzle.providers";
import type { Database } from "@database/db";
import {
  siteInvitations,
  siteMembers,
  sites,
  systemUsers,
  type SiteInvitationRow,
} from "@database/schema";
import { getOsEnvOptional } from "@config/env.config";
import { AuditService } from "@common/audit/audit.service";
import { PasswordService } from "@common/auth/password.service";
import { TenantContext } from "@common/tenancy/tenant-context";
import { MailService } from "@common/mail/mail.service";
import type { AuthUser } from "@common/decorators/current-user.decorator";
import type { AcceptInvitationDto, CreateInvitationDto } from "./dto/invitation.dto";

/** +7 days, in ms. */
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Base for the public accept link. Documented as APP_PUBLIC_URL (default 5001). */
const appPublicUrl = (): string => getOsEnvOptional("APP_PUBLIC_URL") ?? "http://localhost:5001";

export interface InvitationView extends SiteInvitationRow {
  /** Convenience accept link (returned for dev/admin display). */
  acceptUrl: string;
}

export interface InvitationPreview {
  siteName: string;
  email: string;
  role: Role;
  expired: boolean;
}

/**
 * Email-based team invitations (governance). Site-scoped via TenantContext for
 * the management endpoints; the public preview/accept endpoints resolve the site
 * from the invite token directly (no active-site header).
 */
@Injectable()
export class InvitationsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly ctx: TenantContext,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    private readonly passwords: PasswordService,
  ) {}

  private withUrl(row: SiteInvitationRow): InvitationView {
    return { ...row, acceptUrl: `${appPublicUrl()}/accept-invite?token=${row.token}` };
  }

  /** Pending + historical invites for the active site, newest first. */
  async list(): Promise<InvitationView[]> {
    const siteId = this.ctx.requireSiteId();
    const rows = await this.db
      .select()
      .from(siteInvitations)
      .where(and(eq(siteInvitations.siteId, siteId), isNull(siteInvitations.deletedAt)))
      .orderBy(desc(siteInvitations.createdAt));
    return rows.map((r) => this.withUrl(r));
  }

  async create(dto: CreateInvitationDto, actor: AuthUser): Promise<InvitationView> {
    const siteId = this.ctx.requireSiteId();
    this.assertCeiling(dto.role as Role);
    const email = dto.email.toLowerCase();

    // Reject if the email already maps to an active member of this site.
    const [existingUser] = await this.db
      .select({ id: systemUsers.id })
      .from(systemUsers)
      .where(and(eq(systemUsers.email, email), isNull(systemUsers.deletedAt)))
      .limit(1);
    if (existingUser) {
      const [member] = await this.db
        .select({ id: siteMembers.id })
        .from(siteMembers)
        .where(
          and(
            eq(siteMembers.siteId, siteId),
            eq(siteMembers.userId, existingUser.id),
            isNull(siteMembers.deletedAt),
          ),
        )
        .limit(1);
      if (member) throw new ConflictException("That email is already a member of this site");
    }

    // Reject if an active pending invite already exists for (site, email).
    const existingInvite = await this.findPending(siteId, email);
    if (existingInvite) {
      throw new ConflictException("An active invitation already exists for that email");
    }

    const token = randomBytes(32).toString("hex");
    const [row] = await this.db
      .insert(siteInvitations)
      .values({
        siteId,
        email,
        role: dto.role,
        token,
        status: "pending",
        invitedBy: actor.userId,
        createdBy: actor.userId,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      })
      .returning();

    await this.audit.record({
      siteId,
      actorId: actor.userId,
      action: "team.invite_created",
      category: "team",
      entityType: "site_invitation",
      entityId: row.id,
      metadata: { email, role: dto.role },
    });

    await this.sendInviteEmail(this.withUrl(row));
    return this.withUrl(row);
  }

  async resend(id: string, actor: AuthUser): Promise<InvitationView> {
    const siteId = this.ctx.requireSiteId();
    const row = await this.findById(siteId, id);
    if (!row) throw new NotFoundException("Invitation not found");
    if (row.status !== "pending") {
      throw new BadRequestException("Only pending invitations can be resent");
    }
    // Extend the expiry so a resent invite is usable for another 7 days.
    const [updated] = await this.db
      .update(siteInvitations)
      .set({ expiresAt: new Date(Date.now() + INVITE_TTL_MS), updatedBy: actor.userId })
      .where(eq(siteInvitations.id, row.id))
      .returning();
    await this.audit.record({
      siteId,
      actorId: actor.userId,
      action: "team.invite_resent",
      category: "team",
      entityType: "site_invitation",
      entityId: row.id,
      metadata: { email: row.email },
    });
    const view = this.withUrl(updated);
    await this.sendInviteEmail(view);
    return view;
  }

  async revoke(id: string, actor: AuthUser): Promise<{ ok: true }> {
    const siteId = this.ctx.requireSiteId();
    const row = await this.findById(siteId, id);
    if (!row) throw new NotFoundException("Invitation not found");
    if (row.status === "accepted") {
      throw new BadRequestException("Cannot revoke an already-accepted invitation");
    }
    await this.db
      .update(siteInvitations)
      .set({ status: "revoked", updatedBy: actor.userId })
      .where(eq(siteInvitations.id, row.id));
    await this.audit.record({
      siteId,
      actorId: actor.userId,
      action: "team.invite_revoked",
      category: "team",
      entityType: "site_invitation",
      entityId: row.id,
      metadata: { email: row.email },
    });
    return { ok: true };
  }

  // -- public (token-resolved) --------------------------------------------

  /** Preview an invite by token (public). Never leaks token; safe-by-email. */
  async preview(token: string): Promise<InvitationPreview> {
    const row = await this.findByToken(token);
    if (!row) throw new NotFoundException("Invitation not found");
    const [site] = await this.db
      .select({ name: sites.name })
      .from(sites)
      .where(eq(sites.id, row.siteId))
      .limit(1);
    return {
      siteName: site?.name ?? "this website",
      email: row.email,
      role: row.role as Role,
      expired: this.isExpired(row),
    };
  }

  /**
   * Accept an invite by token (public). If a user with that email exists, attach
   * a membership; else create the user (reusing the bcrypt hash path) + membership.
   * Idempotent: re-accepting an already-accepted invite is a no-op success.
   */
  async accept(token: string, dto: AcceptInvitationDto): Promise<{ ok: true }> {
    const row = await this.findByToken(token);
    if (!row) throw new NotFoundException("Invitation not found");
    if (row.status === "accepted") return { ok: true }; // idempotent
    if (row.status === "revoked") throw new BadRequestException("This invitation was revoked");
    if (this.isExpired(row)) {
      // Mark expired so the UI/list reflects reality.
      await this.db
        .update(siteInvitations)
        .set({ status: "expired" })
        .where(eq(siteInvitations.id, row.id));
      throw new BadRequestException("This invitation has expired");
    }

    await this.db.transaction(async (tx) => {
      const txDb = tx as unknown as Database;
      // Find or create the user.
      const [existing] = await txDb
        .select({ id: systemUsers.id })
        .from(systemUsers)
        .where(and(eq(systemUsers.email, row.email), isNull(systemUsers.deletedAt)))
        .limit(1);

      let userId = existing?.id;
      if (!userId) {
        if (!dto.password) {
          throw new BadRequestException("A password is required to create your account");
        }
        const passwordHash = await this.passwords.hash(dto.password);
        const [created] = await txDb
          .insert(systemUsers)
          .values({ email: row.email, passwordHash, name: dto.name ?? null })
          .returning({ id: systemUsers.id });
        userId = created.id;
      }

      // Attach membership (skip if somehow already present).
      const [existingMember] = await txDb
        .select({ id: siteMembers.id })
        .from(siteMembers)
        .where(
          and(
            eq(siteMembers.siteId, row.siteId),
            eq(siteMembers.userId, userId),
            isNull(siteMembers.deletedAt),
          ),
        )
        .limit(1);
      if (!existingMember) {
        await txDb.insert(siteMembers).values({
          siteId: row.siteId,
          userId,
          role: row.role,
          invitedBy: row.invitedBy,
          createdBy: row.invitedBy,
        });
      }

      await txDb
        .update(siteInvitations)
        .set({ status: "accepted", acceptedAt: new Date() })
        .where(eq(siteInvitations.id, row.id));

      await this.audit.record(
        {
          siteId: row.siteId,
          actorId: userId,
          action: "team.invite_accepted",
          category: "team",
          entityType: "site_invitation",
          entityId: row.id,
          metadata: { email: row.email, role: row.role },
        },
        txDb,
      );
    });

    return { ok: true };
  }

  // -- helpers ------------------------------------------------------------

  private isExpired(row: SiteInvitationRow): boolean {
    return row.status === "expired" || row.expiresAt.getTime() <= Date.now();
  }

  /** A site_admin may not invite above their own level. */
  private assertCeiling(target: Role): void {
    if (!this.ctx.role) return; // platform admin
    if (!hasRoleAtLeast(this.ctx.role, target)) {
      throw new ForbiddenException("Cannot invite at a role above your own");
    }
  }

  private async findById(siteId: string, id: string): Promise<SiteInvitationRow | undefined> {
    const [row] = await this.db
      .select()
      .from(siteInvitations)
      .where(
        and(
          eq(siteInvitations.id, id),
          eq(siteInvitations.siteId, siteId),
          isNull(siteInvitations.deletedAt),
        ),
      )
      .limit(1);
    return row;
  }

  private async findPending(siteId: string, email: string): Promise<SiteInvitationRow | undefined> {
    const [row] = await this.db
      .select()
      .from(siteInvitations)
      .where(
        and(
          eq(siteInvitations.siteId, siteId),
          eq(siteInvitations.email, email),
          eq(siteInvitations.status, "pending"),
          isNull(siteInvitations.deletedAt),
        ),
      )
      .limit(1);
    return row;
  }

  private async findByToken(token: string): Promise<SiteInvitationRow | undefined> {
    const [row] = await this.db
      .select()
      .from(siteInvitations)
      .where(and(eq(siteInvitations.token, token), isNull(siteInvitations.deletedAt)))
      .limit(1);
    return row;
  }

  private async sendInviteEmail(view: InvitationView): Promise<void> {
    await this.mail.send({
      to: view.email,
      subject: "You've been invited to OB-CMS",
      html:
        `<p>You've been invited to join a website on OB-CMS as <strong>${view.role}</strong>.</p>` +
        `<p><a href="${view.acceptUrl}">Accept your invitation</a></p>` +
        `<p>This link expires on ${view.expiresAt.toISOString()}.</p>`,
      text: `Accept your OB-CMS invitation: ${view.acceptUrl}`,
    });
  }
}
