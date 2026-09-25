import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { eq, like } from "drizzle-orm";
import type { INestApplication } from "@nestjs/common";
import { db, pool } from "@database/db";
import {
  organizations,
  siteMembers,
  siteSettings,
  sites,
  systemUsers,
} from "@database/schema";
import { createTestApp } from "./setup-app";

/**
 * PLATFORM-ADMIN console gate (cross-tenant super-admin).
 *
 * Proves:
 *  - the platform admin (isPlatformAdmin) gets cross-tenant overview + sites,
 *  - create-site via the console adds a tenant,
 *  - suspend/activate toggles the site's status,
 *  - a NON-platform-admin is hard-denied (403) on every /platform route.
 *
 * Requires Postgres on 5433 with migrations applied (same as tenant-isolation).
 */
describe("platform admin console (cross-tenant)", () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication["getHttpServer"]>;

  // Hyphen-only (no underscore) so it's a valid subdomain/slug for create.
  const tag = `plat-${Date.now()}`;
  const adminEmail = `${tag}_admin@test.local`;
  const userEmail = `${tag}_user@test.local`;
  const password = "Sup3rSecret!";

  let cookieAdmin = "";
  let cookieUser = "";
  let csrfAdmin = "";
  let csrfUser = "";
  let createdSiteId = "";
  let adminUserId = "";

  // The API uses double-submit CSRF: the `ob_csrf` cookie value must be echoed
  // in the `X-CSRF-Token` header on mutating requests.
  const csrfFrom = (cookie: string): string => (cookie.match(/ob_csrf=([^;]+)/) || [])[1] ?? "";

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
    const hash = await bcrypt.hash(password, 10);

    // Platform admin (denormalized flag + platform-wide super_admin row).
    const [admin] = await db
      .insert(systemUsers)
      .values({ email: adminEmail, passwordHash: hash, name: "Plat Admin", isPlatformAdmin: true })
      .returning();
    adminUserId = admin.id;
    await db
      .insert(siteMembers)
      .values({ siteId: null, userId: admin.id, role: "super_admin" });

    // Regular (non-platform) user, site_admin of their own site.
    const [plainUser] = await db
      .insert(systemUsers)
      .values({ email: userEmail, passwordHash: hash, name: "Plain User" })
      .returning();
    const [org] = await db
      .insert(organizations)
      .values({ name: "Org U", slug: `${tag}-u` })
      .returning();
    const [site] = await db
      .insert(sites)
      .values({ orgId: org.id, name: "Site U", slug: `${tag}-u`, subdomain: `${tag}-u` })
      .returning();
    await db.insert(siteSettings).values({ siteId: site.id });
    await db
      .insert(siteMembers)
      .values({ siteId: site.id, userId: plainUser.id, role: "site_admin" });

    const loginAdmin = await request(server)
      .post("/api/v1/auth/login")
      .send({ email: adminEmail, password });
    expect(loginAdmin.status).toBe(200);
    cookieAdmin = String(
      Array.isArray(loginAdmin.headers["set-cookie"])
        ? loginAdmin.headers["set-cookie"].join(";")
        : loginAdmin.headers["set-cookie"],
    );

    const loginUser = await request(server)
      .post("/api/v1/auth/login")
      .send({ email: userEmail, password });
    expect(loginUser.status).toBe(200);
    cookieUser = String(
      Array.isArray(loginUser.headers["set-cookie"])
        ? loginUser.headers["set-cookie"].join(";")
        : loginUser.headers["set-cookie"],
    );
    // The CsrfGuard seeds/rotates the readable `ob_csrf` cookie on safe (GET)
    // responses. Prime with a GET, then rebuild the cookie with a SINGLE fresh
    // ob_csrf (stripping any stale one) so the double-submit header matches the
    // exact value the server will read.
    const prime = async (cookie: string): Promise<{ cookie: string; token: string }> => {
      const res = await request(server).get("/api/v1/platform/overview").set("Cookie", cookie);
      const raw = res.headers["set-cookie"];
      const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
      const csrfPair = arr.map((c) => c.split(";")[0].trim()).find((c) => c.startsWith("ob_csrf="));
      const base = cookie
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s && !s.startsWith("ob_csrf="))
        .join("; ");
      const fresh = csrfPair ?? `ob_csrf=${csrfFrom(cookie)}`;
      return { cookie: `${base}; ${fresh}`, token: fresh.split("=")[1] ?? "" };
    };
    const a = await prime(cookieAdmin);
    cookieAdmin = a.cookie;
    csrfAdmin = a.token;
    const u = await prime(cookieUser);
    cookieUser = u.cookie;
    csrfUser = u.token;
  });

  afterAll(async () => {
    // Best-effort cleanup. Delete child rows for every site this run created
    // (the seeded "Site U" + the console-created site), then the sites/orgs/users.
    const ourSites = await db
      .select({ id: sites.id })
      .from(sites)
      .where(like(sites.slug, `${tag}%`));
    for (const s of ourSites) {
      await db.delete(siteMembers).where(eq(siteMembers.siteId, s.id));
      await db.delete(siteSettings).where(eq(siteSettings.siteId, s.id));
    }
    await db.delete(sites).where(like(sites.slug, `${tag}%`));
    await db.delete(organizations).where(like(organizations.slug, `${tag}%`));
    await db.delete(siteMembers).where(eq(siteMembers.userId, adminUserId));
    await db.delete(systemUsers).where(eq(systemUsers.email, adminEmail));
    await db.delete(systemUsers).where(eq(systemUsers.email, userEmail));
    await app?.close();
    await pool.end();
  });

  it("platform admin gets cross-tenant overview", async () => {
    const res = await request(server).get("/api/v1/platform/overview").set("Cookie", cookieAdmin);
    expect(res.status).toBe(200);
    expect(typeof res.body.data.sites).toBe("number");
    expect(res.body.data.sites).toBeGreaterThan(0);
  });

  it("platform admin lists ALL sites with per-site stats", async () => {
    const res = await request(server).get("/api/v1/platform/sites").set("Cookie", cookieAdmin);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    const first = res.body.data[0];
    expect(first).toHaveProperty("counts.pages");
    expect(first).toHaveProperty("counts.members");
  });

  it("platform admin creates a new tenant/site", async () => {
    const res = await request(server)
      .post("/api/v1/platform/sites")
      .set("Cookie", cookieAdmin)
      .set("X-CSRF-Token", csrfAdmin)
      .send({ name: "Console Site", subdomain: `${tag}-new` });
    expect(res.status).toBe(201);
    expect(res.body.data.subdomain).toBe(`${tag}-new`);
    createdSiteId = res.body.data.id;

    const list = await request(server).get("/api/v1/platform/sites").set("Cookie", cookieAdmin);
    const ids: string[] = list.body.data.map((s: { id: string }) => s.id);
    expect(ids).toContain(createdSiteId);
  });

  it("platform admin suspends then re-activates a site", async () => {
    const suspend = await request(server)
      .post(`/api/v1/platform/sites/${createdSiteId}/suspend`)
      .set("Cookie", cookieAdmin)
      .set("X-CSRF-Token", csrfAdmin)
      .send({});
    expect(suspend.status).toBe(200);
    expect(suspend.body.data.status).toBe("suspended");

    const activate = await request(server)
      .post(`/api/v1/platform/sites/${createdSiteId}/activate`)
      .set("Cookie", cookieAdmin)
      .set("X-CSRF-Token", csrfAdmin)
      .send({});
    expect(activate.status).toBe(200);
    expect(activate.body.data.status).toBe("active");
  });

  it("platform admin lists platform users", async () => {
    const res = await request(server).get("/api/v1/platform/users").set("Cookie", cookieAdmin);
    expect(res.status).toBe(200);
    const emails: string[] = res.body.data.map((u: { email: string }) => u.email);
    expect(emails).toContain(adminEmail);
  });

  it("NON-platform-admin is denied (403) on every /platform route", async () => {
    const overview = await request(server).get("/api/v1/platform/overview").set("Cookie", cookieUser);
    expect(overview.status).toBe(403);

    const list = await request(server).get("/api/v1/platform/sites").set("Cookie", cookieUser);
    expect(list.status).toBe(403);

    const create = await request(server)
      .post("/api/v1/platform/sites")
      .set("Cookie", cookieUser)
      .set("X-CSRF-Token", csrfUser)
      .send({ name: "Nope", subdomain: `${tag}-nope` });
    expect(create.status).toBe(403);

    // Static id (the guard runs before the handler, so it 403s regardless of
    // whether the site exists — independent of the create test's ordering).
    const suspend = await request(server)
      .post(`/api/v1/platform/sites/ste_nonexistent/suspend`)
      .set("Cookie", cookieUser)
      .set("X-CSRF-Token", csrfUser)
      .send({});
    expect(suspend.status).toBe(403);
  });

  it("unauthenticated requests to /platform are rejected (401)", async () => {
    const res = await request(server).get("/api/v1/platform/overview");
    expect(res.status).toBe(401);
  });
});
