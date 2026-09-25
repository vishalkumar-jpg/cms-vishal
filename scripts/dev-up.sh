#!/usr/bin/env bash
# Boot the whole OB-CMS stack locally (infra + all 4 apps) and print URLs.
# Usage:  bash scripts/dev-up.sh        (from platform/)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Node 24 (host default may be too old) + Bun.
export PATH="$HOME/.nvm/versions/node/v24.13.1/bin:$PATH"
echo "node: $(node -v)"

echo "▶ Starting infra (postgres:5433, redis, minio, mailhog)…"
docker compose -f infra/docker-compose.yml up -d postgres redis minio mailhog >/dev/null
# wait for postgres
for _ in $(seq 1 20); do
  docker compose -f infra/docker-compose.yml exec -T postgres pg_isready -U obcms -d obcms >/dev/null 2>&1 && break
  sleep 1
done

echo "▶ Applying migrations + seed (idempotent)…"
( cd apps/api && bun run db:migrate >/dev/null 2>&1 && bun run db:seed >/dev/null 2>&1 ) || true

echo "▶ Starting apps (api, worker, renderer, admin)…"
mkdir -p "$ROOT/.devlogs"
pkill -f "nest start" 2>/dev/null || true; pkill -f "worker.ts" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true; pkill -f "vite" 2>/dev/null || true
( cd apps/api      && bun run dev > "$ROOT/.devlogs/api.log" 2>&1 ) &
( cd apps/worker   && bun run dev > "$ROOT/.devlogs/worker.log" 2>&1 ) &
( cd apps/renderer && bun run dev > "$ROOT/.devlogs/renderer.log" 2>&1 ) &
( cd apps/admin    && bun run dev > "$ROOT/.devlogs/admin.log" 2>&1 ) &

echo "▶ Waiting for services…"
for _ in $(seq 1 40); do
  curl -s -o /dev/null http://localhost:3001/api/health && \
  curl -s -o /dev/null http://localhost:5001/ && break
  sleep 2
done

cat <<EOF

✅ OB-CMS is up.

  CMS Admin     →  http://localhost:5001       (admin@officebeacon.com / ChangeMe123!)
  Live site     →  http://officebeacon.localhost:3000/obhome
  API health    →  http://localhost:3001/api/health
  API docs      →  http://localhost:3001/docs
  MailHog       →  http://localhost:8025

  Logs: $ROOT/.devlogs/{api,worker,renderer,admin}.log
  Stop: pkill -f 'nest start'; pkill -f worker.ts; pkill -f 'next dev'; pkill -f vite
EOF
