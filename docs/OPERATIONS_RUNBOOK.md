# JEST Enterprise CRM & Brokerage Platform — Operations Runbook & Incident Management

## Overview
This runbook provides operational instructions for monitoring infrastructure health, managing BullMQ background queues, handling system alerts, and resolving incidents.

## Key Health Monitoring Endpoints
- **NestJS System Health**: `GET /api/v1/health`
- **BullMQ Queue Metrics**: `GET /api/v1/queue/stats`
- **Audit Logs Stream**: `GET /api/v1/audit`
- **Live System Metrics**: `GET /api/v1/admin/config/metrics`

## Incident Response Procedures

### 1. High API Latency or Connection Timeouts
- **Check**: Inspect CPU & memory usage via `docker stats`.
- **Action**: Check PostgreSQL connection pool capacity in `schema.prisma`. Increase pool size if needed.

### 2. BullMQ Failed Jobs or Dead Letter Queue Build-up
- **Check**: Inspect `/admin/health` BullMQ dashboard.
- **Action**: Restart queue processor worker via `docker restart jest-api-worker`. Re-trigger failed jobs via `POST /api/v1/queue/retry-failed`.

### 3. Redis Connectivity Lost
- **Check**: Verify Redis container status: `docker ps | grep redis`.
- **Action**: Restart Redis container `docker restart jest-redis`. NestJS fallback cache will maintain basic operations.
