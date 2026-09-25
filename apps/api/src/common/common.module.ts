import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuditService } from "./audit/audit.service";
import { Auth0Provider } from "./auth/auth0.provider";
import { AUTH_PROVIDER } from "./auth/auth-provider.interface";
import { LocalAuthProvider } from "./auth/local.provider";
import { PasswordService } from "./auth/password.service";
import { TokenService } from "./auth/token.service";
import { MailService } from "./mail/mail.service";
import { CsrfGuard } from "./guards/csrf.guard";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { PlatformAdminGuard } from "./guards/platform-admin.guard";
import { RateLimitGuard } from "./guards/rate-limit.guard";
import { RolesGuard } from "./guards/roles.guard";
import { PermissionGuard } from "./guards/permission.guard";
import { TenantGuard } from "./guards/tenant.guard";
import { MembershipService } from "./tenancy/membership.service";
import { PermissionService } from "./tenancy/permission.service";
import { ScopedRepository } from "./tenancy/scoped-repository";
import { TenantContext } from "./tenancy/tenant-context";

/**
 * CommonModule — the tenancy/auth/RBAC spine (TECH-ARCHITECTURE §3–5).
 *
 * Wires the GLOBAL guards in order:
 *   0. RateLimitGuard — Redis fixed-window limiter (fail-open); sheds abuse
 *      before auth work runs and also covers @Public surfaces.
 *   0b. CsrfGuard    — double-submit CSRF check for cookie-auth mutations
 *      (Bearer + @Public exempt); seeds the readable ob_csrf cookie.
 *   1. JwtAuthGuard  — authenticate (unless @Public)
 *   2. TenantGuard   — resolve + validate active site membership (X-Site-Id)
 *   3. RolesGuard    — enforce @Roles hierarchy on the active site
 *   4. PermissionGuard — RBAC-2 opt-in @RequirePermissions fine-grained gate
 *
 * Also provides the request-scoped TenantContext + ScopedRepository (the
 * isolation boundary), the auth providers (local functional, Auth0 inert),
 * password/token/mail services, MembershipService, and AuditService. @Global so
 * feature modules can inject these without re-importing.
 */
@Global()
@Module({
  providers: [
    TenantContext,
    ScopedRepository,
    MembershipService,
    PermissionService,
    AuditService,
    TokenService,
    PasswordService,
    MailService,
    LocalAuthProvider,
    Auth0Provider,
    { provide: AUTH_PROVIDER, useClass: LocalAuthProvider },
    RateLimitGuard,
    CsrfGuard,
    // Global guard chain (registration order = execution order).
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    // PlatformAdminGuard — enforces @PlatformAdmin() cross-tenant routes; no-op
    // for site-scoped routes. Runs after JwtAuthGuard sets req.user.
    { provide: APP_GUARD, useClass: PlatformAdminGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    // RBAC-2: OPT-IN fine-grained gate. No-op unless a route carries
    // @RequirePermissions(...), so all @Roles-only routes are unaffected.
    { provide: APP_GUARD, useClass: PermissionGuard },
  ],
  exports: [
    TenantContext,
    ScopedRepository,
    MembershipService,
    PermissionService,
    AuditService,
    TokenService,
    PasswordService,
    MailService,
    AUTH_PROVIDER,
  ],
})
export class CommonModule {}
