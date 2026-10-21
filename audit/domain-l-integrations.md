# Domain L — Integrations, Webhooks & Async Processing Audit

**Audit Date:** October 19, 2026  
**Auditor Roles:** Senior Distributed Systems Engineer, Principal Security Architect, Integration & Messaging Specialist  
**Target:** JEST Policy CRM (`apps/api`)  
**Domain:** L — Integrations, Webhooks & Async Processing  
**Overall Status:** **CONDITIONAL PASS WITH NOTABLE RISKS (2 P1 DEFECTS, 4 P2 RISKS, 2 PASS VERIFICATIONS)**

---

## Summary

This audit evaluates the production readiness, resilience, cryptographic security, and multi-tenant isolation of all external integrations, webhook endpoints, BullMQ queue infrastructures, communication dispatchers, and object storage providers within JEST Policy CRM.

### Key Highlights & Post-Fix Verifications:
1. **Razorpay Webhook Cryptographic Security (L-01 — PASS):** Post-fix verification confirms that `RAZORPAY_WEBHOOK_SECRET` is strictly enforced with zero hardcoded fallbacks (`apps/api/src/modules/platform/integrations/webhooks/controllers/webhook-gateway/webhook-gateway.controller.ts:216-222`), signature validation is environment-independent (`webhook-gateway.controller.ts:52-58`), 5-minute timestamp replay protection is implemented (`webhook-gateway.controller.ts:60-79`), and a strict 3-case idempotency deduplication state machine (`webhook-gateway.controller.ts:81-138`) prevents duplicate transaction execution while raising `PAYMENT_TRANSACTION_CONFLICT` (HTTP 409) on hash tampering.
2. **Global Telemetry & Communication Log Data Leak (L-03 — P1 FAIL):** `GET /notifications/delivery-logs` and `GET /notifications/events` are exposed to all authenticated roles (`AGENT`, `BACK_OFFICE`, `ADMIN`) without multi-tenant scoping or user isolation. An agent from Brokerage A can view all customer communication records (phone numbers, email addresses, delivery status) and full system audit logs across all brokerage tenants.
3. **Queue Architecture & Silent Failure Risks (L-02 — P1 FAIL):** The `renewal-reminders` queue lacks exponential backoff, retry configuration, and dead letter queues (DLQ). In `RenewalSchedulerCron` and `RenewalEngineService`, jobs are queued with default `attempts: 1`. If an unhandled exception occurs in `RenewalReminderProcessor` (which lacks top-level try/catch guards), the job fails permanently on its first attempt. Furthermore, `QueueEventsListener` only listens to `system-queue`, leaving failures on `renewal-reminders` completely silent and unmonitored.
4. **Mocked Communication Gateways in Production (L-05 — P1 RISK):** External notification providers (`EmailProvider`, `SmsProvider`, `WhatsAppProvider`) are simulated console-logging stubs. Although they check for presence of environment variables (`SMTP_HOST`, `TWILIO_ACCOUNT_SID`, `WHATSAPP_API_TOKEN`), they do not execute actual HTTP/SMTP transmissions.
5. **Document Storage Resilience (L-07 — PASS with P2 Risk):** Document storage implements an impressive dual-storage failover architecture (`DualStorageProvider`) between MinIO and local filesystem with SHA-256 checksum verification and read-repair. Uploads are guarded by 10MB limits and MIME type filtering. However, downloads load the entire binary file into Node.js server heap memory rather than returning presigned S3/MinIO URLs.

---

## Findings Matrix

| Finding ID | Title | Severity | Status | Primary Location |
|---|---|---|---|---|
| **L-01** | Razorpay Webhook Cryptographic Security & Idempotency | P2 (Risk Note) | **PASS** | `webhook-gateway.controller.ts:43-265` |
| **L-02** | BullMQ Queue Retry, Backoff, DLQ & Processor Resilience | P1 | **FAIL** | `queue.module.ts`, `renewal-scheduler.cron.ts`, `renewal-reminder.processor.ts` |
| **L-03** | Cross-Tenant Communication Logs & Telemetry Data Leakage | P1 | **FAIL** | `notification.service.ts:86-145`, `notifications.controller.ts:36-46` |
| **L-04** | Sandbox Mode Payment Key Guards in Production | P2 | **RISK** | `env.schema.ts:57-100` |
| **L-05** | Email, SMS & WhatsApp Delivery Adapters are Mock Stubs | P1 | **RISK** | `email.provider.ts`, `sms.provider.ts`, `whatsapp.provider.ts` |
| **L-06** | Circuit Breaker HTTP Client Exists as Dead Code | P2 | **RISK** | `integration-http.service.ts:8-89`, `core.module.ts:8-9` |
| **L-07** | MinIO/S3 Storage Configuration & Direct In-Memory Streaming | P2 | **PASS / RISK** | `minio-storage.provider.ts:12-76`, `documents.controller.ts:202-217` |

---

## Detailed Audit Findings

### L-01: Razorpay Webhook Security (Post-Fix Verification) — PASS
**Severity**: P2 (Low Risk on Optional Timestamp Header)  
**File**: `apps/api/src/modules/platform/integrations/webhooks/controllers/webhook-gateway/webhook-gateway.controller.ts:43-269`  
**Observed**:
The webhook gateway controller was verified following security remediations:
1. **No Fallback Hardcoded Secret**:
   - Lines 216–222 explicitly read `process.env.RAZORPAY_WEBHOOK_SECRET` and throw an `UnauthorizedException('Webhook provider not configured')` if empty or missing.
   - `apps/api/src/modules/platform/configuration/env.schema.ts:94-100` marks `RAZORPAY_WEBHOOK_SECRET` as mandatory in production and rejects insecure placeholder values via `isDisallowedSecret()`.
2. **Environment-Independent Validation**:
   - `validateSignature()` (lines 203–269) executes unconditionally for all requests in all environments (`production`, `development`, `test`). There is no `if (NODE_ENV === 'production')` bypass.
   - Signature verification uses constant-time comparison via `crypto.timingSafeEqual()` (lines 241–244) to eliminate timing attacks.
3. **Timestamp Replay Protection**:
   - Lines 60–79 check the `x-razorpay-timestamp` header: validates that it contains digits only, converts seconds to milliseconds, and enforces a `MAX_AGE_MS = 5 * 60 * 1000` (5 minutes) drift window against `Date.now()`.
   - *Risk Note*: If `x-razorpay-timestamp` is completely omitted by a caller, the `if (razorpayTimestamp)` condition evaluates to false, skipping this check. However, replay attacks are blocked downstream by the event-id idempotency layer.
4. **Strict 3-Case Idempotency Semantics**:
   - Line 43 extracts `providerEventId` from `headers['x-razorpay-event-id'] || payload.id` (line 184). Missing ID throws `BadRequestException`.
   - Line 84 computes incoming payload SHA-256 hash.
   - Line 90 queries `prisma.webhookAuditLog.findUnique({ where: { providerEventId } })`.
   - **Case A** (New Event): Handled in lines 140–165. Event is dispatched to NestJS `EventEmitter2.emitAsync()`. Only upon successful dispatch is the `WebhookAuditLog` persisted.
   - **Case B** (Exact Duplicate): Lines 104–113 detect matching SHA-256 hash, log a notice, and return HTTP 200 `{ status: 'ignored', reason: 'already_processed', idempotent: true }` as a safe no-op.
   - **Case C** (Payload Collision / Hash Mismatch): Lines 114–137 log an error, record an immutable `AuditAction.REJECT` record to `prisma.auditLog`, and throw `ConflictException` (HTTP 409) with message `PAYMENT_TRANSACTION_CONFLICT: Webhook event ID ${providerEventId} re-used with conflicting payload`.

**Expected**:
Strong cryptographic validation, no secret fallbacks, replay defenses, and idempotent event processing.

**Evidence**:
```typescript
// webhook-gateway.controller.ts:216-222
const razorpaySecret = process.env.RAZORPAY_WEBHOOK_SECRET;
if (!razorpaySecret) {
  this.logger.error(
    '[SECURITY] RAZORPAY_WEBHOOK_SECRET is not configured. Rejecting webhook.',
  );
  throw new UnauthorizedException('Webhook provider not configured');
}

// webhook-gateway.controller.ts:241-244
if (
  signature.length !== expectedSignature.length ||
  !crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature),
  )
) { ... }
```

**Impact**:
Payment webhooks cannot be forged without the secret key. Replayed identical events are safely ignored, and modified payloads under identical event IDs are flagged as security violations.

**Recommendation**:
If Razorpay webhooks in production are configured with timestamp signatures, enforce that `headers['x-razorpay-timestamp']` is mandatory rather than optional:
```typescript
if (!headers['x-razorpay-timestamp']) {
  throw new UnauthorizedException('Missing x-razorpay-timestamp header');
}
```

---

### L-02: BullMQ Queue Configuration & Processor Resilience — FAIL
**Severity**: P1  
**File**:  
- `apps/api/src/modules/platform/queue/queue.module.ts:21-45`
- `apps/api/src/modules/platform/queue/events/queue-events.listener.ts:30-44`
- `apps/api/src/modules/policies/crons/renewal-scheduler.cron.ts:148-160`
- `apps/api/src/modules/policies/services/renewal-engine.service.ts:182-195`
- `apps/api/src/modules/policies/processors/renewal-reminder.processor.ts:20-195`
- `apps/api/src/modules/platform/queue/workers/renewal.worker.ts:12-123`

**Observed**:
The audit identified four structural defects in the BullMQ queue setup:
1. **Zero Retries on `renewal-reminders` Queue**:
   In `RenewalSchedulerCron.processCompanyRenewals()` (lines 148–160) and `RenewalEngineService.queueRenewalReminders()` (lines 182–195), jobs are enqueued as:
   ```typescript
   await this.renewalQueue.add(
     'send-renewal-reminder',
     payload,
     { jobId, removeOnComplete: true } // No attempts, no backoff!
   );
   ```
   BullMQ defaults to `attempts: 1`. If an external SMTP or database glitch occurs during reminder execution, the job fails immediately without any retries.
2. **Missing Dead Letter Queue (DLQ)**:
   Neither `system-queue` nor `renewal-reminders` has a Dead Letter Queue or failed job forwarder configured. When jobs exhaust attempts, they are abandoned in BullMQ's Redis memory.
3. **Queue Monitoring Blindspot**:
   `QueueEventsListener` (`queue-events.listener.ts:37`) explicitly instantiates:
   ```typescript
   this.queueEvents = new QueueEvents('system-queue', { ... });
   ```
   It only listens for events on `system-queue`. The `renewal-reminders` queue has NO `QueueEvents` listener. When a `renewal-reminders` job fails, no active status update or failure record is ever written to `prisma.backgroundJob`.
4. **Unhandled Exceptions in Processors & Workers**:
   `RenewalReminderProcessor.process()` (`renewal-reminder.processor.ts:20-195`) lacks a top-level `try/catch` wrapper. If `prisma.notification.create` or `prisma.policy.updateMany` fails (e.g. transient Postgres deadlocks), the unhandled exception terminates the job on attempt 1.
   Similarly, `RenewalWorker.process()` (`renewal.worker.ts:12-123`) has no `try/catch` block around its database interactions.
5. **Redis Configuration Port Discrepancy & Incomplete Credentials Handling**:
   `queue.module.ts:30` defaults fallback Redis URL to `'redis://127.0.0.1:6379'`, while `queue-events.listener.ts:34` defaults fallback to `'redis://localhost:6380'`. Furthermore, neither file supports discrete `REDIS_PASSWORD`, `REDIS_HOST`, or `REDIS_PORT` environment variables; credentials must be fully formatted inside `REDIS_URL`.

**Expected**:
1. All background jobs must specify explicit retry attempts (at least 3) with exponential backoff (`backoff: { type: 'exponential', delay: 2000 }`).
2. Exhausted jobs must be diverted to a dedicated Dead Letter Queue (`dlq-queue`) or captured with alert webhooks.
3. Every queue must be registered with event telemetry to record status updates in `prisma.backgroundJob`.
4. Processors and workers must encapsulate job execution within resilient error handling blocks.

**Evidence**:
```powershell
# Get-ChildItem -Path apps/api/src -Filter *.ts -Recurse | Select-String -Pattern 'BullModule.registerQueue'
queue.module.ts:42: BullModule.registerQueue({ name: 'system-queue' }),
policies.module.ts:48: BullModule.registerQueue({ name: 'renewal-reminders' }),

# renewal-scheduler.cron.ts:148-160
await this.renewalQueue.add(
  'send-renewal-reminder',
  { ... },
  { jobId, removeOnComplete: true },
);
```

**Impact**:
Critical policy renewal notifications and automated policy transitions (e.g. `ACTIVE` to `PENDING_RENEWAL` or `LAPSED`) will be permanently lost whenever transient database locks or Redis hiccups occur, with zero alerts raised to operators.

**Recommendation**:
1. Configure default queue job options in `BullModule.forRootAsync` or during queue registration:
   ```typescript
   BullModule.registerQueue({
     name: 'renewal-reminders',
     defaultJobOptions: {
       attempts: 3,
       backoff: { type: 'exponential', delay: 3000 },
       removeOnFail: false,
     },
   }),
   ```
2. Extend `QueueEventsListener` to subscribe to all registered queues or create a multi-queue listener.
3. Wrap `RenewalReminderProcessor.process()` and `RenewalWorker.process()` in top-level `try/catch` blocks that log and record diagnostics before failing or scheduling retries.

---

### L-03: Notification Routing & Cross-Tenant Telemetry Leak — FAIL
**Severity**: P1  
**File**:  
- `apps/api/src/modules/platform/notifications/controllers/notifications.controller.ts:36-46`
- `apps/api/src/modules/platform/notifications/services/notification.service.ts:86-145`
- `apps/api/src/modules/platform/queue/workers/renewal.worker.ts:43-70`

**Observed**:
1. **Cross-Tenant Telemetry Data Leakage via Unfiltered Endpoints**:
   In `NotificationsController`:
   ```typescript
   @Get('delivery-logs')
   @ApiOperation({ summary: 'Get channel message delivery monitor logs' })
   getDeliveryLogs() {
     return this.notificationService.getDeliveryLogs();
   }

   @Get('events')
   @ApiOperation({ summary: 'Get domain event telemetry stream' })
   getEventStream(@Query('category') category?: string) {
     return this.notificationService.getEventStream(category);
   }
   ```
   Controller-level authorization is decorated with `@Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)`.
   In `NotificationService`:
   - `getDeliveryLogs()` executes `this.prisma.communicationLog.findMany({ take: 50, orderBy: { sentAt: 'desc' } })`.
   - `getEventStream()` executes `this.prisma.auditLog.findMany({ take: 50, orderBy: { createdAt: 'desc' } })`.
   Neither query applies `companyId`, `organizationId`, or `userId` filtering. Any authenticated Agent can call `GET /notifications/delivery-logs` or `GET /notifications/events` and retrieve communication logs and sensitive audit activity belonging to other brokerages and agents.
2. **Notification Recipient Routing on Reassigned Policies**:
   In `RenewalWorker.process()` (`renewal.worker.ts:43`):
   ```typescript
   const targetUserId = policy.quotation?.createdById || policy.createdById;
   ```
   If a policy is reassigned from Agent A to Agent B (reflected in `policy.agentId`), the notification is sent to `createdById` (Agent A) rather than the currently assigned agent.
3. **In-App User Notification Scoping (PASS)**:
   Personal notification queries (`getUserNotifications`, `getUnreadNotifications`, `getUnreadCount`, `markAsRead`, `markAllAsRead`, `deleteNotification`) strictly bind to `@CurrentUser() user: RequestUser` (`where: { userId: user.id }`), preventing cross-agent access to private in-app inboxes.

**Expected**:
1. Delivery logs and event streams must be restricted to `ADMIN` / `BACK_OFFICE` and must be strictly partitioned by `actor.companyId`.
2. Renewal notifications must resolve `policy.agent?.userId || policy.createdById` to ensure the current agent receives renewal alerts.

**Evidence**:
```typescript
// notification.service.ts:86-90
async getDeliveryLogs() {
  const logs = await this.prisma.communicationLog.findMany({
    take: 50,
    orderBy: { sentAt: 'desc' },
  });
  // No tenant filtering! Returns logs across all companies.
}

// notification.service.ts:124-128
async getEventStream(category?: string) {
  const auditLogs = await this.prisma.auditLog.findMany({
    take: 50,
    orderBy: { createdAt: 'desc' },
  });
  // No tenant filtering! Returns global audit stream.
}
```

**Impact**:
Severe multi-tenant security vulnerability (BOLA/IDOR). Competitive customer data (customer phone numbers, policy renewal dates) and confidential brokerage audit logs are exposed across tenant boundaries.

**Recommendation**:
1. In `NotificationsController`, inject `@CurrentUser() user: RequestUser` into `getDeliveryLogs` and `getEventStream`.
2. Restrict roles to `RoleType.ADMIN, RoleType.BACK_OFFICE` (exclude `RoleType.AGENT`).
3. In `NotificationService`, enforce tenant isolation:
   ```typescript
   async getDeliveryLogs(actor: ActorContext) {
     return this.prisma.communicationLog.findMany({
       where: { contact: { companyId: actor.companyId } },
       take: 50,
       orderBy: { sentAt: 'desc' },
     });
   }
   ```

---

### L-04: Sandbox Mode Payment Key Guards — RISK
**Severity**: P2  
**File**: `apps/api/src/modules/platform/configuration/env.schema.ts:57-100`  
**Observed**:
1. `env.schema.ts` checks that `RAZORPAY_WEBHOOK_SECRET` is populated and does not match insecure dictionary patterns (`postgres:postgres`, `changeme`, `super-secret`, etc.).
2. However, there is NO pattern verification checking whether payment secrets or keys contain sandbox prefixes (`rzp_test_`) or require live prefixes (`rzp_live_`) in production (`NODE_ENV === 'production'`).
3. If an engineer accidentally configures `RAZORPAY_WEBHOOK_SECRET=rzp_test_webhook_secret_key_32_chars` in production, `envSchema` passes validation without error.
4. *Architecture Note*: JEST Policy CRM currently acts strictly as a webhook receiver (`webhook-gateway.controller.ts`) and offline payment recorder (`payment-webhook-reconciliation.listener.ts`). It does not initiate outbound checkout sessions or manage `RAZORPAY_KEY_ID` in the backend API.

**Expected**:
When `NODE_ENV === 'production'`, all payment gateway configuration keys and secrets should be validated to ensure test/sandbox credentials are forbidden (e.g. reject values starting with or containing `rzp_test_` or `test_`).

**Evidence**:
```typescript
// env.schema.ts:94-100
if (data.NODE_ENV === 'production') {
  if (
    !data.RAZORPAY_WEBHOOK_SECRET ||
    isDisallowedSecret(data.RAZORPAY_WEBHOOK_SECRET)
  )
    return false;
}
// isDisallowedSecret only checks INSECURE_PATTERNS; does not check 'rzp_test' or 'sandbox'
```

**Impact**:
Risk of accidental test-mode configuration in production webhook validation, leading to acceptance of simulated sandbox payments for real motor policies.

**Recommendation**:
Update `env.schema.ts` to explicitly forbid test key patterns in production:
```typescript
if (data.NODE_ENV === 'production') {
  if (data.RAZORPAY_WEBHOOK_SECRET?.startsWith('rzp_test_')) {
    return false;
  }
}
```

---

### L-05: Email, SMS & WhatsApp Delivery Integration — RISK
**Severity**: P1  
**File**:  
- `apps/api/src/modules/platform/notifications/providers/email.provider.ts:13-53`
- `apps/api/src/modules/platform/notifications/providers/sms.provider.ts:13-49`
- `apps/api/src/modules/platform/notifications/providers/whatsapp.provider.ts:13-51`

**Observed**:
1. All three external communication providers are non-functional mock stubs:
   - `EmailProvider.send()`: Checks `Boolean(process.env.SMTP_HOST || process.env.SENDGRID_API_KEY || process.env.SES_REGION)`. If true, it logs `[EmailProvider] Transmitting email to ...` and returns `{ success: true, status: 'SENT', providerMessageId: 'email-...' }`. No actual SMTP or API client is invoked.
   - `SmsProvider.send()`: Checks `Boolean((process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) || process.env.MSG91_AUTH_KEY)`. If true, logs to console and returns synthetic message ID.
   - `WhatsAppProvider.send()`: Checks `Boolean(process.env.WHATSAPP_API_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID)`. If true, logs to console and returns synthetic message ID.
2. Credentials Handling:
   - Credentials are read via `process.env` (none hardcoded).
   - If unconfigured, providers gracefully return `{ success: false, status: 'NOT_CONFIGURED' }`.
3. Error & Audit Handling:
   - `NotificationDispatcher` captures return statuses and records them into `prisma.notificationHistory` (`channel: 'EMAIL'`, `status: SENT | FAILED`).
   - However, when providers return `status: 'NOT_CONFIGURED'`, `NotificationDispatcher` records `status: NotificationStatus.FAILED`, giving a misleading signal of transmission failure rather than unconfigured provider status.

**Expected**:
Production deployment requires real delivery integrations (e.g. NodeMailer/AWS SES SDK for email, Twilio/MSG91 client for SMS, Meta Cloud API client for WhatsApp).

**Evidence**:
```typescript
// email.provider.ts:34-42
try {
  this.logger.log(
    `[EmailProvider] Transmitting email to ${payload.to}: ${payload.title}`,
  );
  return {
    success: true,
    status: 'SENT',
    providerMessageId: `email-${Date.now()}-${Math.random().toString(36).substring(7)}`,
  };
}
```

**Impact**:
In a live production environment, customers and agents will receive zero actual emails, SMS notifications, or WhatsApp renewal reminders. All notifications are lost in console logs while marked as "SENT" in the database.

**Recommendation**:
1. Implement real provider adapters using `@aws-sdk/client-ses` (already present in `package.json`), Twilio SDK, and Axios-based WhatsApp Business Cloud API.
2. Maintain a distinct `DEV_MOCK_COMMUNICATIONS=true` flag so mock logging is explicitly chosen in development rather than being the only available implementation.

---

### L-06: External API Integration Error Handling — RISK
**Severity**: P2  
**File**:  
- `apps/api/src/modules/platform/integrations/core/services/integration-http/integration-http.service.ts:8-89`
- `apps/api/src/modules/platform/integrations/core/core.module.ts:8-9`

**Observed**:
1. `IntegrationHttpClient` implements enterprise-grade resilience features:
   - Circuit breaker via `opossum` (`timeout: 10000ms`, `errorThresholdPercentage: 50%`, `resetTimeout: 30000ms`).
   - RxJS retry mechanism: `retry(3)` on failed requests.
   - Comprehensive circuit lifecycle logging (`open`, `halfOpen`, `close`, `fallback`).
2. **Dead Code Disconnect**:
   - Despite being fully implemented and exported by `CoreModule`, `IntegrationHttpClient` is NEVER injected or utilized anywhere in the codebase.
   - Insurer premium calculations and policy issuing logic run entirely against internal local calculation services (`motor-calculation.service.ts`, `rating-engine.service.ts`), without calling external insurer APIs.

**Expected**:
All outbound external HTTP requests across the application should be routed through `IntegrationHttpClient` to guarantee timeout enforcement, circuit breaker protection, and structured error translation.

**Evidence**:
```powershell
# Get-ChildItem -Path apps/api/src -Filter *.ts -Recurse | Select-String -Pattern 'IntegrationHttpClient'
core.module.ts:4: import { IntegrationHttpClient } from './services/integration-http/integration-http.service';
core.module.ts:8: providers: [ProviderRegistryService, IntegrationHttpClient],
core.module.ts:9: exports: [ProviderRegistryService, IntegrationHttpClient],
integration-http.service.spec.ts:2: import { IntegrationHttpClient } from './integration-http.service';
integration-http.service.ts:8: export class IntegrationHttpClient {
# Zero business service usages!
```

**Impact**:
Architecture debt. When external insurer or telemetry endpoints are introduced in future releases, unmanaged HTTP requests could cause hanging connections, thread starvation, and cascading system outages.

**Recommendation**:
Standardize all external HTTP interactions through `IntegrationHttpClient` and establish unit tests verifying timeout handling and circuit breaker tripping.

---

### L-07: MinIO/S3 Document Storage Configuration & Access — PASS / RISK
**Severity**: P2 (API Server Memory Buffering Risk)  
**File**:  
- `apps/api/src/modules/documents/storage/minio-storage.provider.ts:12-76`
- `apps/api/src/modules/documents/storage/s3-storage.provider.ts:18-50`
- `apps/api/src/modules/documents/storage/dual-storage.provider.ts:56-178`
- `apps/api/src/modules/documents/controllers/documents.controller.ts:47-60, 202-217`

**Observed**:
1. **Environment Configuration**:
   - `minio-storage.provider.ts`: Bucket name (`MINIO_BUCKET`), endpoint (`MINIO_HOST`), port (`MINIO_PORT`), and credentials (`MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`) are loaded via `ConfigService`.
   - `s3-storage.provider.ts`: Loaded via `ConfigService` (`STORAGE_BUCKET`, `STORAGE_REGION`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`). Lines 30–38 enforce that credentials are mandatory in production.
2. **Direct In-Memory Streaming vs Signed URLs**:
   - File access is NOT public; all access requires authentication and strict organizational boundary checks (`getAuthorizedDocument()`).
   - However, `DocumentsController.downloadDocument()` (`documents.controller.ts:202-217`) does NOT generate signed S3/MinIO URLs. Instead, the backend downloads the full file buffer into Node.js server RAM and streams it via `res.status(HttpStatus.OK).send(fileBuffer)`.
   - Although `MinioStorageProvider.getFileUrl()` exists (line 74, presigned URL with 3600s / 1-hour expiry), it is omitted from the `StorageProvider` interface and never called.
3. **Upload Validation**:
   - **File Size Validation**: Enforced at 10 MB via Multer options (`documents.controller.ts:47`: `limits: { fileSize: 10 * 1024 * 1024 }`).
   - **File Type Validation**: Enforced via `ALLOWED_MIME_TYPES` (PDF, JPEG, PNG, GIF, Word, Excel). However, validation relies on Multer's `file.mimetype` (client-supplied header) without inspecting binary magic bytes.
4. **Dual Storage Read-Repair Architecture (Highlight)**:
   - `DualStorageProvider` provides high resilience by saving files to MinIO and mirroring them locally. During downloads (`downloadWithReadRepair()`), if MinIO was previously down, it automatically replicates local files back to MinIO and validates SHA-256 checksums before marking replication status as `SYNCED`.

**Expected**:
Large file downloads in cloud deployments should redirect clients to time-limited presigned S3/MinIO URLs (e.g. 15-minute expiry) to offload bandwidth and memory from the API application cluster.

**Evidence**:
```typescript
// documents.controller.ts:202-217
@Get(':id/download') async downloadDocument(...) {
  const { fileBuffer, originalFileName, mimeType } =
    await this.documentService.downloadDocument(id, user.id, ipAddress, user);
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${safe}"`);
  res.status(HttpStatus.OK).send(fileBuffer); // In-memory buffer transfer
}
```

**Impact**:
Under concurrent download requests of large claim damage photos or scanned policy bundles, the Node.js API process could encounter memory spikes, garbage collection pauses, or Out-Of-Memory (OOM) crashes.

**Recommendation**:
1. Add `getSignedUrl(key: string, expirySeconds?: number): Promise<string>` to `StorageProvider` interface.
2. Implement signed URL generation in `DocumentsController.downloadDocument()`, returning an HTTP 302 redirect or `{ downloadUrl }` payload to the client.
3. Add magic-byte inspection (using `file-type` library) to prevent extension/MIME spoofing.

---

## Production Readiness Verdict

| Audit Domain | Production Readiness Rating | Required Actions Before Live Deployment |
|---|---|---|
| **L-01: Razorpay Webhook** | **READY** | None blocking. Recommend making timestamp header mandatory. |
| **L-02: BullMQ Queues** | **NOT READY (P1)** | Configure retry backoff on `renewal-reminders`, wire DLQ, add error handling to workers. |
| **L-03: Notification Routing** | **NOT READY (P1)** | Add tenant isolation (`companyId`) to `delivery-logs` and `events` endpoints. |
| **L-04: Sandbox Guards** | **CONDITIONALLY READY (P2)**| Add `rzp_test_` guard in `env.schema.ts`. |
| **L-05: Communication Adapters**| **NOT READY (P1)** | Replace simulated mock providers with actual SES/Twilio/WhatsApp transport clients. |
| **L-06: HTTP Client Resilience**| **READY (P2 Debt)** | Wire `IntegrationHttpClient` to external HTTP dependencies. |
| **L-07: Document Storage** | **CONDITIONALLY READY (P2)**| Transition from in-memory proxy streaming to signed URL redirection for file downloads. |

**Overall Domain L Verdict**: **BLOCKING ISSUES IDENTIFIED — Remediate L-02, L-03, and L-05 prior to live commercial deployment.**
