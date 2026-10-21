# Domain J — Infrastructure & DevOps Audit

**Target System**: JEST Policy CRM  
**Audit Scope**: Production-Readiness Evaluation of Containerization, Orchestration, Environment Security, Health Probes, and Disaster Recovery  
**Auditor**: Infrastructure & DevOps Specialist (Domain J Auditor)  
**Date**: October 19, 2026  
**Status**: **FAIL / CONDITIONAL RISK — REMEDIATION REQUIRED PRIOR TO PRODUCTION LAUNCH**

---

## Summary

A comprehensive, evidence-based audit of Domain J (Infrastructure & DevOps) was performed across the JEST Policy CRM repository. The audit evaluated container definitions (`Dockerfile`, `docker-compose.yml`), Kubernetes manifests (`k8s/`), environment schemas, startup lifecycle guards, health endpoints, Redis authentication propagation, and database migration/rollback scripts.

### Key Strengths:
1. **Startup Security & Fail-Closed Guardrails (J-04)**: `apps/api/src/main.ts` implements robust pre-bootstrap validation preventing the API from starting if `JWT_SECRET`, `JWT_REFRESH_SECRET`, or `PII_ENCRYPTION_KEY` are missing, shorter than 32 characters, or set to placeholder values in production.
2. **Comprehensive Health & Observability Endpoints (J-05)**: The health subsystem (`HealthController`, `HealthService`, NestJS Terminus) exposes multi-tier checks (`/api/v1/health`, `/api/v1/health/live`, `/api/v1/health/ready`), properly handles HTTP 200 vs 503 status codes, and is explicitly exempt from authentication and rate throttling.
3. **Network Isolation in Root Docker Compose (J-01)**: The root `docker-compose.yml` isolates the database and cache on an internal non-routable bridge (`jest_internal`), ensuring direct internet ingress is blocked.
4. **Non-Root Container Execution (J-02)**: Both API (`USER nestjs`) and Web (`USER nextjs`) Dockerfiles execute application runtimes as non-root unprivileged users.

### Critical Deficiencies Requiring Immediate Remediation:
1. **[P0] Broken Migration and Rollback Scripts (J-07)**: Root `package.json` scripts `migrate:case-status` and `rollback:case-status` point to TypeScript files (`scripts/migrate-motor-case-status.ts` and `scripts/rollback-motor-case-status.ts`) containing fatal syntax errors (unquoted raw SQL statements and unmatched parentheses). They fail esbuild parsing and cannot be executed.
2. **[P1] Production API Dockerfile Bloat & Attack Surface (J-02)**: Stage 4 (`runner`) of `apps/api/Dockerfile` copies the entire workspace directory from the installer stage (`COPY --from=installer /app ./`), bundling all devDependencies (compilers, linters, test harnesses) and TypeScript source files into the production image without pruning.
3. **[P1] Redis Authentication Disconnect in Kubernetes and Local Environments (J-06)**: While Redis `requirepass` is configured in Docker Compose, `k8s/api-configmap.yaml` provides a passwordless `REDIS_URL`, and `apps/api/.env` lacks credentials in `REDIS_URL`. If Redis authentication is enforced, API pods in Kubernetes and local environments fail with `NOAUTH`.
4. **[P1] Web Port & Healthcheck Discrepancy (J-01, J-02)**: In `apps/web/Dockerfile`, the container listens on port 3001 and probes `http://localhost:3001/api/health`. However, `docker-compose.yml` overrides `PORT=3000` and exposes `"3000:3000"` directly to `0.0.0.0`, resulting in container healthcheck failure and public exposure on all network interfaces.

---

## Findings

### J-01: Docker Compose Configuration — RISK
**Severity**: P1  
**File**: [docker-compose.yml](file:///e:/JEST%20TECH/JEST%20POLICY/jest-policy-crm/docker-compose.yml#L1-L106), [infrastructure/docker/docker-compose.yml](file:///e:/JEST%20TECH/JEST%20POLICY/jest-policy-crm/infrastructure/docker/docker-compose.yml#L1-L71)  

**Observed**:
1. **Redis `requirepass`**: Verified set in both compose files:
   - `docker-compose.yml:33`: `command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD:-jestredissecret2026}`
   - `infrastructure/docker/docker-compose.yml:32`: `command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD:-jestredissecret2026}`
2. **PostgreSQL Default Credentials**:
   - `docker-compose.yml:8`: `POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres}` defaults to insecure `postgres`.
   - `infrastructure/docker/docker-compose.yml:10`: `POSTGRES_PASSWORD: postgres` is hardcoded.
3. **Healthchecks**:
   - In root `docker-compose.yml`, `postgres` (line 15) and `redis` (line 34) have defined healthchecks.
   - However, `api` (lines 44-73) and `web` (lines 74-92) have **NO healthchecks** defined in `docker-compose.yml`.
   - In `infrastructure/docker/docker-compose.yml`, `redis`, `minio`, and `mailhog` have no healthchecks.
4. **Network Isolation**:
   - Root `docker-compose.yml` configures two custom networks: `jest_internal` (`internal: true`) and `jest_external`. `postgres` and `redis` reside strictly on `jest_internal`. `api` bridges both. `web` resides on `jest_external`. Network isolation is verified.
   - `infrastructure/docker/docker-compose.yml` has no network isolation (default bridge).
5. **Volume Persistence**:
   - `postgres_data` and `redis_data` are declared and mounted in root `docker-compose.yml` (lines 14, 32, 93-95).
   - In `infrastructure/docker/docker-compose.yml`, `redis` has **NO persistent volume mount**; restart purges cache and queue states.
6. **Port Bindings**:
   - `postgres`: `127.0.0.1:5432:5432` (secure loopback binding).
   - `redis`: `127.0.0.1:6380:6379` (secure loopback binding).
   - `api`: `127.0.0.1:4000:3000` (secure loopback binding).
   - `web`: `"3000:3000"` (Line 80: **unbound to loopback**, exposed on `0.0.0.0`).
   - In `infrastructure/docker/docker-compose.yml`, `minio` (`9000:9000`, `9001:9001`) and `mailhog` (`1025:1025`, `8025:8025`) are exposed to `0.0.0.0`.

**Expected**:
- PostgreSQL must not default to `postgres` password without explicit warning or enforcement.
- All orchestrated services in `docker-compose.yml` must define healthchecks and restart policies.
- Host ports should be bound to `127.0.0.1` unless specifically intended for ingress.

**Evidence**:
`docker-compose.yml` lines 8, 80:
```yaml
8:       POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres}
...
80:      - "3000:3000"
```
`infrastructure/docker/docker-compose.yml` lines 9-10, 50-52:
```yaml
9:       POSTGRES_USER: postgres
10:      POSTGRES_PASSWORD: postgres
...
50:     ports:
51:       - "9000:9000"
52:       - "9001:9001"
```

**Impact**:
Running `docker-compose up` on a host exposes the frontend web application and MinIO storage across the local network/internet. Default database credentials introduce significant risk if deployed in shared staging environments.

**Recommendation**:
1. Change `docker-compose.yml` line 80 to `"127.0.0.1:3000:3000"`.
2. Add healthcheck definitions for `api` (`http://localhost:3000/api/v1/health`) and `web` in `docker-compose.yml`.
3. Add volume persistence to Redis in `infrastructure/docker/docker-compose.yml`.

---

### J-02: Dockerfile Security & Build — FAIL
**Severity**: P1  
**File**: [apps/api/Dockerfile](file:///e:/JEST%20TECH/JEST%20POLICY/jest-policy-crm/apps/api/Dockerfile#L1-L70), [apps/web/Dockerfile](file:///e:/JEST%20TECH/JEST%20POLICY/jest-policy-crm/apps/web/Dockerfile#L1-L41)  

**Observed**:
1. **Multi-Stage Builds**:
   - `apps/api/Dockerfile`: 4-stage build (`base`, `pruner`, `installer`, `runner`).
   - `apps/web/Dockerfile`: 2-stage build (`builder`, `runner`).
2. **Base Image Versioning**:
   - Both Dockerfiles use `node:24-alpine` (floating major tag).
   - Neither pins the patch release (e.g. `node:24.18.0-alpine`) nor specifies a cryptographic digest (`@sha256:...`).
   - Node 24 is Current/experimental, rather than Active LTS (Node 22 LTS).
3. **Non-Root Execution**:
   - `apps/api/Dockerfile`: Configures `nestjs` user (`USER nestjs`, lines 54-62).
   - `apps/web/Dockerfile`: Configures `nextjs` user (`USER nextjs`, lines 26-33).
4. **Secret Leakage in Build**:
   - Root `.dockerignore` exists and ignores `.env` and `.env.*`.
   - Neither Dockerfile embeds secrets during image build.
5. **Dev Dependencies in Production Image**:
   - In `apps/api/Dockerfile`:
     - Line 32: `RUN pnpm install --frozen-lockfile` (installs all devDependencies).
     - Line 60: `COPY --from=installer --chown=nestjs:nodejs /app ./` copies the ENTIRE `/app` directory into the runner container.
     - Production image contains TypeScript compilers, test frameworks, linting tooling, and source code. There is no `pnpm prune --prod`.
   - In `apps/web/Dockerfile`: Cleanly copies only Next.js standalone bundle (`.next/standalone ./`).
6. **HEALTHCHECK Port Discrepancy**:
   - `apps/api/Dockerfile:66-67`: Correctly checks `http://localhost:3000/api/v1/health`.
   - `apps/web/Dockerfile:23, 37-38`: Defines `ENV PORT=3001` and checks `http://localhost:3001/api/health`. However, `docker-compose.yml:83` overrides `PORT: 3000`. When run under compose, the web server listens on port 3000 while the internal healthcheck continues probing port 3001, resulting in container healthcheck failure.

**Expected**:
- Production images must pin immutable base image tags (e.g., `node:22.14.0-alpine3.21@sha256:...`).
- Production images must contain only production dependencies (`node_modules`) and compiled distribution artifacts (`dist/`).
- Healthcheck probe ports must dynamically respect or align with runtime port assignments.

**Evidence**:
`apps/api/Dockerfile` lines 4, 32, 46, 60:
```dockerfile
4:  FROM node:24-alpine AS base
...
32: RUN pnpm install --frozen-lockfile
...
46: FROM node:24-alpine AS runner
...
60: COPY --from=installer --chown=nestjs:nodejs /app ./
```
`apps/web/Dockerfile` lines 23, 38:
```dockerfile
23: ENV PORT=3001
...
38:   CMD wget -q --spider http://localhost:3001/api/health || exit 1
```

**Impact**:
Bloated production container images (>1.5 GB vs ~250 MB), increased CVE exposure from unpruned development packages in the runtime container, non-deterministic builds across CI runners, and failing Docker health status for `jest-web`.

**Recommendation**:
1. Pin base images to LTS: `FROM node:22.14.0-alpine3.21`.
2. In `apps/api/Dockerfile`, execute `pnpm prune --prod` before copying to runner, and copy only `dist/`, production `node_modules`, `prisma/`, and `package.json`.
3. Standardize web port to 3000 across `apps/web/Dockerfile` and `docker-compose.yml`.

---

### J-03: Environment Variable Completeness & Schema Validation — RISK
**Severity**: P2  
**File**: [.env.example](file:///e:/JEST%20TECH/JEST%20POLICY/jest-policy-crm/.env.example#L1-L52), [apps/api/src/modules/platform/configuration/env.schema.ts](file:///e:/JEST%20TECH/JEST%20POLICY/jest-policy-crm/apps/api/src/modules/platform/configuration/env.schema.ts#L1-L110)  

**Observed**:
1. **Search Results**:
   `Get-ChildItem -Recurse -Filter '.env*' apps/api/ | Where-Object { $_.Name -ne '.env.example' } | Select-Object FullName,Length`
   - Found: `apps/api/.env` (737 bytes).
   - Also verified root `.env` (737 bytes).
   - Both files are git-ignored (`git check-ignore` confirms exclusion).
2. **Hardcoded Secrets**:
   - `apps/api/.env` and `.env` contain standard dev values:
     - `JWT_SECRET="JEST_POLICY_SUPER_SECRET_KEY_CHANGE_IN_PRODUCTION_2026"`
     - `PII_ENCRYPTION_KEY="jest-policy-crm-dev-pii-key-2026-32b!"`
     - `RAZORPAY_WEBHOOK_SECRET="rzp_dev_webhook_secret_placeholder"`
3. **`env.schema.ts` Validation**:
   - Enforces `NODE_ENV`, `PORT`, `APP_NAME`, `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN`, `REDIS_URL`, `ALLOWED_ORIGINS`, `PII_ENCRYPTION_KEY`, and `RAZORPAY_WEBHOOK_SECRET`.
   - In production (`NODE_ENV === 'production'`), refine block strictly forbids default/placeholder patterns for `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `PII_ENCRYPTION_KEY`, and `RAZORPAY_WEBHOOK_SECRET`.
4. **Cross-Reference Gaps**:
   - `REDIS_PASSWORD`: Used in `docker-compose.yml` and `k8s/api-secret.yaml`, but **omitted** from `env.schema.ts` and `.env.example`.
   - `REDIS_ENABLED`: Used throughout `AppModule`, `HealthService`, `RateLimitingModule`, `QueueModule`, but **omitted** from `env.schema.ts`.
   - `METRICS_SCRAPE_TOKEN`: Present in `.env.example`, but **omitted** from `env.schema.ts`.
   - `ENABLE_SWAGGER`: Present in `.env.example`, but **omitted** from `env.schema.ts`.

**Expected**:
- All environment variables read by the application or infrastructure manifests must be declared and validated in `env.schema.ts` and documented in `.env.example`.

**Evidence**:
`apps/api/src/modules/platform/configuration/env.schema.ts` lines 27-59:
```typescript
27: export const envSchema = z
28:   .object({
29:     NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
30:     PORT: z.string().transform((val) => parseInt(val, 10)).default('4000' as any),
31:     APP_NAME: z.string().default('JEST Policy CRM API'),
32:     DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/jest_policy_crm?schema=public'),
33:     JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
34:     JWT_EXPIRES_IN: z.string().default('15m'),
35:     JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
36:     JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
37:     REDIS_URL: z.string().default('redis://localhost:6379'),
38:     ALLOWED_ORIGINS: z.string().default('http://localhost:3000,http://localhost:3001'),
39:     PII_ENCRYPTION_KEY: z.string().min(32, 'PII_ENCRYPTION_KEY must be at least 32 characters').optional(),
40:     RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
41:   })
```

**Impact**:
Variables like `REDIS_ENABLED` and `METRICS_SCRAPE_TOKEN` bypass validation at boot time, creating unverified configuration states in staging and production.

**Recommendation**:
Add `REDIS_ENABLED: z.string().default('false')`, `METRICS_SCRAPE_TOKEN: z.string().optional()`, and `ENABLE_SWAGGER: z.string().default('false')` to `env.schema.ts`.

---

### J-04: Production Startup Safety & Graceful Shutdown — PASS
**Severity**: P0 Verification  
**File**: [apps/api/src/main.ts](file:///e:/JEST%20TECH/JEST%20POLICY/jest-policy-crm/apps/api/src/main.ts#L1-L191)  

**Observed**:
1. **Critical Env Var Validation**:
   - `validateJwtSecrets()` runs before `NestFactory.create()`.
   - Throws immediately if `JWT_SECRET` or `JWT_REFRESH_SECRET` is unset.
   - In production, rejects placeholder strings (`changeme`, `secret`, `placeholder`) and requires length >= 32 characters.
2. **PII Encryption Key Enforcement**:
   - Lines 81-88 enforce that `PII_ENCRYPTION_KEY` is set and >= 32 characters. Throws fatal Error halting startup if absent.
3. **Graceful Shutdown**:
   - `app.enableShutdownHooks()` is called at lines 91 and 182.
   - Graceful termination propagates to providers (`PrismaService.$disconnect()`, `RedisCacheService.disconnect()`, `BullMQProvider.onApplicationShutdown()`).
4. **Configurable Port Binding**:
   - Line 184: `const port = process.env.PORT || 4000; await app.listen(port, '0.0.0.0');`
   - Binds to `'0.0.0.0'` inside container, with configurable `PORT`.

**Expected**:
- Application must fail fast before accepting connections if security keys are missing or invalid.
- Application must handle SIGTERM/SIGINT cleanly.

**Evidence**:
`apps/api/src/main.ts` lines 30-39, 81-88, 91, 184-185:
```typescript
35:   if (!jwtSecret || !jwtRefreshSecret) {
36:     throw new Error(
37:       'CRITICAL: JWT_SECRET and JWT_REFRESH_SECRET must be set in environment variables.',
38:     );
39:   }
...
81:   if (
82:     !process.env.PII_ENCRYPTION_KEY ||
83:     process.env.PII_ENCRYPTION_KEY.length < 32
84:   ) {
85:     throw new Error(
86:       'CRITICAL: PII_ENCRYPTION_KEY must be set and at least 32 characters. Application cannot start without it.',
87:     );
88:   }
...
91:   app.enableShutdownHooks();
...
184:  const port = process.env.PORT || 4000;
185:  await app.listen(port, '0.0.0.0');
```

**Impact**:
Guarantees fail-closed security. The application cannot start in production in an insecure or unencrypted state.

**Recommendation**:
Maintain current implementation.

---

### J-05: Health & Observability Endpoints — PASS
**Severity**: P1 Verification  
**File**: [apps/api/src/modules/health/health.controller.ts](file:///e:/JEST%20TECH/JEST%20POLICY/jest-policy-crm/apps/api/src/modules/health/health.controller.ts#L1-L79), [apps/api/src/modules/health/health.service.ts](file:///e:/JEST%20TECH/JEST%20POLICY/jest-policy-crm/apps/api/src/modules/health/health.service.ts#L1-L198), [apps/api/src/app.module.ts](file:///e:/JEST%20TECH/JEST%20POLICY/jest-policy-crm/apps/api/src/app.module.ts#L15,L100)  

**Observed**:
1. **Health Subsystem Architecture**:
   - `GET /api/v1/health`: Invokes `HealthService.checkV2()`. Checks database ping (`SELECT 1`), Redis ping (if enabled), Outbox event backlog, heap memory limit (512MB), and disk access.
   - `GET /api/v1/health/terminus`: Uses `@nestjs/terminus` indicator checks for database, storage, heap, and RSS.
   - `GET /api/v1/health/live`: Fast liveness endpoint returning uptime and status `'alive'`.
   - `GET /api/v1/health/ready`: Deep readiness probe checking active DB and Redis connections.
2. **Public Access & Rate Limiting Exemption**:
   - `@Public()` decorator is attached to `HealthController` (exempt from JWT auth).
   - `@SkipThrottle()` decorator is attached (exempt from throttler guard).
3. **HTTP Status Code Mapping**:
   - In `/api/v1/health`: Returns HTTP 200 for `'ok'` or `'degraded'`; returns HTTP 503 for `'down'`.
   - In `/api/v1/health/ready`: Returns HTTP 200 if ready; throws `ServiceUnavailableException` (HTTP 503) if database or Redis cannot be pinged.
4. **Registration**:
   - `HealthModule` is registered in `AppModule` (`apps/api/src/app.module.ts:100`).

**Expected**:
- Health endpoints must be unauthenticated, unthrottled, reflect accurate downstream connectivity, and return 200/503 status codes.

**Evidence**:
`apps/api/src/modules/health/health.controller.ts` lines 20-23, 34-44, 70-77:
```typescript
20: @Public()
21: @SkipThrottle()
22: @Controller('health')
23: export class HealthController {
...
34:   async check(@Res({ passthrough: true }) res: Response) {
35:     const health = await this.health.checkV2();
36:     if (health.status === 'ok') {
37:       res.status(200);
38:     } else if (health.status === 'degraded') {
39:       res.status(200);
40:     } else {
41:       res.status(503);
42:     }
43:     return health;
44:   }
...
70:   @Get('ready')
71:   async ready() {
72:     const isReady = await this.health.checkReady();
73:     if (!isReady) {
74:       throw new ServiceUnavailableException({ status: 'not_ready' });
75:     }
76:     return { status: 'ready', timestamp: new Date().toISOString() };
77:   }
```

**Impact**:
Enables Kubernetes and Docker orchestrators to monitor container health and control traffic routing with zero authentication friction.

**Recommendation**:
Maintain current implementation.

---

### J-06: Redis Authentication Propagation — FAIL
**Severity**: P1  
**File**: [apps/api/src/modules/platform/queue/queue.module.ts](file:///e:/JEST%20TECH/JEST%20POLICY/jest-policy-crm/apps/api/src/modules/platform/queue/queue.module.ts#L24-L40), [apps/api/src/modules/platform/cache/redis-cache.service.ts](file:///e:/JEST%20TECH/JEST%20POLICY/jest-policy-crm/apps/api/src/modules/platform/cache/redis-cache.service.ts#L16), [k8s/api-configmap.yaml](file:///e:/JEST%20TECH/JEST%20POLICY/jest-policy-crm/k8s/api-configmap.yaml#L14), [k8s/api-secret.yaml](file:///e:/JEST%20TECH/JEST%20POLICY/jest-policy-crm/k8s/api-secret.yaml#L17)  

**Observed**:
1. **Application Connection Logic**:
   - `RedisCacheService`, `QueueModule` (BullMQ), `QueueEventsListener`, `HealthService`, `RateLimitingModule`, and `AppModule` connect via `REDIS_URL`.
   - Redis client libraries (`ioredis`, `bullmq`) parse standard authentication strings in URLs (`redis://:password@host:port`).
2. **Compose Authentication Propagation**:
   - In root `docker-compose.yml:56`, `REDIS_URL` correctly injects the password:
     `REDIS_URL: ${REDIS_URL:-redis://:${REDIS_PASSWORD:-jestredissecret2026}@redis:6379}`.
3. **Disconnected Authentication in Kubernetes & Local Dev**:
   - In `apps/api/.env:6`, `REDIS_URL` is set to `redis://127.0.0.1:6380` (no password), despite `infrastructure/docker/docker-compose.yml` enforcing `--requirepass ${REDIS_PASSWORD:-jestredissecret2026}`.
   - In `k8s/api-configmap.yaml:14`, `REDIS_URL` is configured as `redis://redis-master.jest-policy.svc.cluster.local:6379` without a password.
   - In `k8s/api-secret.yaml:17`, `REDIS_PASSWORD` is defined as a Secret, but `k8s/api-deployment.yaml` only passes `REDIS_URL` from ConfigMap. The API cannot combine the Secret password with the ConfigMap URL.

**Expected**:
- Redis authentication credentials must be consistently propagated into the Redis connection string across all deployment targets (Docker Compose, Kubernetes, and local environments).

**Evidence**:
`k8s/api-configmap.yaml` line 14:
```yaml
14:   REDIS_URL: "redis://redis-master.jest-policy.svc.cluster.local:6379"
```
`k8s/api-secret.yaml` line 17:
```yaml
17:   REDIS_PASSWORD: "CHANGE_ME_REDIS_PASSWORD"
```
`apps/api/.env` line 6:
```bash
6: REDIS_URL="redis://127.0.0.1:6380"
```

**Impact**:
When Redis authentication is enabled in a Kubernetes deployment or local development environment, the API fails with `NOAUTH Authentication required.` on cache, rate limiting, and BullMQ job processing.

**Recommendation**:
1. In `apps/api/.env`, update to `REDIS_URL="redis://:jestredissecret2026@127.0.0.1:6380"`.
2. In `k8s/api-deployment.yaml`, construct `REDIS_URL` dynamically from `REDIS_PASSWORD` secret or place `REDIS_URL` with embedded secret credentials into `api-secret.yaml`.

---

### J-07: Migration Rollback and Disaster Recovery — FAIL
**Severity**: P0  
**File**: [scripts/migrate-motor-case-status.ts](file:///e:/JEST%20TECH/JEST%20POLICY/jest-policy-crm/scripts/migrate-motor-case-status.ts#L23-L34), [scripts/rollback-motor-case-status.ts](file:///e:/JEST%20TECH/JEST%20POLICY/jest-policy-crm/scripts/rollback-motor-case-status.ts#L10-L31), [package.json](file:///e:/JEST%20TECH/JEST%20POLICY/jest-policy-crm/package.json#L19-L20)  

**Observed**:
1. **Root `package.json` Registration**:
   - `package.json:19`: `"migrate:case-status": "tsx scripts/migrate-motor-case-status.ts"`
   - `package.json:20`: `"rollback:case-status": "tsx scripts/rollback-motor-case-status.ts"`
2. **Fatal Syntax Errors in Both Scripts**:
   - `scripts/migrate-motor-case-status.ts:24-32`:
     ```typescript
     const migrated = await prisma.$transaction(async (tx) => {
       const r1 = await tx.$executeRawUnsafe(
         UPDATE motor_quotation_cases SET status = 'DRAFT'::"motorCaseStatus" WHERE status = 'OPEN'::"MotorCaseStatus"
       );
       ...
     ```
     The raw SQL query is unquoted. Attempting to execute `npx tsx scripts/migrate-motor-case-status.ts` fails instantly with:  
     `TransformError: Expected ")" but found "motor_quotation_cases"`.
   - `scripts/rollback-motor-case-status.ts:11-19`: Contains the exact same unquoted SQL error.
   - `scripts/rollback-motor-case-status.ts:30`: Contains an unmatched opening parenthesis:  
     `if (!fs.existsSync((outDir)) fs.mkdirSync(...)`.
3. **Missing Dry-Run Capabilities**:
   - Neither script parses `--dry-run` or provides preview execution (unlike `scripts/motor-migration-01.ts` which implements `--apply` dry-run safeguards).
4. **General Schema Migration Rollback Strategy**:
   - Prisma migrations in `apps/api/prisma/migrations` are forward-only with no `down.sql` scripts.
   - Disaster recovery relies on snapshot restoration, validated by `scripts/dr-drill.ps1` (`pg_dump` snapshot -> simulate corruption -> `pg_restore` point-in-time recovery).

**Expected**:
- Migration and rollback scripts defined in `package.json` must be syntactically valid, type-safe, and verifiable via dry-run simulation.

**Evidence**:
Command execution: `npx tsx scripts/migrate-motor-case-status.ts`
```text
Error: Transform failed with 1 error:
scripts/migrate-motor-case-status.ts:25:13: ERROR: Expected ")" but found "motor_quotation_cases"
    at failureErrorWithLog (...)
    at Socket.readFromStdout (...)
  name: 'TransformError'
```
Command execution: `npx tsx scripts/rollback-motor-case-status.ts`
```text
Error: Transform failed with 1 error:
scripts/rollback-motor-case-status.ts:12:13: ERROR: Expected ")" but found "motor_quotation_cases"
    at failureErrorWithLog (...)
    at Socket.readFromStdout (...)
  name: 'TransformError'
```

**Impact**:
Running `pnpm run migrate:case-status` or `pnpm run rollback:case-status` during an operational incident will immediately crash with a syntax error, leaving operations teams with zero automated rollback capability for motor case status changes.

**Recommendation**:
1. Fix syntax in `scripts/migrate-motor-case-status.ts`:
   Wrap SQL statements in template strings:
   `await tx.$executeRawUnsafe(\`UPDATE motor_quotation_cases SET status = 'DRAFT'::"motorCaseStatus" WHERE status = 'OPEN'::"MotorCaseStatus"\`);`
2. Fix syntax in `scripts/rollback-motor-case-status.ts`:
   Wrap SQL statements in template strings and fix parenthesis on line 30: `if (!fs.existsSync(outDir))`.
3. Add `--dry-run` flag support to both scripts, defaulting to dry-run unless `--apply` is explicitly passed.

---

## Remediation Priority Matrix

| Item | Finding | Severity | Component | Recommended Action |
| :--- | :--- | :--- | :--- | :--- |
| **J-07.1** | Syntax error in `migrate-motor-case-status.ts` | **P0** | Scripts | Wrap raw SQL in template strings; add dry-run mode |
| **J-07.2** | Syntax error in `rollback-motor-case-status.ts` | **P0** | Scripts | Wrap raw SQL in template strings and fix paren syntax |
| **J-02.1** | Full workspace and devDependencies in API runtime container | **P1** | Docker | Run `pnpm prune --prod` and copy only dist and prod deps |
| **J-02.2** | Floating base images (`node:24-alpine`) | **P1** | Docker | Pin to Active LTS release: `node:22.14.0-alpine3.21` |
| **J-02.3** | Web Dockerfile healthcheck port mismatch | **P1** | Docker / Compose | Align web healthcheck port to 3000 across Dockerfile and compose |
| **J-06.1** | Disconnected Redis auth in Kubernetes & local .env | **P1** | K8s / Env | Embed secret credentials in K8s `REDIS_URL` and update local `.env` |
| **J-01.1** | Web container port exposed to `0.0.0.0` in root compose | **P1** | Docker Compose | Bind `web` port to `127.0.0.1:3000:3000` |
| **J-01.2** | Missing compose healthchecks for `api` and `web` | **P2** | Docker Compose | Add healthcheck blocks for both services in root compose |
| **J-03.1** | Schema omissions (`REDIS_ENABLED`, `METRICS_SCRAPE_TOKEN`) | **P2** | Configuration | Add missing variables to `env.schema.ts` |
