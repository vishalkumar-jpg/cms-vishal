import { Module } from "@nestjs/common";
import { DatabaseModule } from "@database/database.module";
import { QueueModule } from "@modules/queue/queue.module";
import { RedisModule } from "@modules/redis/redis.module";
import { CommonModule } from "@common/common.module";
import { AuthModule } from "@modules/auth/auth.module";
import { OrganizationsModule } from "@modules/organizations/organizations.module";
import { SitesModule } from "@modules/sites/sites.module";
import { SiteMembersModule } from "@modules/site-members/site-members.module";
import { RolesModule } from "@modules/roles/roles.module";
import { InvitationsModule } from "@modules/invitations/invitations.module";
import { AuditModule } from "@modules/audit/audit.module";
import { PagesModule } from "@modules/pages/pages.module";
import { BlogModule } from "@modules/blog/blog.module";
import { MediaModule } from "@modules/media/media.module";
import { NavigationModule } from "@modules/navigation/navigation.module";
import { ThemesModule } from "@modules/themes/themes.module";
import { RedirectsModule } from "@modules/redirects/redirects.module";
import { TemplatesModule } from "@modules/templates/templates.module";
import { TemplateSkeletonsModule } from "@modules/template-skeletons/template-skeletons.module";
import { TemplateCatalogModule } from "@modules/template-catalog/template-catalog.module";
import { SeoModule } from "@modules/seo/seo.module";
import { FormsModule } from "@modules/forms/forms.module";
import { PublicModule } from "@modules/public/public.module";
import { AiModule } from "@modules/ai/ai.module";
import { SiteChromeModule } from "@modules/site-chrome/site-chrome.module";
import { ReusableBlocksModule } from "@modules/reusable-blocks/reusable-blocks.module";
import { CollectionsModule } from "@modules/collections/collections.module";
import { DomainsModule } from "@modules/domains/domains.module";
import { PlatformModule } from "@modules/platform/platform.module";
import { BackupsModule } from "@modules/backups/backups.module";
import { HubspotImportModule } from "@modules/hubspot-import/hubspot-import.module";
import { ConnectorsModule } from "@modules/connectors/connectors.module";
import { ContentApiModule } from "@modules/content-api/content-api.module";
import { WebhooksModule } from "@modules/webhooks/webhooks.module";
import { SearchModule } from "@modules/search/search.module";
import { MonitoringModule } from "@modules/monitoring/monitoring.module";
import { CommentsModule } from "@modules/comments/comments.module";
import { AnalyticsModule } from "@modules/analytics/analytics.module";
import { IdentityModule } from "@modules/identity/identity.module";
import { AudiencesModule } from "@modules/audiences/audiences.module";
import { ExperimentsModule } from "@modules/experiments/experiments.module";
import { AttributionModule } from "@modules/attribution/attribution.module";
import { WorkflowsModule } from "@modules/workflows/workflows.module";
import { ConsentModule } from "@modules/consent/consent.module";
import { PrivacyModule } from "@modules/privacy/privacy.module";
import { ContentLocksModule } from "@modules/content-locks/content-locks.module";
import { NotificationsModule } from "@modules/notifications/notifications.module";
import { AppController } from "./app.controller";

/**
 * Root module.
 *  W0: infra (DB/Queue/Redis) + health.
 *  W1: CommonModule (TenantContext + ScopedRepository + global guard chain
 *      JwtAuth→Tenant→Roles + auth/audit/membership services) and the tenancy
 *      feature modules (auth, organizations, sites, site-members, audit).
 *
 *  W2b: CMS authoring core — pages, blog, media, navigation, themes, redirects,
 *      templates and the public (host-resolved) SEO routes.
 *
 *  WAVE3b: FormsModule + PublicModule.
 *  WAVE4a: AiModule — BYOK copilot that generates page DRAFTS (worker runs the
 *      schema-grounded LLM; output validated against the 28-block registry).
 */
@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    QueueModule,
    CommonModule,
    AuthModule,
    OrganizationsModule,
    SitesModule,
    SiteMembersModule,
    RolesModule,
    // GOVERNANCE — invite teammates by email.
    InvitationsModule,
    AuditModule,
    // W2b — CMS authoring core.
    PagesModule,
    BlogModule,
    // CONTENT-OPS — advisory concurrent-edit locks for pages/posts builders.
    ContentLocksModule,
    MediaModule,
    NavigationModule,
    ThemesModule,
    RedirectsModule,
    TemplatesModule,
    // Phase 1 — platform template skeleton catalog (cross-tenant; contributor read,
    // platform-admin write). Persistence + HTTP from PRs #27–#29; wired here (1C).
    TemplateSkeletonsModule,
    // Phase 2 — read-only browse projection over skeletons (metadata + optional
    // preview assets; no layout). Schema/service/HTTP from PRs #31–#33; wired here (2D).
    TemplateCatalogModule,
    SeoModule,
    // GLOBAL-CHROME — global header/footer per site.
    SiteChromeModule,
    // REUSE-BLOCKS — per-site reusable / global synced blocks.
    ReusableBlocksModule,
    // WAVE3b — forms + forms→CRM pipeline + public render API.
    FormsModule,
    PublicModule,
    // WAVE4a — AI copilot (BYOK page generation).
    AiModule,
    // WAVE5 — dynamic collections / custom content types.
    CollectionsModule,
    // CUSTOM-DOMAINS — tenant custom-domain binding + DNS verify + TLS seam.
    DomainsModule,
    // PLATFORM-ADMIN — cross-tenant super-admin console (platformAdmin-guarded).
    PlatformModule,
    // E26 — platform-level database backup / restore (platformAdmin-guarded).
    BackupsModule,
    // HUBSPOT-IMPORT — onboarding migration: import HubSpot pages/posts as drafts.
    HubspotImportModule,
    // CONNECTORS — generic per-site provider connection lifecycle.
    ConnectorsModule,
    // E27 — public read-only Content API (API-key auth) + outbound webhooks.
    ContentApiModule,
    WebhooksModule,
    // GLOBAL-SEARCH — site-scoped content search (⌘K command palette backend).
    SearchModule,
    // MONITORING (#29/#37/#30) — CRM-sync status, runtime errors, page audits.
    MonitoringModule,
    // COLLAB — builder page comments (threaded, node/canvas pins).
    CommentsModule,
    // PHASE-2 — analytics pipeline (first-party tracking + rollup + stats API).
    AnalyticsModule,
    // PHASE-3 — identity & audiences (visitor profiles, identity resolution,
    // company ID, lead scoring, audience segmentation) over the analytics stream.
    IdentityModule,
    AudiencesModule,
    ExperimentsModule,
    // PHASE-5 — revenue & orchestration: marketing attribution + a workflow /
    // automation engine (trigger → ordered actions → runs, executed by the
    // worker). AttributionModule is also imported by AnalyticsModule (the
    // conversion beacon records attribution_conversions).
    AttributionModule,
    WorkflowsModule,
    // PRIVACY & CONSENT — GDPR/ePrivacy compliance capstone. ConsentModule =
    // the consent-banner config + proof-of-consent log + retention windows;
    // PrivacyModule = DSAR (cross-table find/export/erase, site_admin + audited).
    // The worker runs the daily retention-purge off the retention config.
    ConsentModule,
    PrivacyModule,
    // NOTIFICATIONS — in-app header-bell notifications fed by the comment +
    // editorial-workflow paths (best-effort emit). Current-user-scoped read API.
    NotificationsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
