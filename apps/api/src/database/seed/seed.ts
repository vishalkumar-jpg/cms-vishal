import { config } from "dotenv";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { initKsuid } from "@utils/ksuid.utils";
import { db, pool } from "../db";
import {
  organizations,
  siteMembers,
  siteSettings,
  sites,
  systemUsers,
} from "../schema";
import { seedBuiltinTemplateSkeletons } from "./template-skeletons.seed";
import { seedOfficeBeaconReusableBlocks } from "./reusable-blocks.seed";

config();

/**
 * Idempotent seed (safe to re-run). Creates:
 *  - a platform super_admin user (env SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD,
 *    defaults admin@officebeacon.com / a dev password),
 *  - a platform-wide super_admin membership row (siteId = NULL),
 *  - the OfficeBeacon organization,
 *  - the OfficeBeacon site (subdomain `officebeacon`) + default settings,
 *  - the super_admin as site_admin of that site,
 *  - Office Beacon reusable blocks (idempotent fixture seed for REUSE-BLOCKS),
 *  - published Starter Template skeletons for catalog browse (Phase 2E).
 *
 * Run: `bun run db:seed`. Prints the credentials at the end.
 */
async function main(): Promise<void> {
  await initKsuid();

  const email = (process.env.SUPER_ADMIN_EMAIL ?? "admin@officebeacon.com").toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD ?? "ChangeMe123!";

  // 1. super_admin user (upsert by unique email).
  let [user] = await db.select().from(systemUsers).where(eq(systemUsers.email, email)).limit(1);
  if (!user) {
    const passwordHash = await bcrypt.hash(password, 12);
    [user] = await db
      .insert(systemUsers)
      .values({ email, passwordHash, name: "Platform Admin", isPlatformAdmin: true })
      .returning();
    // eslint-disable-next-line no-console
    console.log(`SEED :: created super_admin user ${email}`);
  } else {
    if (!user.isPlatformAdmin) {
      await db
        .update(systemUsers)
        .set({ isPlatformAdmin: true })
        .where(eq(systemUsers.id, user.id));
    }
    // eslint-disable-next-line no-console
    console.log(`SEED :: super_admin user ${email} already exists`);
  }

  // 2. platform-wide super_admin membership (siteId NULL).
  const platformRows = await db
    .select()
    .from(siteMembers)
    .where(eq(siteMembers.userId, user.id));
  const hasPlatformRow = platformRows.some(
    (r) => r.siteId === null && r.role === "super_admin",
  );
  if (!hasPlatformRow) {
    await db
      .insert(siteMembers)
      .values({ siteId: null, userId: user.id, role: "super_admin" });
    // eslint-disable-next-line no-console
    console.log("SEED :: created platform super_admin membership");
  }

  // 3. OfficeBeacon organization (upsert by slug).
  let [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, "officebeacon"))
    .limit(1);
  if (!org) {
    [org] = await db
      .insert(organizations)
      .values({ name: "OfficeBeacon", slug: "officebeacon", createdBy: user.id })
      .returning();
    // eslint-disable-next-line no-console
    console.log("SEED :: created OfficeBeacon organization");
  }

  // 4. OfficeBeacon site (upsert by subdomain).
  let [site] = await db.select().from(sites).where(eq(sites.subdomain, "officebeacon")).limit(1);
  if (!site) {
    [site] = await db
      .insert(sites)
      .values({
        orgId: org.id,
        name: "OfficeBeacon",
        slug: "officebeacon",
        subdomain: "officebeacon",
        ownerId: user.id,
        visibility: "draft",
        createdBy: user.id,
      })
      .returning();
    // eslint-disable-next-line no-console
    console.log("SEED :: created OfficeBeacon site");
  }

  // 5. site_settings (1:1, upsert by siteId).
  const [settings] = await db
    .select({ id: siteSettings.id })
    .from(siteSettings)
    .where(eq(siteSettings.siteId, site.id))
    .limit(1);
  if (!settings) {
    await db.insert(siteSettings).values({ siteId: site.id, createdBy: user.id });
    // eslint-disable-next-line no-console
    console.log("SEED :: created OfficeBeacon site settings");
  }

  // 6. super_admin as site_admin of the OB site (so it appears in their list).
  const siteMembershipRows = await db
    .select()
    .from(siteMembers)
    .where(eq(siteMembers.siteId, site.id));
  const hasSiteMembership = siteMembershipRows.some((r) => r.userId === user.id);
  if (!hasSiteMembership) {
    await db.insert(siteMembers).values({
      siteId: site.id,
      userId: user.id,
      role: "site_admin",
      createdBy: user.id,
    });
    // eslint-disable-next-line no-console
    console.log("SEED :: added super_admin as site_admin of OfficeBeacon");
  }

  // 7. Office Beacon reusable blocks (REUSE-BLOCKS) — idempotent fixture seed so
  // page layouts referencing rub_* ids resolve in every environment.
  await seedOfficeBeaconReusableBlocks(db, site.id, {
    log: (message) => {
      // eslint-disable-next-line no-console
      console.log(message);
    },
  });

  // 8. Published example template skeletons for /api/template-catalog (Phase 2E).
  await seedBuiltinTemplateSkeletons(db, {
    log: (message) => {
      // eslint-disable-next-line no-console
      console.log(message);
    },
  });

  // Print first-run credentials for local onboarding ONLY. Never echo the
  // generated password in production logs (WAVE4b secrets hygiene).
  const isProd = (process.env.ENVIRONMENT ?? "local") === "production";
  // eslint-disable-next-line no-console
  console.log("\n──────────────────────────────────────────────");
  // eslint-disable-next-line no-console
  console.log(" Seed complete. Super admin credentials:");
  // eslint-disable-next-line no-console
  console.log(`   email:    ${email}`);
  // eslint-disable-next-line no-console
  console.log(`   password: ${isProd ? "(hidden — set via env / reset flow)" : password}`);
  // eslint-disable-next-line no-console
  console.log(`   site id:  ${site.id} (subdomain: officebeacon)`);
  // eslint-disable-next-line no-console
  console.log("──────────────────────────────────────────────\n");
}

main()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error("SEED :: failed", error);
    await pool.end();
    process.exit(1);
  });
