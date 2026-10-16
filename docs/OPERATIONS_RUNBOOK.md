# JEST Enterprise CRM & Brokerage Platform — Operations Runbook & Incident Management

## Overview
This runbook provides operational instructions for monitoring infrastructure health, managing BullMQ background queues, handling system alerts, and resolving incidents.

## Key Health Monitoring Endpoints
- **NestJS System Health**: `GET /api/v1/health`
- **BullMQ Queue Metrics**: `GET /api/v1/queue/statistics`
- **BullMQ Job List**: `GET /api/v1/queue/jobs?status=FAILED`
- **Audit Logs Stream**: `GET /api/v1/audit`
- **Live System Metrics**: `GET /api/v1/admin/config/metrics`

## Incident Response Procedures

### 1. High API Latency or Connection Timeouts
- **Check**: Inspect CPU & memory usage via `docker stats`.
- **Action**: Check PostgreSQL connection pool capacity in `schema.prisma`. Increase pool size if needed.

### 2. BullMQ Failed Jobs or Dead Letter Queue Build-up
- **Check**: As an authorized admin, inspect `GET /api/v1/queue/statistics` and `GET /api/v1/queue/jobs?status=FAILED`.
- **Action**: Queue processors run inside the NestJS API process in the checked-in Compose stack. If the API process is unhealthy, follow the API restart procedure for the actual service (`jest-api` in root Compose). Retry one recorded job with `POST /api/v1/queue/jobs/{id}/retry`; verify its new status through the jobs endpoint.

### 3. Redis Connectivity Lost
- **Check**: Verify Redis container status: `docker ps | grep redis`.
- **Action**: Restart Redis container `docker restart jest-redis`, then check `/api/v1/health/ready` and queue statistics. The impact of Redis loss depends on which queue/cache-backed features are in use; do not assume queued work completed while Redis was unavailable.
