import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import type { INestApplication } from "@nestjs/common";
import { db, pool } from "@database/db";
import {
  formSubmissions,
  forms,
  organizations,
  siteMembers,
  siteSettings,
  sites,
  systemUsers,
} from "@database/schema";
import { createTestApp } from "./setup-app";

/**
 * RELEASE GATE — cross-tenant isolation (FND-3).
 *
 * Seeds two sites (A, B) under two orgs with distinct members and proves:
 *  - a member of site A is denied (403) when targeting site B via X-Site-Id,
 *  - IDOR (member of A using a known site-B id) returns 404/403, never B's data,
 *  - the ScopedRepository-backed audit listing for site A never returns B's rows,
 *  - the member CANNOT see B in their /sites list.
 *
 * Requires Postgres on 5433 with migrations applied.
 */
describe("tenant isolation (release gate)", () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication["getHttpServer"]>;

  const tag = `iso_${Date.now()}`;
  const userAEmail = `${tag}_a@test.local`;
  const userBEmail = `${tag}_b@test.local`;
  const password = "Sup3rSecret!";

  let siteAId = "";
  let siteBId = "";
  let cookieA = "";
  let csrfA = "";

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
    const hash = await bcrypt.hash(password, 10);

    // Two distinct, non-platform-admin users.
    const [userA] = await db
      .insert(systemUsers)
      .values({ email: userAEmail, passwordHash: hash, name: "User A" })
      .returning();
    const [userB] = await db
      .insert(systemUsers)
      .values({ email: userBEmail, passwordHash: hash, name: "User B" })
      .returning();

    const [orgA] = await db
      .insert(organizations)
      .values({ name: "Org A", slug: `${tag}-a` })
      .returning();
    const [orgB] = await db
      .insert(organizations)
      .values({ name: "Org B", slug: `${tag}-b` })
      .returning();

    const [siteA] = await db
      .insert(sites)
      .values({ orgId: orgA.id, name: "Site A", slug: `${tag}-a`, subdomain: `${tag}-a` })
      .returning();
    const [siteB] = await db
      .insert(sites)
      .values({ orgId: orgB.id, name: "Site B", slug: `${tag}-b`, subdomain: `${tag}-b` })
      .returning();
    siteAId = siteA.id;
    siteBId = siteB.id;

    await db.insert(siteSettings).values({ siteId: siteA.id });
    await db.insert(siteSettings).values({ siteId: siteB.id });

    // A is site_admin of A only; B is site_admin of B only.
    await db
      .insert(siteMembers)
      .values({ siteId: siteA.id, userId: userA.id, role: "site_admin" });
    await db
      .insert(siteMembers)
      .values({ siteId: siteB.id, userId: userB.id, role: "site_admin" });

    // Log in as A to get the session cookie.
    const login = await request(server)
      .post("/api/v1/auth/login")
      .send({ email: userAEmail, password });
    expect(login.status).toBe(200);
    const setCookie = login.headers["set-cookie"];
    cookieA = Array.isArray(setCookie) ? setCookie.join(";") : String(setCookie);
    expect(cookieA).toContain("ob_session");

    // The double-submit CsrfGuard seeds the readable `ob_csrf` cookie on a safe
    // (GET) response, not on login. Prime it, then rebuild the cookie with a
    // single fresh ob_csrf so the X-CSRF-Token header matches on mutations.
    const probe = await request(server)
      .get(`/api/v1/sites/${siteAId}/audit`)
      .set("Cookie", cookieA)
      .set("X-CSRF-Token", csrfA)
      .set("x-site-id", siteAId);
    const probeSet = probe.headers["set-cookie"];
    const csrfPair = (Array.isArray(probeSet) ? probeSet : probeSet ? [probeSet] : [])
      .map((c) => c.split(";")[0].trim())
      .find((c) => c.startsWith("ob_csrf="));
    if (csrfPair) {
      const base = cookieA
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s && !s.startsWith("ob_csrf="))
        .join("; ");
      cookieA = `${base}; ${csrfPair}`;
      csrfA = csrfPair.split("=")[1] ?? "";
    }
  });

  afterAll(async () => {
    await app?.close();
    // Best-effort cleanup of seeded test rows.
    await db.delete(formSubmissions).where(eq(formSubmissions.siteId, siteAId));
    await db.delete(formSubmissions).where(eq(formSubmissions.siteId, siteBId));
    await db.delete(forms).where(eq(forms.siteId, siteAId));
    await db.delete(forms).where(eq(forms.siteId, siteBId));
    await db.delete(siteMembers).where(eq(siteMembers.siteId, siteAId));
    await db.delete(siteMembers).where(eq(siteMembers.siteId, siteBId));
    await db.delete(siteSettings).where(eq(siteSettings.siteId, siteAId));
    await db.delete(siteSettings).where(eq(siteSettings.siteId, siteBId));
    await db.delete(sites).where(eq(sites.id, siteAId));
    await db.delete(sites).where(eq(sites.id, siteBId));
    await db.delete(systemUsers).where(eq(systemUsers.email, userAEmail));
    await db.delete(systemUsers).where(eq(systemUsers.email, userBEmail));
    await pool.end();
  });

  it("A can read its OWN site", async () => {
    const res = await request(server)
      .get(`/api/v1/sites/${siteAId}`)
      .set("Cookie", cookieA)
      .set("X-CSRF-Token", csrfA)
      .set("x-site-id", siteAId);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(siteAId);
  });

  it("A is DENIED (403) reading site B via X-Site-Id", async () => {
    const res = await request(server)
      .get(`/api/v1/sites/${siteBId}`)
      .set("Cookie", cookieA)
      .set("X-CSRF-Token", csrfA)
      .set("x-site-id", siteBId);
    expect(res.status).toBe(403);
  });

  it("A cannot list site B's members (403)", async () => {
    const res = await request(server)
      .get(`/api/v1/sites/${siteBId}/members`)
      .set("Cookie", cookieA)
      .set("X-CSRF-Token", csrfA)
      .set("x-site-id", siteBId);
    expect(res.status).toBe(403);
  });

  it("IDOR: A spoofs header=A but path=B → cannot read B (403/404)", async () => {
    // Header sets active site to A (A is a member); path id is B's.
    const res = await request(server)
      .get(`/api/v1/sites/${siteBId}`)
      .set("Cookie", cookieA)
      .set("X-CSRF-Token", csrfA)
      .set("x-site-id", siteAId);
    // Service reads :siteId=B but TenantContext.siteId=A → not found in A's scope.
    expect([403, 404]).toContain(res.status);
    if (res.status === 200) throw new Error("LEAK: A read site B via IDOR");
  });

  it("A cannot mutate B's settings (403)", async () => {
    const res = await request(server)
      .patch(`/api/v1/sites/${siteBId}/settings`)
      .set("Cookie", cookieA)
      .set("X-CSRF-Token", csrfA)
      .set("x-site-id", siteBId)
      .send({ tagline: "pwned" });
    expect(res.status).toBe(403);
  });

  it("ScopedRepository: A's audit listing never contains B's events", async () => {
    const res = await request(server)
      .get(`/api/v1/sites/${siteAId}/audit`)
      .set("Cookie", cookieA)
      .set("X-CSRF-Token", csrfA)
      .set("x-site-id", siteAId);
    expect(res.status).toBe(200);
    // Paginated envelope: { rows, hasMore, limit, offset }.
    const rows: Array<{ siteId: string | null }> = res.body.data.rows;
    expect(rows.every((r) => r.siteId === siteAId)).toBe(true);
    expect(rows.some((r) => r.siteId === siteBId)).toBe(false);
  });

  it("A's /sites list excludes site B", async () => {
    const res = await request(server).get("/api/v1/sites").set("Cookie", cookieA)
.set("X-CSRF-Token", csrfA);
    expect(res.status).toBe(200);
    const ids: string[] = res.body.data.map((s: { id: string }) => s.id);
    expect(ids).toContain(siteAId);
    expect(ids).not.toContain(siteBId);
  });

  it("unauthenticated requests are rejected (401)", async () => {
    const res = await request(server).get(`/api/v1/sites/${siteAId}`).set("x-site-id", siteAId);
    expect(res.status).toBe(401);
  });

  // --- W2b: CMS content tenant isolation -----------------------------------

  let pageAId = "";

  it("A creates a page in site A, autosaves a draft, and publishes it", async () => {
    const create = await request(server)
      .post("/api/v1/pages")
      .set("Cookie", cookieA)
      .set("X-CSRF-Token", csrfA)
      .set("x-site-id", siteAId)
      .send({ title: "Home", slug: "home" });
    expect(create.status).toBe(201);
    pageAId = create.body.data.id;
    expect(create.body.data.siteId).toBe(siteAId);

    const draft = await request(server)
      .patch(`/api/v1/pages/${pageAId}/draft`)
      .set("Cookie", cookieA)
      .set("X-CSRF-Token", csrfA)
      .set("x-site-id", siteAId)
      .send({
        layout: {
          schemaVersion: "2.0",
          root: "ROOT",
          nodes: {
            ROOT: { type: { resolvedName: "Section" }, isCanvas: true, props: {}, nodes: [] },
          },
        },
      });
    expect(draft.status).toBe(200);

    const publish = await request(server)
      .post(`/api/v1/pages/${pageAId}/publish`)
      .set("Cookie", cookieA)
      .set("X-CSRF-Token", csrfA)
      .set("x-site-id", siteAId)
      .send({});
    expect(publish.status).toBe(200);
    expect(publish.body.data.status).toBe("published");
    expect(publish.body.data.publishedLayout).toBeTruthy();
    expect(publish.body.data.publishedAt).toBeTruthy();

    const versions = await request(server)
      .get(`/api/v1/pages/${pageAId}/versions`)
      .set("Cookie", cookieA)
      .set("X-CSRF-Token", csrfA)
      .set("x-site-id", siteAId);
    expect(versions.status).toBe(200);
    expect(versions.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it("A's /pages list is scoped to site A (no B leakage)", async () => {
    const res = await request(server)
      .get("/api/v1/pages")
      .set("Cookie", cookieA)
      .set("X-CSRF-Token", csrfA)
      .set("x-site-id", siteAId);
    expect(res.status).toBe(200);
    expect(res.body.data.every((p: { siteId: string }) => p.siteId === siteAId)).toBe(true);
  });

  it("A is DENIED listing site B's pages (403)", async () => {
    const res = await request(server)
      .get("/api/v1/pages")
      .set("Cookie", cookieA)
      .set("X-CSRF-Token", csrfA)
      .set("x-site-id", siteBId);
    expect(res.status).toBe(403);
  });

  it("A cannot read its own page while scoped to B (cross-site → 404/403)", async () => {
    // Header says B (A is not a member of B) → 403 at the guard.
    const res = await request(server)
      .get(`/api/v1/pages/${pageAId}`)
      .set("Cookie", cookieA)
      .set("X-CSRF-Token", csrfA)
      .set("x-site-id", siteBId);
    expect([403, 404]).toContain(res.status);
  });

  it("A is DENIED presigning a media upload in site B (403)", async () => {
    const res = await request(server)
      .post("/api/v1/media/presign")
      .set("Cookie", cookieA)
      .set("X-CSRF-Token", csrfA)
      .set("x-site-id", siteBId)
      .send({ filename: "x.png", contentType: "image/png" });
    expect(res.status).toBe(403);
  });

  it("A can presign media in site A and it is scoped to A", async () => {
    const res = await request(server)
      .post("/api/v1/media/presign")
      .set("Cookie", cookieA)
      .set("X-CSRF-Token", csrfA)
      .set("x-site-id", siteAId)
      .send({ filename: "logo.png", contentType: "image/png" });
    // 201 with a presigned URL; storage may be unavailable in CI but the row is scoped.
    if (res.status === 201) {
      expect(res.body.data.media.siteId).toBe(siteAId);
    } else {
      // Storage backend not configured in this env — still must not be a leak.
      expect([201, 400, 500]).toContain(res.status);
    }
  });

  // --- WAVE3b: forms + public submit tenant isolation ----------------------

  let formAId = "";
  const hostA = `${tag}-a.localhost`; // resolves to site A by subdomain label

  it("A creates + publishes a form in site A", async () => {
    const create = await request(server)
      .post("/api/v1/forms")
      .set("Cookie", cookieA)
      .set("X-CSRF-Token", csrfA)
      .set("x-site-id", siteAId)
      .send({
        name: "Contact",
        fields: [
          { type: "email", label: "Email", name: "email", required: true },
          { type: "text", label: "Name", name: "name", required: false },
        ],
        settings: { successMessage: "Thanks!", spamProtection: { minSubmitSeconds: 0 } },
      });
    expect(create.status).toBe(201);
    formAId = create.body.data.id;
    expect(create.body.data.siteId).toBe(siteAId);

    const publish = await request(server)
      .post(`/api/v1/forms/${formAId}/publish`)
      .set("Cookie", cookieA)
      .set("X-CSRF-Token", csrfA)
      .set("x-site-id", siteAId)
      .send({});
    expect(publish.status).toBe(200);
    expect(publish.body.data.status).toBe("published");
  });

  it("A's /forms list is scoped to site A (no B leakage)", async () => {
    const res = await request(server)
      .get("/api/v1/forms")
      .set("Cookie", cookieA)
      .set("X-CSRF-Token", csrfA)
      .set("x-site-id", siteAId);
    expect(res.status).toBe(200);
    expect(res.body.data.every((f: { siteId: string }) => f.siteId === siteAId)).toBe(true);
  });

  it("A is DENIED listing site B's forms (403)", async () => {
    const res = await request(server)
      .get("/api/v1/forms")
      .set("Cookie", cookieA)
      .set("X-CSRF-Token", csrfA)
      .set("x-site-id", siteBId);
    expect(res.status).toBe(403);
  });

  it("A cannot read its own form while scoped to B (cross-site → 403/404)", async () => {
    const res = await request(server)
      .get(`/api/v1/forms/${formAId}`)
      .set("Cookie", cookieA)
      .set("X-CSRF-Token", csrfA)
      .set("x-site-id", siteBId);
    expect([403, 404]).toContain(res.status);
  });

  it("PUBLIC submit persists a submission (host-resolved, no client siteId)", async () => {
    // NB: the e2e app boots WITHOUT the global "api" prefix (see setup-app.ts),
    // Public routes are at /api/v1/public/* (globalPrefix + @Controller("public")).
    const res = await request(server)
      .post(`/api/v1/public/forms/${formAId}/submit`)
      .set("Host", hostA)
      .send({ data: { email: "lead@example.com", name: "Jane" } });
    expect(res.status).toBe(201);
    expect(res.body.data.ok).toBe(true);
    expect(res.body.data.submissionId).toBeTruthy();

    // The submission is visible only within site A's scope.
    const list = await request(server)
      .get(`/api/v1/forms/${formAId}/submissions`)
      .set("Cookie", cookieA)
      .set("X-CSRF-Token", csrfA)
      .set("x-site-id", siteAId);
    expect(list.status).toBe(200);
    expect(list.body.data.total).toBeGreaterThanOrEqual(1);
    expect(list.body.data.rows.every((r: { siteId: string }) => r.siteId === siteAId)).toBe(true);
  });

  it("PUBLIC submit to a form whose id is unknown for the host → 404", async () => {
    const res = await request(server)
      .post(`/api/v1/public/forms/frm_does_not_exist/submit`)
      .set("Host", hostA)
      .send({ data: { email: "x@example.com" } });
    expect(res.status).toBe(404);
  });

  it("PUBLIC render: /api/v1/public/page returns A's published page by host+path", async () => {
    const res = await request(server)
      .get(`/api/v1/public/page?path=/home`)
      .set("Host", hostA);
    expect(res.status).toBe(200);
    expect(res.body.data.slug).toBe("home");
    expect(res.body.data.layout).toBeTruthy();
  });

  it("PUBLIC render: unknown host → 404 (no client siteId trusted)", async () => {
    const res = await request(server)
      .get(`/api/v1/public/site`)
      .set("Host", "nope.invalid.localhost");
    expect(res.status).toBe(404);
  });
});
