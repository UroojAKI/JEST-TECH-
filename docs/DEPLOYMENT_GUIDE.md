# JEST Enterprise CRM & Brokerage Platform — Production Deployment & Operations Guide

## Overview
This document details production deployment procedures, Docker Compose orchestration, PostgreSQL database backups, Redis caching, MinIO S3 storage configurations, and disaster recovery runbooks.

## Infrastructure Stack
- **Web App**: Next.js 16 (Turbopack SSR/SSG), React 19, TailwindCSS, Recharts.
- **Backend API**: NestJS (TypeScript REST API), Prisma ORM, BullMQ queue workers.
- **Database**: PostgreSQL 15+ Relational Database.
- **Cache & Queue**: Redis 5.0+ (BullMQ job queues & session store).
- **Object Storage**: MinIO S3-compatible storage or AWS S3.

## Environment Variables Configuration
Ensure the following variables are present in production `.env`:
```env
PORT=4000
NODE_ENV=production
DATABASE_URL=postgresql://user:password@postgres:5432/jest_crm?schema=public
REDIS_HOST=redis
REDIS_PORT=6380
JWT_SECRET=super-secret-jwt-key-minimum-32-chars
STORAGE_PROVIDER=minio
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
ALLOWED_ORIGINS=https://app.jestpolicy.com,http://localhost:3000
```

## Docker Deployment Steps
```bash
# 1. Build and launch containers
docker compose -f docker-compose.yml up -d --build

# 2. Run Database Migrations & Seed Data
pnpm --filter api exec prisma migrate deploy
pnpm --filter api exec prisma db seed

# 3. Verify Health Checks
curl -f http://localhost:4000/api/v1/health
```

## Database Backup & Restore Runbook
```bash
# Backup PostgreSQL Database
pg_dump -U jest_user -d jest_crm -F c -b -v -f /backups/jest_crm_$(date +%Y%m%d_%H%M%S).dump

# Restore PostgreSQL Database
pg_restore -U jest_user -d jest_crm -v /backups/jest_crm_latest.dump
```
