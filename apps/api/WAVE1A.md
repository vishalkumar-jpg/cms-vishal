# WAVE 1a — multi-tenancy, auth, RBAC (run/verify steps)

The implementation is committed in source. Because this environment could not
run Node/Bun, the following commands still need to be executed once to install
the new dependencies, apply the migration, seed, and run the gate.

```bash
export PATH="$HOME/.nvm/versions/node/v24.13.1/bin:$PATH"   # node v24
node -v                                                     # expect v24.x

# 1. Install the new deps added to apps/api/package.json
#    (jsonwebtoken, bcryptjs, nodemailer + @nestjs/testing, supertest, vitest,
#     unplugin-swc, vite-tsconfig-paths and their @types)
cd /Users/yash/www/ob-cms/platform && bun install

# 2. Type-check (acceptance #1)
bun run type-check

# 3. Apply the migration to the 5433 DB (acceptance #2)
cd apps/api && bun run db:migrate
#   (or re-generate from schema first: bunx drizzle-kit generate)

# 4. Seed the super_admin + OfficeBeacon org/site/settings (idempotent, acceptance #6)
bun run db:seed
#   prints: admin@officebeacon.com / ChangeMe123!  (override via
#   SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD env)

# 5. Boot the API (acceptance #3)
bun run dev    # http://localhost:3001/api  — kill when done

# 6. Cross-tenant isolation gate (acceptance #5) — needs migrations applied
bun run test:e2e
```

## Manual smoke (acceptance #3, #4)

```bash
# login (sets ob_session cookie)
curl -i -c /tmp/ob.cookie -X POST http://localhost:3001/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"admin@officebeacon.com","password":"ChangeMe123!"}'

# current user + memberships + isPlatformAdmin
curl -s -b /tmp/ob.cookie http://localhost:3001/api/auth/me

# list sites (membership-scoped; super_admin sees all)
curl -s -b /tmp/ob.cookie http://localhost:3001/api/sites

# create a site (super_admin only) — use an orgId from /api/organizations
curl -s -b /tmp/ob.cookie -X POST http://localhost:3001/api/sites \
  -H 'content-type: application/json' \
  -d '{"orgId":"<org id>","name":"Acme","slug":"acme","subdomain":"acme"}'

# role-guarded + tenant-scoped settings update (site_admin) — note X-Site-Id
curl -s -b /tmp/ob.cookie -X PATCH http://localhost:3001/api/sites/<siteId>/settings \
  -H 'content-type: application/json' -H 'x-site-id: <siteId>' \
  -d '{"primaryColor":"#123456"}'
```

## Optional .env additions (all have safe defaults in code)

```
MAIL_FROM=OB-CMS <no-reply@officebeacon.com>
SUPER_ADMIN_EMAIL=admin@officebeacon.com
SUPER_ADMIN_PASSWORD=ChangeMe123!
# Auth0 adapter stays INERT unless all three are set AND AUTH0_ENABLED=true:
AUTH0_DOMAIN=
AUTH0_CLIENT_ID=
AUTH0_AUDIENCE=
```
