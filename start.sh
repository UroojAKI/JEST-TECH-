#!/usr/bin/env bash
# ==============================================================================
# start.sh - Build and start the JEST Policy CRM using Docker
# Usage: ./start.sh
# ==============================================================================
set -euo pipefail

# Always run from the folder this script lives in
cd "$(dirname "$0")"

echo "==> Checking Docker..."
if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: Docker is not installed. Install Docker Desktop first." >&2
  exit 1
fi
if ! docker info >/dev/null 2>&1; then
  echo "ERROR: Docker is not running. Start Docker Desktop and try again." >&2
  exit 1
fi

# First run only: create .env with strong random secrets (never committed to git)
if [ ! -f .env ]; then
  echo "==> Creating .env with random secrets..."
  {
    echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)"
    echo "JWT_SECRET=$(openssl rand -hex 32)"
    echo "JWT_REFRESH_SECRET=$(openssl rand -hex 32)"
    echo "PII_ENCRYPTION_KEY=$(openssl rand -hex 32)"
    echo "RAZORPAY_WEBHOOK_SECRET=$(openssl rand -hex 32)"
  } > .env
fi

echo "==> Building images (first run can take 5-10 minutes)..."
docker compose build

echo "==> Starting Postgres and Redis..."
docker compose up -d --wait postgres redis

echo "==> Running database migrations..."
docker compose run --rm --no-deps api sh -c "cd apps/api && npx prisma migrate deploy"

echo "==> Starting API and web app..."
docker compose up -d

echo ""
echo "JEST Policy CRM is running:"
echo "  Web app : http://localhost:3000"
echo "  API     : http://localhost:4001/api/v1"

echo ""
echo "View logs : docker compose logs -f"
echo "Stop      : docker compose down"
