# Domain N+O — Observability & Privacy/Governance Audit

**Audit Date:** October 19, 2026  
**Auditor:** Antigravity Production Readiness Agent  
**Domain:** Domain N — Observability & Monitoring & Domain O — Privacy & Governance  
**Scope:** Complete codebase audit of structured logging, correlation IDs, Prometheus telemetry, audit logging & immutability, health check endpoints, error tracking/APM, PII encryption at rest, API PII masking & leak vectors, data retention & soft deletes, IRDAI intermediary compliance, rate limiting & DDoS protection, and CORS security.  
**Repository Path:** `e:\JEST TECH\JEST POLICY\jest-policy-crm`  
**Overall Verdict:** **FAIL / HIGH RISK — PRODUCTION BLOCKER (CRITICAL PII STORAGE & API EXPOSURE GAPS; TELEMETRY & REPORTING INCOMPLETE)**

---

## Executive Summary

A comprehensive, evidence-backed audit of **Domain N (Observability & Monitoring)** and **Domain O (Privacy & Governance)** was conducted across `apps/api` and database schema definitions.

### Summary Scorecard
| Check ID | Description | Status | Severity | Notes |
|:---|:---|:---|:---|:---|
| **N-01** | Structured Logging & Request Correlation | **RISK** | P2 | RequestLogger uses JSON with correlationId, but default NestJS console logger is active globally; errors log as plain text. |
| **N-02** | Prometheus Metrics Exposure & Security | **RISK** | P1 | Scrape endpoint `/metrics` is hardened with `MetricsAuthGuard`, but business KPI metrics (`jest_crm_lead_created_total`, policies, premiums) are uninstrumented. |
| **N-03** | Audit Log Integrity & Tamper-Resistance | **RISK** | P2 | Strong append-only guardrails and immutability checks; however, user creation lacks audit logs, and claims/policies use fragmented history tables. |
| **N-04** | Health Check Subsystem | **PASS** | P3 | Robust `/health` (v2), `/health/terminus`, `/health/live`, `/health/ready` checking DB, Redis, Disk, Memory, and Outbox. |
| **N-05** | Error Tracking & Exception Telemetry | **RISK** | P2 | No APM/Error tracker (Sentry/Datadog); `GlobalExceptionFilter` sanitizes 500 responses but logs stack traces to unstructured stderr. `tracing.ts` is dead code. |
| **O-01** | PII Encryption at Rest | **FAIL** | **P1 (Critical)** | `EncryptionUtil` (AES-256-GCM + scrypt) is implemented, but **never invoked on database writes**. PAN and Aadhaar are stored as plain text in PostgreSQL. |
| **O-02** | PII Exposure & Masking in APIs | **FAIL** | **P1 (Critical)** | Masking implemented in Contacts and Accounts, but **unmasked PAN and Aadhaar are leaked** via `GET /quotations/:id` and `GET /leads/:id`. |
| **O-03** | Data Retention & Soft Delete | **PASS / RISK** | P2 | Soft-delete (`deletedAt`) is implemented across all major models. However, zero automated retention purging or 3-year IRDAI lifecycle enforcement exists. |
| **O-04** | IRDAI Intermediary Obligations | **RISK** | P2 | Statutory commission caps (15%/20%) and motor tariff rules are enforced; agent license numbers lack format validation, and no statutory returns module exists. |
| **O-05** | Rate Limiting & DDoS Protection | **PASS** | P3 | Global `CustomThrottlerGuard` with Redis fallback; strict 20 req/min limit on `/auth/login`; reverse proxy trust configured. |
| **O-06** | CORS Configuration | **PASS** | P3 | Strict whitelist via `ALLOWED_ORIGINS` with fail-closed behavior in production; explicit methods and headers configured. |

---

## Domain N: Observability Findings

### N-01: Incomplete Structured Logging Adoption & Hybrid Log Formats — RISK
**Severity**: P2  
**File**: `apps/api/src/main.ts:90`, `apps/api/src/common/logger/structured-logger.service.ts:5-59`, `apps/api/src/common/filters/global-exception.filter.ts:14-67`  

**Observed**:
1. In `apps/api/src/main.ts:90`, the application bootstrap does NOT supply a custom logger to `NestFactory.create`:
   ```typescript
   const app = await NestFactory.create(AppModule, { rawBody: true });
   ```
   As a result, NestJS initializes with the built-in `ConsoleLogger` emitting ANSI-colored, human-readable console strings for framework initialization and service logs.
2. A custom `StructuredLoggerService` exists at `apps/api/src/common/logger/structured-logger.service.ts` which outputs JSON formatted lines:
   ```json
   {"timestamp":"2026-10-19T10:45:00.000Z","level":"LOG","correlationId":"...","context":"HTTP","method":"GET","url":"/api/v1/leads","statusCode":200,"executionTimeMs":45,"ip":"::1","userAgent":"...","userId":"..."}
   ```
3. `RequestLoggerMiddleware` (`apps/api/src/common/middleware/request-logger.middleware.ts:7`) uses `StructuredLoggerService` to output clean JSON logs on HTTP completion.
4. However, `GlobalExceptionFilter` (`apps/api/src/common/filters/global-exception.filter.ts:14`) instantiates `new Logger('ExceptionFilter')` (NestJS default logger), and application services (e.g., `s3-storage.provider.ts:62`, `claim.listener.ts:15`, `prisma.service.ts:35`) use the standard NestJS `Logger`. When an unhandled exception occurs, it logs as an unstructured multi-line terminal string rather than structured JSON.
5. **Correlation ID**: Fully implemented via `CorrelationIdMiddleware` (`apps/api/src/common/middleware/correlation-id.middleware.ts:8-18`) which checks `x-correlation-id`, assigns a `randomUUID()`, sets response header `x-correlation-id`, and stores it in `correlationStorage = new AsyncLocalStorage<string>()`.
6. **Sensitive Field Scrubbing in Logs**:
   - HTTP request bodies are not logged by `RequestLoggerMiddleware`, preventing password/token leakage in routine HTTP access logs.
   - However, query parameters are logged in `originalUrl` (`apps/api/src/common/middleware/request-logger.middleware.ts:28`). If sensitive parameters (e.g. `?panNumber=...` or `?token=...`) are passed in URLs, they appear in plain text in logs.

**Expected**:
- The application should register `app.useLogger(app.get(StructuredLoggerService))` or pass `logger: new StructuredLoggerService()` to `NestFactory.create`.
- All exception filters and service loggers should emit JSON objects containing `level`, `timestamp`, `correlationId`, `context`, `message`, `stack`, and metadata.
- Query parameters in request URLs should be scrubbed for sensitive keys (e.g. `pan`, `token`, `secret`, `aadhaar`).

**Evidence**:
`apps/api/src/main.ts:90`:
```typescript
const app = await NestFactory.create(AppModule, { rawBody: true });
```
`apps/api/src/common/filters/global-exception.filter.ts:14, 64-67`:
```typescript
private readonly logger = new Logger('ExceptionFilter');
...
this.logger.error(
  `Request failed at ${request.method} ${request.url} with status ${status}: ${exception.message || JSON.stringify(rawResponse)}`,
  exception.stack,
);
```

**Impact**:
Log aggregators (e.g. Elasticsearch, Grafana Loki, CloudWatch) will ingest a mixture of plain text and JSON strings. Searching or alerting on production stack traces and exceptions will fail or require brittle multi-line regex parsing.

**Recommendation**:
1. Configure `app.useLogger(new StructuredLoggerService())` in `apps/api/src/main.ts`.
2. Refactor `GlobalExceptionFilter` to inject or instantiate `StructuredLoggerService` so that exception traces and correlation IDs are emitted as structured JSON fields.
3. Add URL query string sanitization in `RequestLoggerMiddleware` to mask sensitive query keys.

---

### N-02: Missing Business KPI Telemetry in Prometheus Metrics — RISK
**Severity**: P1  
**File**: `apps/api/src/modules/health/metrics.controller.ts:14-34`, `apps/api/src/common/interceptors/metrics.interceptor.ts:24-34`  

**Observed**:
1. `prom-client` and `@willsoto/nestjs-prometheus` are properly installed and registered via `ObservabilityModule` and `MetricsController`.
2. Telemetry endpoint `GET /api/v1/metrics` is securely protected by `MetricsAuthGuard` (`apps/api/src/modules/health/guards/metrics-auth.guard.ts`), requiring either a scraper token (`x-metrics-token` or `Bearer <METRICS_SCRAPE_TOKEN>` >= 16 chars) or an authenticated user with `ADMIN` role. Public unauthenticated access correctly returns 401 Unauthorized, and non-admin access returns 403 Forbidden.
3. System and runtime metrics (`process_cpu_user_seconds_total`, heap memory, event loop lag) and request duration histogram `jest_crm_api_request_duration_ms` are recorded via `MetricsInterceptor`.
4. **Business Metric Instrumentation Defect**:
   - `leadCreatedCounter` (`jest_crm_lead_created_total`) is defined in `metrics.controller.ts:14`, but a workspace-wide search reveals that it is **NEVER imported or incremented** anywhere in `leads.service.ts` or lead creation flows.
   - Key business KPIs such as `policy_issued_total`, `premium_amount_sum`, `claims_reported_total`, or `quotations_generated_total` are **completely absent** from Prometheus metrics.

**Expected**:
- `leadCreatedCounter.inc({ source: lead.source })` should be executed whenever a lead is created.
- Prometheus counters and gauges for `jest_crm_policy_issued_total`, `jest_crm_premium_amount_inr_sum`, `jest_crm_claims_reported_total`, and `jest_crm_quote_conversion_ratio` should be defined and incremented in respective business workflows.

**Evidence**:
Workspace search for `leadCreatedCounter`:
```powershell
Get-ChildItem -Recurse apps/api/src -Filter *.ts | Select-String -Pattern 'leadCreatedCounter'
# Result: Only 1 occurrence found across entire repository — at definition in metrics.controller.ts:14
```
`apps/api/src/modules/health/metrics.controller.ts:14-22`:
```typescript
export const leadCreatedCounter =
  (register.getSingleMetric(
    'jest_crm_lead_created_total',
  ) as Counter<string>) ||
  new Counter({
    name: 'jest_crm_lead_created_total',
    help: 'Total number of leads created',
    labelNames: ['source'],
  });
```

**Impact**:
Prometheus dashboards and Prometheus alerting rules (Alertmanager) cannot monitor insurance operations, business velocity, conversion drops, or abnormal revenue spikes/drops.

**Recommendation**:
Export a dedicated `MetricsService` or instrument domain services (`LeadsService`, `IssuePolicyService`, `MotorPolicyIssuanceService`, `ClaimsService`) to increment Prometheus counters and track premium totals with labels for line of business (`MOTOR`, `HEALTH`, `LIFE`).

---

### N-03: Audit Log Fragmentation and Unaudited User Creation — RISK
**Severity**: P2  
**File**: `apps/api/prisma/schema.prisma:491-532`, `apps/api/src/modules/platform/audit/services/audit.service.ts:23-179`, `apps/api/src/modules/users/services/users.service.ts:49-181`, `apps/api/src/modules/policies/services/commands/issue-policy.service.ts:360`  

**Observed**:
1. **Schema & Model**: The `AuditLog` model in `apps/api/prisma/schema.prisma:491-532` includes `id`, `action`, `entity`, `entityId`, `oldValue`, `newValue`, `ipAddress`, `userAgent`, `userId`, `performedById`, `entityType`, `metadata`, `correlationId`, `module`, and `createdAt`.
2. **Immutability & Access Control**:
   - `AuditController` (`apps/api/src/modules/platform/audit/controllers/audit.controller.ts`) exposes only `GET` and `GET /export`. No `POST`, `PUT`, `PATCH`, or `DELETE` endpoints exist.
   - All audit routes require `ADMIN` role and are scoped to the administrator's `companyId` (tenant isolation).
   - `AuditService.assertImmutableOperation()` explicitly blocks any runtime database modification:
     ```typescript
     if (['update', 'updatemany', 'delete', 'deletemany', 'upsert'].includes(operation.toLowerCase())) {
       throw new ForbiddenException('Audit logs are append-only and strictly immutable under IRDAI regulations (G023). Updates and deletions are forbidden.');
     }
     ```
   - `AuditService.sanitizeAuditPayload()` automatically redacts passwords, tokens, API keys, and masks Aadhaar, PAN, and Bank Account numbers before writing to `AuditLog`.
3. **Gaps in Critical Operations**:
   - **Login**: Properly audited in `auth.service.ts:219` and replay attack logged at `auth.service.ts:304`.
   - **Motor Policy Issuance**: Audited in `motor-policy-issuance.service.ts:770` via `tx.auditLog.create`.
   - **User Creation**: `UsersService.create()` (`users.service.ts:49-181`) creates users and agents but **does NOT create an audit log entry**. Only status transitions (`users.service.ts:355`) write an audit log.
   - **Audit Trail Fragmentation**: General life/health policy issuance writes to `PolicyHistory` (`policy_histories` table) via `policyRepository.addHistoryEntry()` (`issue-policy.service.ts:360`). Claim lifecycle transitions (approve, reject, settle, close) write to `ClaimHistory` (`claim_histories` table) rather than the unified `audit_logs` table.

**Expected**:
- Every critical lifecycle mutation — especially provisioning a new user/agent or issuing an insurance policy — must produce an immutable audit entry in `AuditLog`.
- Domain history tables (`PolicyHistory`, `ClaimHistory`) should either sync with or derive from the unified `AuditLog` table so compliance auditors can review a single chronological audit trail.

**Evidence**:
`apps/api/src/modules/users/services/users.service.ts:131-144`:
```typescript
const user = await this.userRepository.create({
  email: dto.email,
  passwordHash,
  firstName: dto.firstName,
  lastName: dto.lastName,
  phone: dto.phone,
  employeeCode: empCode,
  designation: (dto as any).designation,
  role: { connect: { id: role.id } },
  company: companyConnect,
  status: (dto as any).status || UserStatus.ACTIVE,
  branch: branchConnect,
  department: departmentConnect,
});
// Notice: No auditLog.create or createAuditLog is invoked here!
```

**Impact**:
Unauthorized account creation or privilege escalation cannot be verified via the audit log. Compliance officers auditing claim or policy changes must query disparate tables (`claim_histories`, `policy_histories`, `audit_logs`).

**Recommendation**:
Add `tx.auditLog.create({ data: { action: AuditAction.CREATE, entity: 'User', entityId: user.id, ... } })` inside `UsersService.create()`. Ensure all critical entity updates write to `AuditLog`.

---

### N-04: Health Check Subsystem Implementation — PASS
**Severity**: P3 (Informational / Verified)  
**File**: `apps/api/src/modules/health/health.controller.ts:20-78`, `apps/api/src/modules/health/health.service.ts:14-196`  

**Observed**:
1. `HealthController` provides four distinct endpoints:
   - `GET /api/v1/health`: Invokes `HealthService.checkV2()`, returning status (`ok`, `degraded`, or `down`) and sub-checks for:
     - **Database**: executes `SELECT 1` with latency measurement.
     - **Redis**: tests connection and ping with latency (when `REDIS_ENABLED === 'true'`).
     - **Outbox**: queries pending outbox event count (`PENDING`).
     - **Memory**: compares `heapUsedMB` against 512MB threshold (`ok` vs `degraded`).
     - **Disk**: verifies filesystem accessibility via `fs.statSync`.
   - `GET /api/v1/health/terminus`: Standard `@nestjs/terminus` health indicators (`PrismaHealthIndicator`, `DiskHealthIndicator` at 90% threshold, `MemoryHealthIndicator` at 512MB heap/RSS).
   - `GET /api/v1/health/live`: Unauthenticated Kubernetes liveness probe returning `{ status: 'alive', uptime, timestamp }`.
   - `GET /api/v1/health/ready`: Kubernetes readiness probe validating DB and Redis before accepting traffic. Returns HTTP 200 if connected; throws `ServiceUnavailableException` (HTTP 503) if disconnected.
2. Security & Throttling: Controller is marked with `@Public()` (bypasses JWT requirement) and `@SkipThrottle()` (exempt from rate limits so uptime monitors and load balancers are never blocked).
3. Status Codes: Returns HTTP 200 for `ok` and `degraded`, and HTTP 503 for `down`.

**Expected**:
Health check endpoint must verify core dependencies, be accessible to orchestrators, and return appropriate status codes.

**Evidence**:
`apps/api/src/modules/health/health.controller.ts:33-44`:
```typescript
@Get()
async check(@Res({ passthrough: true }) res: Response) {
  const health = await this.health.checkV2();
  if (health.status === 'ok') {
    res.status(200);
  } else if (health.status === 'degraded') {
    res.status(200);
  } else {
    res.status(503);
  }
  return health;
}
```

**Impact**:
Passes all operational requirements. Fully compatible with Docker Compose, Kubernetes probes, and reverse proxy health checks.

---

### N-05: Absence of External Error Tracking & Unconnected OpenTelemetry Tracing — RISK
**Severity**: P2  
**File**: `apps/api/package.json:28-60`, `apps/api/src/tracing.ts:1-21`, `apps/api/src/common/filters/global-exception.filter.ts:45-67`  

**Observed**:
1. No external APM or error tracking integration (e.g., Sentry, Datadog, Bugsnag, Rollbar) is installed in `package.json` or imported in `apps/api/src`.
2. An OpenTelemetry configuration file exists at `apps/api/src/tracing.ts` with `@opentelemetry/sdk-node` and auto-instrumentations, but it is **dead code**: it is never imported in `main.ts`, `app.module.ts`, or invoked via `-r ./dist/src/tracing.js` in `package.json` start scripts (`start:prod: node dist/main`).
3. `GlobalExceptionFilter` intercepts all unhandled errors, strips database and stack details for HTTP 500 responses (`Internal server error`), and outputs the message and stack trace to stderr:
   ```typescript
   this.logger.error(
     `Request failed at ${request.method} ${request.url} with status ${status}: ${exception.message || JSON.stringify(rawResponse)}`,
     exception.stack,
   );
   ```

**Expected**:
- Production enterprise systems should integrate with an APM/Error Aggregator (e.g. Sentry or Datadog) or wire OpenTelemetry distributed tracing to a collector (OTel Collector, Jaeger, Tempo).
- When errors occur, stack traces should include correlation IDs and be reported in real time to alert on-call engineers.

**Evidence**:
Search for APM packages:
```powershell
Get-ChildItem -Recurse apps/api/src -Filter *.ts | Select-String -Pattern 'Sentry|sentry|DataDog|datadog|bugsnag|Rollbar'
# 0 occurrences found
```
`apps/api/package.json:18`:
```json
"start:prod": "node dist/main"
// Does not load tracing.js (-r ./dist/src/tracing.js)
```

**Impact**:
Developers and operations rely exclusively on raw container log streams (`docker logs` / `kubectl logs`) to identify production errors. There is no automated error grouping, alerting on error rate spikes, or breadcrumb tracking.

**Recommendation**:
1. Connect OpenTelemetry SDK by adding `-r ./dist/src/tracing.js` to `start:prod` in `package.json` or initializing it at the top of `main.ts`.
2. Integrate an external APM/Sentry SDK in `GlobalExceptionFilter` to capture unhandled exceptions with request correlation IDs and user contexts.

---

## Domain O: Privacy & Governance Findings

### O-01: Cryptographic Utility Implemented but Unused: PII Stored in Plain Text — FAIL (P1 CRITICAL)
**Severity**: **P1 (Critical Production Blocker)**  
**File**: `apps/api/src/common/utils/encryption.util.ts:22-79`, `apps/api/src/modules/accounts/services/accounts.service.ts:86`, `apps/api/src/modules/contacts/services/contacts.service.ts:182-183`, `apps/api/prisma/schema.prisma:571, 657`  

**Observed**:
1. **Cryptographic Algorithm**: `EncryptionUtil` (`apps/api/src/common/utils/encryption.util.ts`) is well-designed. It uses `AES-256-GCM` with a 12-byte random IV (`crypto.randomBytes(12)`), a 16-byte random salt (`crypto.randomBytes(16)`), scrypt key derivation (`crypto.scryptSync(getPiiKey(), salt, 32)`), and stores the authentication tag.
2. **Key Enforcement**: `main.ts:81-88` strictly enforces that `PII_ENCRYPTION_KEY` is present and at least 32 characters long at startup; otherwise, it throws a fatal error and halts the process.
3. **CRITICAL DEFECT — ZERO AT-REST ENCRYPTION**:
   - `EncryptionUtil.encrypt()` and `EncryptionUtil.decrypt()` are **NEVER CALLED anywhere in the entire codebase**.
   - A global regex search for `\.encrypt\(` and `\.decrypt\(` across `apps/api/src` returns zero references.
   - When contacts are created in `ContactsService.create()` (`contacts.service.ts:182-183`), `panNumber` and `aadhaarNumber` are inserted directly into PostgreSQL in plain text:
     ```typescript
     panNumber: restDto.panNumber,
     aadhaarNumber: restDto.aadhaarNumber,
     ```
   - When accounts are created in `AccountsService.create()` (`accounts.service.ts:86`), `panNumber` is inserted directly in plain text:
     ```typescript
     panNumber: dto.panNumber,
     ```
   - Database queries (`findByPanNumber` in `account.repository.ts:180` and `duplicate-detection.service.ts:141`) execute plain-text SQL equality filters (`where: { panNumber, deletedAt: null }`).

**Expected**:
- PII fields (`aadhaarNumber`, `panNumber`, bank account numbers) must be encrypted using `EncryptionUtil.encrypt()` before persisting to the database.
- Read operations must decrypt the ciphertext via `EncryptionUtil.decrypt()`.
- Search/duplicate detection should utilize a blind index or HMAC hash (`panHash = hmac(panNumber)`) to allow deterministic lookups without storing plain text.

**Evidence**:
Workspace search for `.encrypt(` or `.decrypt(`:
```powershell
Get-ChildItem -Recurse apps/api/src -Filter *.ts | Select-String -Pattern '\.encrypt\(|\.decrypt\('
# Zero occurrences in any service, repository, or controller!
```
`apps/api/src/modules/contacts/services/contacts.service.ts:180-185`:
```typescript
const contact = await this.contactRepository.create({
  ...restDto,
  panNumber: restDto.panNumber,
  aadhaarNumber: restDto.aadhaarNumber,
  dateOfBirth: restDto.dateOfBirth ? new Date(restDto.dateOfBirth) : undefined,
  company: { connect: { id: targetCompanyId } },
  createdBy: { connect: { id: actor.userId } },
});
```

**Impact**:
**Severe IRDAI and DPDP Act 2023 violation**. Any database compromise, backup leak, SQL injection, or privileged database administrator access immediately exposes all customer PAN and Aadhaar records in clear text.

**Recommendation**:
1. Implement a Prisma client middleware or field encryption extension (`prisma-field-encryption` or custom `$use` hook) that transparently calls `EncryptionUtil.encrypt()` on write and `EncryptionUtil.decrypt()` on read for `Contact.panNumber`, `Contact.aadhaarNumber`, `Account.panNumber`, and `CustomerProfile.aadhaarNumber`.
2. Add a deterministic HMAC column (`panHash`, `aadhaarHash`) to `schema.prisma` for duplicate detection and index lookups.

---

### O-02: PII Data Exposure in Quotation and Lead API Responses — FAIL (P1 CRITICAL)
**Severity**: **P1 (Critical Security & Compliance Defect)**  
**File**: `apps/api/src/modules/quotation/mappers/quotation.mapper.ts:140-151`, `apps/api/src/modules/leads/services/leads.service.ts:705-723`  

**Observed**:
1. Masking utilities (`EncryptionUtil.maskPan()` and `EncryptionUtil.maskAadhaar()`) exist and are correctly used in `ContactMapper.toResponse()` and `AccountMapper.toResponse()`. Both endpoints default to masked values (`XXXXX1234F`, `XXXX-XXXX-9012`) and require an explicit `POST /:id/unmask` action with an audit reason.
2. **CRITICAL LEAK IN QUOTATION RESPONSES**:
   In `apps/api/src/modules/quotation/mappers/quotation.mapper.ts:140-151`, the quotation mapper constructs the contact response object without calling `EncryptionUtil.maskPan()` or `EncryptionUtil.maskAadhaar()`:
   ```typescript
   if (q.contact) {
     const c = q.contact;
     dto.contact = {
       id: c.id,
       firstName: c.firstName,
       lastName: c.lastName,
       email: c.email,
       phone: c.phone,
       panNumber: c.panNumber,                  // LEAK: Plain text PAN
       aadhaarNumber: (c as any).aadhaarNumber, // LEAK: Plain text Aadhaar
       address: (c as any).address,
     };
   }
   ```
   Any user authorized to view a quotation (`GET /api/v1/quotations/:id` or list quotations) bypasses all contact masking and receives the customer's full PAN and Aadhaar numbers.
3. **CRITICAL LEAK IN LEAD DETAILS RESPONSES**:
   In `apps/api/src/modules/leads/services/leads.service.ts:705-723`, `getLeadDetails()` directly maps `lead.contact` and `lead.account` without masking:
   ```typescript
   contact: lead.contact
     ? {
         id: lead.contact.id,
         ...
         panNumber: lead.contact.panNumber,    // LEAK: Plain text PAN
       }
     : null,
   account: lead.account
     ? {
         id: lead.account.id,
         ...
         panNumber: lead.account.panNumber,    // LEAK: Plain text PAN
       }
     : null,
   ```
   Any agent viewing lead details (`GET /api/v1/leads/:id`) receives unmasked PAN numbers without triggering the audit unmasking workflow.

**Expected**:
Every nested API response exposing contact or account details must mask `panNumber` and `aadhaarNumber` using `EncryptionUtil.maskPan()` and `EncryptionUtil.maskAadhaar()`.

**Evidence**:
`apps/api/src/modules/quotation/mappers/quotation.mapper.ts:147-148`:
```typescript
panNumber: c.panNumber,
aadhaarNumber: (c as any).aadhaarNumber,
```
`apps/api/src/modules/leads/services/leads.service.ts:710, 721`:
```typescript
panNumber: lead.contact.panNumber,
...
panNumber: lead.account.panNumber,
```

**Impact**:
Breaches Indian DPDP Act 2023 and IRDAI information security guidelines. Unprivileged agents or compromised tokens can harvest unmasked customer Aadhaar and PAN numbers by simply reading quotations or leads.

**Recommendation**:
Update `QuotationMapper` and `LeadsService.getLeadDetails()` to pass contact/account entities through `ContactMapper.toResponse()` and `AccountMapper.toResponse()`, or wrap the fields with `EncryptionUtil.maskPan()` and `EncryptionUtil.maskAadhaar()`.

---

### O-03: Lack of Automated Data Purging & Retention Policy Enforcement — RISK
**Severity**: P2  
**File**: `apps/api/prisma/schema.prisma:443, 610, 696, 780, 967, 1215, 1410, 1600`, `apps/api/src/modules/policies/services/commands/cancel-policy.service.ts`  

**Observed**:
1. **Soft-Delete Architecture**: Implemented cleanly across all major models. Models `User`, `Contact`, `Account`, `Agent`, `Lead`, `Quotation`, `Policy`, `Claim`, `Vehicle`, `Address`, `Endorsement`, and `Document` contain `deletedAt DateTime?` and indexes `@@index([deletedAt])`. Repositories filter records using `where: { deletedAt: null }`.
2. **Missing Scheduled Purging / Archiving**:
   - There are zero scheduled jobs, cron jobs, or BullMQ processors that archive or purge records after the required retention period.
   - Five cron jobs exist in the system (`CustomerAnalyticsCron`, `SlamonitorService`, `OutboxProcessor`, `SchedulerService`, and `RenewalSchedulerCron`), but none handle data lifecycle or compliance archiving.
3. **IRDAI Statutory Retention Invariant**:
   - IRDAI regulations mandate that all insurance policy and claims documentation must be retained for at least **3 years** (or 5 years under PMLA).
   - In software, hard deletion is blocked because repositories only set `deletedAt = new Date()`. However, there is no automated policy, archive bucket migration, or compliance mechanism ensuring records cannot be accidentally hard-deleted by database administrative tasks.

**Expected**:
- An automated data retention policy engine or lifecycle scheduler should classify data according to regulatory lifecycles (e.g., active -> soft-deleted -> archived after 3 years -> purged).
- IRDAI retention constraints should be documented and enforced via automated tests or database constraints.

**Evidence**:
Search for retention jobs across `@Cron` services:
```powershell
Get-ChildItem -Recurse apps/api/src -Filter *.ts | Select-String -Pattern '@Cron'
# CustomerAnalyticsCron (midnight), SlamonitorService (5m), OutboxProcessor (10s), SchedulerService (6am), RenewalSchedulerCron (2am)
# Zero data retention or purging cron jobs exist.
```

**Impact**:
Compliance risk under IRDAI guidelines; soft-deleted records accumulate indefinitely in transactional database tables, degrading indexing performance over multi-year production operation.

**Recommendation**:
Implement a scheduled archiving job that exports records past their retention deadline to immutable cold storage (e.g. AWS S3 Glacier with Object Lock compliant with WORM storage rules).

---

### O-04: Incomplete IRDAI Agent Licensing Validation & Missing Regulatory Returns — RISK
**Severity**: P2  
**File**: `apps/api/src/modules/agents/dto/create-agent.dto.ts:18-21`, `apps/api/src/modules/finance/commission/services/commission-engine.service.ts:69-105`, `apps/api/src/modules/platform/reporting/services/report-data-provider-registry.service.ts:1-18`  

**Observed**:
1. **Statutory Financial Constraints Enforced**:
   - `CommissionEngineService` (`commission-engine.service.ts:69-105`) strictly implements IRDAI statutory commission caps:
     - `IRDAI_STATUTORY_MAX_AGENT_CAP = 15.0%`
     - `IRDAI_STATUTORY_MAX_TOTAL_CAP = 20.0%`
     - Throws `BadRequestException` if any commission configuration breaches statutory limits.
     - Mandates that commissions are calculated exclusively on Net OD premium, excluding GST and TP.
   - Motor pricing engine enforces statutory 3-year Long Term TP for new Private Cars and 5-year Long Term TP for new Two-Wheelers, Compulsory PA cover (?15 Lakh), and ownership transfer NCB reset to 0% (`endorsement.service.ts:182`).
2. **Agent License Number Validation Defect**:
   - In `CreateAgentDto` (`create-agent.dto.ts:18-21`) and `UpdateAgentDto`, `licenseNumber` is completely optional:
     ```typescript
     @ApiPropertyOptional({ description: 'IRDAI or brokerage license number' })
     @IsOptional()
     @IsString()
     licenseNumber?: string;
     ```
   - There is no regex pattern validation (e.g. enforcing IRDAI format `IRDA/IND/...` or POSP format), no check that an agent profile possesses a valid license before selling policies, and no `licenseExpiryDate` column exists in the `Agent` schema.
3. **Missing Statutory Regulatory Reporting**:
   - `ReportingModule` provides internal providers: `ClaimReportProvider`, `LeadReportProvider`, `AuditReportProvider`, `PolicyReportProvider`, and `RevenueReportProvider`.
   - No module exists to generate statutory IRDAI filings, such as the Statement of Business (Form 1-A/1-B), Monthly Intermediary Returns, or Insurer-wise Remittance Statements.

**Expected**:
- Selling agents must have a mandatory, validated IRDAI/POSP license number with a recorded expiry date. Policies should not be issuable by agents with expired or missing licenses.
- An IRDAI compliance reporting module should generate standardized monthly returns for regulatory inspection.

**Evidence**:
`apps/api/src/modules/agents/dto/create-agent.dto.ts:18-21`:
```typescript
@ApiPropertyOptional({ description: 'IRDAI or brokerage license number' })
@IsOptional()
@IsString()
licenseNumber?: string;
```

**Impact**:
Operating intermediaries face severe penalties or license suspension from IRDAI if policies are booked under unlicensed or expired agent codes, or if statutory returns cannot be extracted from the CRM.

**Recommendation**:
1. Add `licenseExpiryDate DateTime?` to `schema.prisma` for `Agent`.
2. Add regex format validation `@Matches(/^IRDA[A-Z0-9\/-]+$/)` to `licenseNumber` in `CreateAgentDto`.
3. Add a check in `IssuePolicyService` and `MotorPolicyIssuanceService` verifying the booking agent's license is active and unexpired.
4. Implement an IRDAI Statutory Returns export provider in `reports.module.ts`.

---

### O-05: Rate Limiting & DDoS Protection Architecture — PASS
**Severity**: P3 (Informational / Verified)  
**File**: `apps/api/src/modules/platform/rate-limiting/rate-limiting.module.ts:10-37`, `apps/api/src/modules/platform/rate-limiting/guards/custom-throttler.guard.ts:7-29`, `apps/api/src/modules/auth/controllers/auth.controller.ts:15-16`, `apps/api/src/main.ts:94`  

**Observed**:
1. **Global Rate Limiting**:
   - `RateLimitingModule` configures `@nestjs/throttler` with `CustomThrottlerGuard` registered as a global `APP_GUARD`.
   - Global default rate limit is configured to 1000 requests per 60 seconds (`{ name: 'default', ttl: 60000, limit: 1000 }`).
   - If `REDIS_ENABLED === 'true'`, storage automatically connects to Redis via `ThrottlerStorageRedisService(config.redisUrl)` for cluster-wide distributed rate limiting.
2. **Specialized Endpoint Throttling**:
   - `CustomThrottlerGuard` allows specialized throttlers to apply only to routes that declare them via `@Throttle(...)`.
   - Critical authentication endpoints are heavily restricted:
     - `POST /api/v1/auth/login`: `@Throttle({ default: { ttl: 60000, limit: 20 } })` (20 req/min).
     - `POST /api/v1/auth/refresh`: `@Throttle({ default: { ttl: 60000, limit: 30 } })` (30 req/min).
     - `POST /api/v1/auth/logout`: `@Throttle({ default: { ttl: 60000, limit: 30 } })` (30 req/min).
3. **Proxy Headers**: In `main.ts:94`, `app.getHttpAdapter().getInstance().set('trust proxy', 1)` is configured, enabling accurate IP resolution from `X-Forwarded-For` when behind an Nginx reverse proxy.
4. **Headers**: Standard `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers are returned to clients.

**Expected**:
API must have global DDoS defense, distributed Redis tracking in multi-node clusters, reverse proxy support, and aggressive brute-force protection on authentication routes.

**Evidence**:
`apps/api/src/modules/auth/controllers/auth.controller.ts:14-17`:
```typescript
@Public()
@Post('login')
@Throttle({ default: { ttl: 60000, limit: 20 } })
async login(...)
```

**Impact**:
Brute force password spraying, credential stuffing, and volumetric request floods are effectively mitigated.

---

### O-06: Cross-Origin Resource Sharing (CORS) Configuration — PASS
**Severity**: P3 (Informational / Verified)  
**File**: `apps/api/src/main.ts:103-136`  

**Observed**:
1. CORS is configured in `main.ts:103-136` using an origin validation callback.
2. **Environment Variable Configuration**:
   - In production (`process.env.NODE_ENV === 'production'`), allowed origins are strictly loaded from `process.env.ALLOWED_ORIGINS` (comma-separated list).
   - If `ALLOWED_ORIGINS` is not defined in production, it defaults to `[]` (fail-closed: all cross-origin browser requests are rejected).
   - In development, it defaults to `['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003']` or any localhost port.
3. **Non-Browser Clients**: Requests with no origin header (`!origin`) — such as curl, mobile clients, and webhooks — are permitted through to authentication and authorization filters.
4. **Credentials & Methods**:
   - `credentials: true` is enabled to support HttpOnly cookies (`access_token`, `refresh_token`, `csrf_token`).
   - Allowed methods are explicitly enumerated: `'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS'`.
   - Allowed headers are explicitly constrained: `'Content-Type,Accept,Authorization,X-Requested-With,X-Idempotency-Key,X-Correlation-ID,x-correlation-id'`.

**Expected**:
CORS should avoid wildcards (`*`) when credentials are true, parse allowed origins from environment variables, and fail-closed in production.

**Evidence**:
`apps/api/src/main.ts:105-136`:
```typescript
const isDev = process.env.NODE_ENV !== 'production';
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : isDev
    ? [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002',
        'http://localhost:3003',
      ]
    : [];

app.enableCors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.includes(origin) ||
      (isDev && origin.startsWith('http://localhost:'))
    ) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  allowedHeaders:
    'Content-Type,Accept,Authorization,X-Requested-With,X-Idempotency-Key,X-Correlation-ID,x-correlation-id',
  credentials: true,
});
```

**Impact**:
Compliant with browser cross-origin security standards. Does not allow untrusted web applications to make authenticated cross-origin requests.

---

## Consolidated Action & Remediation Plan

| Priority | Task ID | Description | Primary Target Files |
|:---|:---|:---|:---|
| **P1** | **REM-NO-01** | **Implement Database PII Encryption Hooks**: Enforce automatic encryption before saving and decryption on read for `Contact.panNumber`, `Contact.aadhaarNumber`, `Account.panNumber`, and `CustomerProfile`. Add HMAC blind indices for searches. | `apps/api/src/common/utils/encryption.util.ts`, `apps/api/src/database/prisma.service.ts` |
| **P1** | **REM-NO-02** | **Mask PII in Quotation and Lead Responses**: Apply `EncryptionUtil.maskPan()` and `EncryptionUtil.maskAadhaar()` in `QuotationMapper` and `LeadsService.getLeadDetails()`. | `apps/api/src/modules/quotation/mappers/quotation.mapper.ts`, `apps/api/src/modules/leads/services/leads.service.ts` |
| **P1** | **REM-NO-03** | **Instrument Business Prometheus Metrics**: Wire `leadCreatedCounter` to `LeadsService.create()` and add Prometheus metrics for `policy_issued_total` and `premium_amount_sum`. | `apps/api/src/modules/health/metrics.controller.ts`, `apps/api/src/modules/leads/services/leads.service.ts`, `apps/api/src/modules/motor/services/motor-policy-issuance.service.ts` |
| **P2** | **REM-NO-04** | **Unify Structured JSON Logging**: Set `app.useLogger(new StructuredLoggerService())` globally in `main.ts` and refactor `GlobalExceptionFilter` to emit structured JSON with correlation IDs. | `apps/api/src/main.ts`, `apps/api/src/common/filters/global-exception.filter.ts` |
| **P2** | **REM-NO-05** | **Audit User Creation & Consolidate Audit Trails**: Add `tx.auditLog.create()` in `UsersService.create()` and unify `PolicyHistory` / `ClaimHistory` with the central `AuditLog`. | `apps/api/src/modules/users/services/users.service.ts`, `apps/api/src/modules/platform/audit/services/audit.service.ts` |
| **P2** | **REM-NO-06** | **Enforce Agent IRDAI License Validation & Expiry**: Make `licenseNumber` mandatory for issuing agents, add format regex, and add `licenseExpiryDate` column with check. | `apps/api/src/modules/agents/dto/create-agent.dto.ts`, `apps/api/prisma/schema.prisma` |
| **P2** | **REM-NO-07** | **Implement IRDAI Regulatory Reporting Module**: Build an IRDAI Statement of Business and monthly returns provider in `reports.module.ts`. | `apps/api/src/modules/platform/reporting/` |
| **P2** | **REM-NO-08** | **Establish Automated Data Archiving / Purging**: Implement a scheduled archiving processor to move soft-deleted records older than 3 years to long-term immutable storage. | `apps/api/src/modules/tasks/` or `apps/api/src/modules/platform/` |
| **P3** | **REM-NO-09** | **Activate OpenTelemetry Tracing**: Connect `apps/api/src/tracing.ts` to `start:prod` in `package.json` to enable distributed end-to-end trace collection. | `apps/api/package.json`, `apps/api/src/main.ts` |
