#!/bin/bash
# ============================================================
#  JEST Policy CRM — EC2 Server-Side Automated Deploy Script
#  Run this ON the EC2 server (/home/ubuntu/app)
# ============================================================
set -e  # Exit immediately on any error

APP_DIR="${HOME}/app"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo ""
echo "======================================================"
echo "  JEST CRM — Production Deploy — ${TIMESTAMP}"
echo "======================================================"
echo ""

cd "${APP_DIR}"

# ── Step 1: Sync with remote branch ────────────────────────
echo "[1/8] Syncing code from remote repository..."
git fetch origin
git reset --hard origin/feature/health-insurance-crm
echo "      ✅ HEAD is now at $(git log -1 --oneline)"

# ── Step 2: Install dependencies ───────────────────────────
echo "[2/8] Installing dependencies..."
pnpm install --frozen-lockfile
echo "      ✅ Dependencies verified."

# ── Step 3: Prisma bindings and migrations ─────────────────
echo "[3/8] Synchronizing database schema..."
pnpm --filter api exec prisma generate
pnpm --filter api exec prisma migrate deploy
echo "      ✅ Database migrations applied."

# ── Step 4: Build Backend API ──────────────────────────────
echo "[4/8] Compiling NestJS Backend..."
NODE_OPTIONS="--max-old-space-size=1536" pnpm --filter api build
echo "      ✅ API build complete."

# ── Step 5: Build Frontend Web ─────────────────────────────
echo "[5/8] Compiling Next.js Standalone Frontend..."
NODE_OPTIONS="--max-old-space-size=1536" pnpm --filter web build
echo "      ✅ Web build complete."

# ── Step 6: Copy Next.js Standalone Assets ─────────────────
echo "[6/8] Copying Next.js static assets into standalone build..."
STANDALONE_DIR="${APP_DIR}/apps/web/.next/standalone"
if [ -d "${STANDALONE_DIR}" ]; then
  cp -r "${APP_DIR}/apps/web/.next/static" "${STANDALONE_DIR}/apps/web/.next/"
  cp -r "${APP_DIR}/apps/web/public"       "${STANDALONE_DIR}/apps/web/"
  echo "      ✅ Static and public assets copied."
else
  echo "      ❌ ERROR: Standalone directory not found at ${STANDALONE_DIR}"
  exit 1
fi

# ── Step 7: Zero-downtime PM2 reload ───────────────────────
echo "[7/8] Reloading PM2 processes..."
pm2 reload ecosystem.config.js --update-env
pm2 save
echo "      ✅ PM2 processes reloaded."

# ── Step 8: Nginx reload & Health checks ───────────────────
echo "[8/8] Verifying Nginx and services..."
sudo nginx -t && sudo systemctl reload nginx

sleep 5  # Give PM2 processes a moment to stabilize

API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4000/api/v1/health)
if [ "${API_STATUS}" == "200" ]; then
  echo "      ✅ API is healthy (HTTP 200)"
else
  echo "      ⚠️  API returned HTTP ${API_STATUS} — check 'pm2 logs jest-api'"
fi

WEB_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/)
if [ "${WEB_STATUS}" == "200" ] || [ "${WEB_STATUS}" == "307" ] || [ "${WEB_STATUS}" == "308" ]; then
  echo "      ✅ Frontend is healthy (HTTP ${WEB_STATUS})"
else
  echo "      ⚠️  Frontend returned HTTP ${WEB_STATUS} — check 'pm2 logs jest-web'"
fi

echo ""
echo "--- PM2 Status ---"
pm2 status

echo ""
echo "======================================================"
echo "  ✅ Deployment complete!"
echo "  Application live at: http://52.66.15.81"
echo "  API health: http://52.66.15.81/api/v1/health"
echo "======================================================"
