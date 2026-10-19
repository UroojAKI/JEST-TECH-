# Domain F — Database & Data Integrity Audit

**Audit Commit**: `5a0f8b8cb7a62e2662682490681d1dd24662834f`  
**Repository**: `e:\JEST TECH\JEST POLICY\jest-policy-crm`  
**Auditor**: Antigravity Production Readiness Auditor  
**Domain**: Domain F (Database & Data Integrity) & Domain N (Observability & Health Checks)  
**Date**: October 19, 2026  

---

## Executive Summary

A comprehensive production-readiness audit of the database architecture, schema invariants, data integrity, migration safety, concurrency protection, sensitive data protection, and observability was conducted for JEST Policy CRM.

The platform employs **PostgreSQL 16** with **Prisma ORM 6.16.2**, managing **158 models** and **29 historical migrations**. The codebase demonstrates several sophisticated integrity patterns, including:
- PostgreSQL-level append-only immutability trigger for audit logs (`trg_audit_log_immutable`).
- Pessimistic locking (`SELECT ... FOR UPDATE`) in standard financial payment allocations.
- Extensive 6-gate validation and crash-recovery state checks for motor policy issuance.
- Strict production database credential validation via Zod in `env.schema.ts`.
- Multi-probe health checks (`/health`, `/health/ready`, `/health/terminus`) and authenticated Prometheus metrics (`/metrics`).

However, the audit revealed **critical P0 and P1 vulnerabilities** that severely compromise data integrity, regulatory compliance (IRDAI & DPDP 2023), and system scalability:
1. **PII Plaintext at Rest (P0)**: While AES-256-GCM encryption is implemented in `EncryptionUtil`, `EncryptionUtil.encrypt()` is **never invoked anywhere in the codebase**. Customer PAN, Aadhaar, and phone numbers are stored in plaintext in PostgreSQL.
2. **Soft-Delete Leakage in Paginated Queries (P1)**: `BaseRepository.findPaginated` does not default `deletedAt: null`, causing `GET /api/v1/policies` to return soft-deleted records. Over 270 queries across 453 files omit `deletedAt: null`.
3. **Concurrent Invoice/Receipt Collisions in Motor Payments (P1)**: Motor payment ledger sync uses racy `tx.invoice.count()` and `tx.receipt.count()` to generate unique invoice and receipt numbers, bypassing the sequence `receipt_number_seq` and triggering unique constraint violations (`P2002`) under concurrent transactions.
4. **Unmigrated Sequence Generation via Lazy Runtime DDL (P1)**: Sequences `policy_number_seq`, `claim_number_seq`, `contact_number_seq`, and `quotation_number_seq` do not exist in any migration file. They rely on try/catch `CREATE SEQUENCE` runtime DDL, which will fail under standard production database user privileges.
5. **Unindexed Tenant and Foreign Key Columns (P1)**: `Vehicle.companyId` and 42 foreign key fields are unindexed, threatening severe performance degradation and table scans across tenant boundaries.
6. **Missing Operational Backups & Documented Disaster Recovery (P2)**: No automated backup cron or offsite replication exists, and `docs/OPERATIONS_RUNBOOK.md` completely omits backup/restore instructions.

---

## F.1 Schema Integrity

### F.1.1 Foreign Keys & Relations
The Prisma schema (`apps/api/prisma/schema.prisma`) defines **158 models** containing **247 foreign-key-owning relations**:
- **OnDelete Distribution**:
  - `Cascade`: 91 relations
  - `SetNull`: 81 relations
  - `Restrict`: 27 relations
  - `Default (Unspecified / NoAction)`: 48 relations

#### Critical Relation Findings:
1. **Regulatory Violation via Cascade Deletes on Policies**:
   `Endorsement.policy` (`@relation(fields: [policyId], references: [id], onDelete: Cascade)`) automatically cascades deletion to historical policy endorsements. Under IRDAI regulations, an endorsed policy record must never cascade deletion to financial contract endorsements. Similarly, `RenewalTask.policy` and `RenewalJob.policy` cascade on delete, destroying auditability.
   - *Expected*: Core policy relationships must enforce `onDelete: Restrict`.
2. **Unspecified Referential Actions**:
   48 foreign key relations (such as `User.branch`, `User.department`, `Lead.contact`, `Contact.account`) omit explicit `onDelete` actions, relying on Prisma's default behavior (`NoAction` in PostgreSQL), which causes unhandled database constraint exceptions when referenced entities are pruned.

---

### F.1.2 Missing Indexes
A complete AST traversal of `apps/api/prisma/schema.prisma` identified **43 unindexed foreign key / relationship fields**, **32 unindexed status fields**, and **2 unindexed expiryDate fields**.

#### 1. Unindexed Foreign Keys & Tenant Keys (43 Total):
The most critical unindexed columns include:
- `Vehicle.companyId`: **CRITICAL MULTI-TENANCY GAP**. Every query filtering vehicles by tenant performs a full sequential table scan.
- `CustomerAgentHistory.customerId` and `CustomerAgentHistory.agentId`: Audit history lookups scan the entire table.
- `Task.leadId`, `Task.policyId`, `Task.claimId`, `Task.customerId`: Polymorphic entity tasks cannot efficiently query tasks for a given policy or claim.
- `Inspection.policyId`, `Inspection.claimId`, `Inspection.inspectorId`: Vehicle inspection lookup scans without indexes.
- `Quotation.insurerId`: Product/insurer comparison queries require sequential scans.
- `Lead.customerId`: Contact-to-lead resolution scans without index.
- `Policy.issuedPolicyDocumentId`: Issued document pointer is unindexed.
- `AuditLog.performedById`: User activity forensic lookups scan the largest table in the database.
- `IdempotencyKey.actorId` & `IdempotencyKey.resourceId`: Idempotency resolution triggers unindexed scans.
- `MotorInspection.waivedById`, `inspectorUserId`, `createdById`: Inspection authorization checks are unindexed.

#### 2. Models with `status` Column Missing Indexes (32 Total):
High-frequency business entities lack status indexes:
- `Proposal.status` (Filtering approved proposals scans full table)
- `Endorsement.status` (Queue filtering scans full table)
- `PolicyPayment.status` (Reconciliation scans full table)
- `Receipt.status` (Financial clearing scans full table)
- `JournalEntry.status` (General ledger balancing scans full table)
- `Settlement.status` (Commission payout calculations scan full table)
- `MotorQuotationCase.status` (Back-office case queue scans full table)
- `Vehicle.status`

#### 3. Models with `expiryDate` Missing Indexes (2 Total):
- `Quotation.expiryDate`: The quotation module constantly checks whether quotes have expired (`new Date(quotation.expiryDate) < new Date()`). Quotation cleanup crons and expiration filters scan the table without an index.
- `Document.expiryDate`: Document compliance monitoring lacks index.

#### 4. Missing Composite Indexes:
- `@@index([companyId, status])` is missing on `Policy`, `Lead`, `Claim`, `Quotation`, and `MotorQuotationCase` for tenant-scoped filtered list views.
- `@@index([companyId, deletedAt])` is missing on `Contact`, `Lead`, and `Account` for soft-deleted tenant queries.

---

### F.1.3 Uniqueness Constraints
1. **Policy Numbers**:
   - `Policy.policyNumber`: Enforced with `@unique`.
   - `Policy.actualPolicyNumber`: **NO UNIQUE CONSTRAINT**. If an insurer-issued policy number is manually entered or updated, duplicates across policies are not prevented at the database level.
2. **Claim Numbers**:
   - `Claim.claimNumber`: Enforced with `@unique`.
3. **Proposal Numbers**:
   - `Proposal.proposalNumber`: Enforced with `@unique`.
4. **Quotation Numbers**:
   - `Quotation.quotationCode`: Enforced with `@unique`.
   - `MotorQuotation.quotationNumber`: Enforced with `@unique`.
5. **User Tenancy Uniqueness**:
   - `User.email`: Globally `@unique` across all tenants. There is no composite tenant uniqueness `@@unique([email, companyId])` or `@@unique([id, companyId])`. A user cannot register the same email across two distinct company tenants.
6. **Numbering Sequence Tenancy**:
   - `NumberingSequence`: Keyed by `@@id([entityType, year, month])`. Numbering sequences are shared globally across all tenants.
7. **Runtime Dynamic Sequence Generation (Anti-Pattern)**:
   - `policy_number_seq`, `claim_number_seq`, `contact_number_seq`, and `quotation_number_seq` are **not created by migrations**. Repository files catch sequence errors and execute raw SQL `CREATE SEQUENCE IF NOT EXISTS ... START 1;`. In production environments with restricted DDL permissions, this will fail.

---

### F.1.4 Nullable Fields & Financial Amounts
Analysis of all 77 `Decimal` fields in `schema.prisma` identified **26 nullable Decimal? fields**:
- **Critical Financial Nullability Gaps**:
  1. `Settlement.retainedCommission: Decimal?` and `Settlement.netPayable: Decimal?`: In commission settlement payouts, these fields can be null, allowing incomplete settlement records to be written to the ledger.
  2. `MotorPaymentRecord.amount: Decimal?`: In motor payment reconciliation, `amount` is nullable even when `status` is transitioned to `PAID`.
  3. `Policy.actualPremium: Decimal?`: The physical issued policy premium can be null.
  4. `MotorQuotation`: All premium breakdown fields (`idv`, `odPremium`, `tpPremium`, `addonPremium`, `ncbDiscount`, `otherDiscounts`, `netPremium`, `gstAmount`) are defined as nullable `Decimal?`. Only `finalPremium` is mandatory.

---

### F.1.5 Audit Trail Completeness
Auditing 24 core business and financial entities revealed significant gaps in audit fields:

| Model | `createdAt` | `updatedAt` | `createdById` | `updatedById` | Status / Gap |
|---|:---:|:---:|:---:|:---:|---|
| `User` | Yes | Yes | No | No | Acceptable for root user entity |
| `Contact` | Yes | Yes | Yes | Yes | Fully audited |
| `Account` | Yes | Yes | Yes | Yes | Fully audited |
| `Lead` | Yes | Yes | Yes | Yes | Fully audited |
| `Quotation` | Yes | Yes | Yes | Yes | Fully audited |
| `Policy` | Yes | Yes | Yes | Yes | Fully audited |
| `Claim` | Yes | Yes | Yes | Yes | Fully audited |
| `Proposal` | Yes | Yes | Yes | **No** | Missing `updatedById` |
| `Endorsement` | Yes | Yes | **No** | **No** | Has `requestedById`, lacks `createdById`/`updatedById` |
| `JournalEntry` | Yes | Yes | **No** | **No** | **Critical Financial Audit Gap** |
| `Invoice` | Yes | Yes | **No** | **No** | **Critical Financial Audit Gap** |
| `Receipt` | Yes | Yes | **No** | **No** | **Critical Financial Audit Gap** |
| `Commission` | Yes | Yes | **No** | **No** | **Critical Financial Audit Gap** |
| `Settlement` | Yes | Yes | **No** | **No** | **Critical Financial Audit Gap** |
| `Vehicle` | **No** | **No** | **No** | **No** | **Complete Absence of Audit Fields** |
| `MotorInspection` | Yes | Yes | Yes | **No** | Missing `updatedById` |
| `MotorPaymentRecord` | Yes | Yes | **No** | **No** | Has raw unlinked `recordedById`, lacks `updatedById` |
| `MotorQuotationCase` | Yes | Yes | **No** | **No** | Missing user audit trail |
| `Task` | Yes | Yes | Yes | **No** | Missing `updatedById` |
| `BackOfficeTask` | Yes | Yes | Yes | **No** | Missing `updatedById` |

---

### F.1.6 Soft Delete Consistency
- **Models with `deletedAt`**: 18 models (`User`, `Contact`, `Account`, `Lead`, `Note`, `Activity`, `Quotation`, `Policy`, `Claim`, `Document`, `Report`, `Workflow`, `Agent`, `Customer`, `MotorQuotation`, `Task`, `BackOfficeTask`, `Inspection`).
- **Prisma Client Middleware**: **None**. `PrismaService` implements only an immutability hook for `AuditLog`. It does not install soft-delete query extensions.
- **BaseRepository Flaw**: `BaseRepository.findPaginated` constructs `whereClause = { ...where }` without adding `deletedAt: null`.
- **Query Leakage**:
  - `GET /api/v1/policies` calls `GetPolicyService.executeAll`, which calls `policyRepository.findPaginated(pagination, scopedFilter)`. Neither layer filters `deletedAt: null`. Soft-deleted policies are returned to users.
  - An AST scan found **270 queries across 453 API source files** querying soft-delete models without specifying `deletedAt: null`.

---

## F.2 Migration Safety

A comprehensive inspection of all **29 migration scripts** under `apps/api/prisma/migrations` was performed:

1. **Migration Count & Directory Structure**:
   29 migrations from `20260809045341_init_schema` to `20261013150000_audit_log_immutability_trigger`.
2. **Destructive Operations (`DROP TABLE`, `TRUNCATE`)**:
   - `DROP TABLE`: None found.
   - `TRUNCATE`: None found.
3. **Column Drops (`DROP COLUMN`)**:
   - `20260915020000_rbac_3_role_contract`:
     ```sql
     ALTER TABLE "JobRole" DROP COLUMN IF EXISTS "defaultRoleType";
     ```
     This was part of an intentional contract migration from legacy RBAC to 3-role RBAC.
4. **NOT NULL Column Enforcement**:
   - `20260918190000_enforce_non_nullable_tenancy`:
     Executed `ALTER TABLE ... ALTER COLUMN "companyId" SET NOT NULL;` across 9 tables without default values or inline backfill. (Subsequent migration `20260920140000_production_hardening_tenancy_and_inspection` added robust PL/pgSQL preflight checks and backfills).
5. **Database Triggers for Regulatory Compliance**:
   - `20261013150000_audit_log_immutability_trigger`:
     Successfully installs PostgreSQL function `prevent_audit_log_modification()` and trigger `trg_audit_log_immutable` before `UPDATE` or `DELETE` on table `audit_logs` (IRDAI G023 compliant).

---

## F.3 Race Conditions & Concurrency

### 1. Policy Creation & Issuance
- **Standard Policy Issuance (`IssuePolicyService.ts`)**:
  - Uses `prisma.$transaction`.
  - Re-checks quotation uniqueness inside the transaction (`where: { quotationId }`).
  - Calls `generatePolicyNumber()` before the transaction. If the transaction rolls back, sequence gaps occur (normal for PostgreSQL sequences).
  - Database-level unique constraint on `Policy.policyNumber` protects against duplicate numbers.
- **Motor Policy Issuance (`MotorPolicyIssuanceService.ts`)**:
  - Uses `prisma.$transaction`.
  - Implements crash recovery state machine (`ISSUANCE_IN_PROGRESS`, `ISSUANCE_MANUAL_REVIEW`).
  - Implements 6-gate inside-transaction verification (Snapshot/Tariff, KYC PAN, Inspection, Customer Acceptance, Payment Reconciled, Mandatory Documents).
  - Handles Prisma unique violation `P2002` explicitly, converting collision to `ConflictException` (409).

### 2. Payment Processing & Synchronization
- **Revenue Payment Service (`apps/api/src/modules/finance/revenue/services/payment/payment.service.ts`)**:
  - Implements pessimistic row-level locking:
    ```sql
    SELECT id FROM "Invoice" WHERE id = ${invoiceId} FOR UPDATE
    ```
  - Uses atomic PostgreSQL sequence `receipt_number_seq`.
  - Validates idempotency against `Receipt.reference` and `paymentMode` inside the transaction.
- **Motor Payment Tracking (`apps/api/src/modules/motor/services/motor-payment-tracking.service.ts`) — RACE CONDITION**:
  - Lines 523–556 attempt to synchronize motor payments to the finance ledger:
    ```typescript
    const invoiceCount = await tx.invoice.count();
    const invoiceNum = `INV-${Date.now().toString().slice(-6)}-${(invoiceCount + 1).toString().padStart(4, '0')}`;
    ...
    const receiptCount = await tx.receipt.count();
    const receiptNum = `RCP-${Date.now().toString().slice(-6)}-${(receiptCount + 1).toString().padStart(4, '0')}`;
    ```
  - Both `Invoice.invoiceNum` and `Receipt.receiptNum` are `@unique`.
  - Concurrent payments hitting this service read identical `invoiceCount` / `receiptCount` values, causing `P2002` unique constraint violations and transaction rollbacks.
- **Webhook Idempotency Key Race**:
  - `PaymentWebhookReconciliationListener` passes `idempotencyKey: 'webhook-' + referenceNumber`.
  - `MotorPaymentTrackingService` checks `findFirst` at transaction start, but only upserts `IdempotencyKey` with status `SUCCEEDED` at transaction completion. It does not insert an `IN_PROGRESS` lock row. Concurrent duplicate webhooks arriving within milliseconds will both pass the initial check.

---

## F.4 Sensitive Data Protection

### Status: CRITICAL VULNERABILITY (P0)
A deep code search was performed for `PII_ENCRYPTION`, `encrypt`, `@EncryptedField`, and `EncryptionUtil`:

1. **Utility Implementation**:
   - `apps/api/src/common/utils/encryption.util.ts` provides `EncryptionUtil.encrypt(text: string): string` using `aes-256-gcm` with 16-byte salt and 12-byte IV, derived via `crypto.scryptSync()`.
2. **Environment Validation**:
   - `apps/api/src/modules/platform/configuration/env.schema.ts` and `apps/api/src/main.ts` mandate `PII_ENCRYPTION_KEY` (minimum 32 characters, rejecting placeholders) in production.
3. **Execution Reality**:
   - `EncryptionUtil.encrypt()` is **NEVER CALLED ANYWHERE IN THE CODEBASE**.
   - `EncryptionUtil.maskPan()` and `EncryptionUtil.maskAadhaar()` are used in `ContactMapper` and `AccountMapper`, but only to mask outbound API response payloads.
   - In PostgreSQL, the `contacts`, `users`, `accounts`, and `motor_payment_records` tables store `panNumber`, `aadhaarNumber`, `phone`, and `referenceNumber` in **PLAINTEXT**.
   - Any database backup, read-replica access, or SQL injection immediately exposes customer PII in violation of IRDAI Cybersecurity Regulations and DPDP Act 2023.

---

## F.5 Database Security

### 1. Connection Security & Loopback Binding
- **Docker Compose (`docker-compose.yml`)**:
  - PostgreSQL port 5432 is explicitly bound to loopback:
    ```yaml
    ports:
      - "127.0.0.1:5432:5432"
    ```
  - Redis port is bound to loopback: `"127.0.0.1:6380:6379"`.
  - Containers are segregated across `jest_internal` (database, redis) and `jest_external` (web, public ingress). PostgreSQL is not attached to `jest_external`.

### 2. Production Credential Validation
- `apps/api/src/modules/platform/configuration/env.schema.ts` enforces fail-closed production checks:
  - Rejects `postgres:postgres`, `root:root`, `admin:admin`, `localhost`, and `127.0.0.1` in `DATABASE_URL` when `NODE_ENV=production`.

### 3. Connection Pool Configuration & Startup Error Handling
- **Connection Pool**: `PrismaService` calls `super()` with no parameters. The connection pool defaults to Prisma's formula `num_cpus * 2 + 1` with a 10s default connect timeout. No custom pool sizing or query timeouts are configured.
- **Fail-Open Startup Warning**: In `apps/api/src/database/prisma.service.ts`:
  ```typescript
  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Prisma Database Client connected successfully.');
    } catch (err: any) {
      this.logger.warn(`[PrismaService] Database connection warning: ${err.message}...`);
    }
  }
  ```
  `onModuleInit` catches database connection failures and logs a warning instead of rethrowing. The NestJS application will boot and begin accepting traffic even if PostgreSQL is offline.

---

## F.6 Backup & Recovery

1. **Backup Scripts**:
   - No automated backup script exists in `infrastructure/` or `scripts/`.
   - No automated offsite S3 snapshot or WAL-G/pgBackRest archiving is configured.
2. **Operations Runbook**:
   - `docs/OPERATIONS_RUNBOOK.md` contains only 26 lines. It covers high API latency, BullMQ failed jobs, and Redis loss. **It contains zero backup or restore procedures and zero specific commands**.
3. **Disaster Recovery Drill Evidence**:
   - `scripts/dr-drill.ps1` exists as a local manual drill script. It tests `docker exec jest-postgres pg_dump -F c` and `pg_restore --clean --if-exists`, measuring:
     - Target RPO: `<= 15 minutes (900s)`
     - Target RTO: `<= 60 minutes (3600s)`
   - While the drill script verifies that PostgreSQL custom-format dumps can be cleanly restored, there is no evidence of automated daily backups in production.

---

## F.7 Soft Delete Coverage

1. **Coverage Analysis**:
   - 18 models define `deletedAt`.
   - 140 models do not define `deletedAt`.
2. **Global Filtering Missing**:
   - No Prisma Client extension (`prisma.$extends`) exists to automatically inject `{ deletedAt: null }`.
3. **Repository Spot-Check**:
   - `ClaimRepository`: Correctly applies `where: { ..., deletedAt: null }` in `findAll`, `findById`, and `findByClaimNumber`.
   - `QuotationRepository`: Defines `findAll` with `deletedAt: null`, but inherits `findPaginated` from `BaseRepository`.
   - `PolicyRepository`: Inherits `findPaginated` from `BaseRepository`. `GetPolicyService.executeAll` calls `findPaginated` without `deletedAt: null`. **Soft-deleted policies are returned to users**.
   - `ContactRepository`: Lacks consistent soft-delete filtering in batch queries.

---

## F.8 Health & Observability

### 1. Health Checks (`apps/api/src/modules/health/health.controller.ts`)
- **`GET /api/v1/health`**: Executes `HealthService.checkV2()`, testing:
  - Database connectivity (`SELECT 1`) and latency.
  - Redis ping and latency (with 2000ms timeout).
  - Outbox event queue backlog (`outboxEvent.count({ where: { status: 'PENDING' } })`).
  - Node.js process heap memory vs 512MB limit.
  - Disk accessibility (`fs.statSync`).
- **`GET /api/v1/health/ready`**: Actively probes DB (`SELECT 1`) and Redis (`ping`). Throws 503 `ServiceUnavailableException` if DB is down.
- **`GET /api/v1/health/live`**: Returns uptime and timestamp.
- **`GET /api/v1/health/terminus`**: Uses `@nestjs/terminus` to check `PrismaHealthIndicator`, `DiskHealthIndicator` (90% threshold), and `MemoryHealthIndicator` (512MB heap/rss).

### 2. Metrics Endpoints (`apps/api/src/modules/health/metrics.controller.ts`)
- **`GET /api/v1/metrics`**: Exposes Prometheus metrics via `prom-client`:
  - `process_cpu_user_seconds_total`, memory metrics.
  - `jest_crm_lead_created_total` Counter.
  - `jest_crm_api_request_duration_ms` Histogram.
- **Authentication**: Guarded by `MetricsAuthGuard`, requiring:
  - Valid `METRICS_SCRAPE_TOKEN` (`Bearer` or `x-metrics-token`, >= 16 chars), OR
  - Authenticated JWT with `RoleType.ADMIN`.

### 3. Structured Logging
- `StructuredLoggerService` (`apps/api/src/common/logger/structured-logger.service.ts`) outputs clean JSON with `timestamp`, `level`, `correlationId`, `context`, and `message`.
- **Limitation**: `StructuredLoggerService` is **only wired to `RequestLoggerMiddleware`**. In `main.ts`, the root NestJS application logger is not replaced with `StructuredLoggerService`, resulting in standard text console output for general application logs.

---

## F.9 Findings Summary

| Finding ID | Severity | Title | Affected Component | Release Decision |
|---|:---:|---|---|---|
| **F-01** | **P0** | Sensitive PII Stored in Plaintext (EncryptionUtil Never Called) | `encryption.util.ts`, `Contact`, `User` | **BLOCKER** |
| **F-02** | **P1** | Soft-Delete Leakage in Paginated Policy & Entity Listings | `BaseRepository`, `get-policy.service.ts` | **BLOCKER** |
| **F-03** | **P1** | Concurrent Invoice/Receipt Number Collision in Motor Payments | `motor-payment-tracking.service.ts` | **BLOCKER** |
| **F-04** | **P1** | Sequences Created via Runtime DDL Instead of Migrations | `policy.repository.ts`, `claim.repository.ts` | **BLOCKER** |
| **F-05** | **P1** | Unindexed Tenant Column `Vehicle.companyId` & 42 FK Fields | `schema.prisma` | **BLOCKER** |
| **F-06** | **P2** | Absence of Automated Scheduled Backups & Runbook Procedures | `OPERATIONS_RUNBOOK.md`, `infrastructure/` | **RELEASE GATE** |
| **F-07** | **P2** | Dangerous `onDelete: Cascade` on Regulatory Policy Endorsements | `schema.prisma` (Policy -> Endorsement) | **MUST FIX** |
| **F-08** | **P2** | Financial Amount Nullability in Settlement & MotorPayment | `schema.prisma` (Settlement, PaymentRecord) | **MUST FIX** |
| **F-09** | **P2** | Unindexed `Quotation.expiryDate` and 32 Status Columns | `schema.prisma` | **RECOMMENDED** |
| **F-10** | **P2** | `PrismaService` Swallows Database Connection Errors at Boot | `prisma.service.ts:36-40` | **RECOMMENDED** |
| **F-11** | **P3** | Incomplete User Audit Fields on Financial Ledger & Vehicles | `schema.prisma` (Invoice, Receipt, Vehicle) | **POST-RELEASE** |
| **F-12** | **P3** | Webhook Idempotency Key Late Persistence Race Condition | `motor-payment-tracking.service.ts` | **RECOMMENDED** |

---

### Detailed Findings

#### F-01: Sensitive PII Stored in Plaintext (EncryptionUtil.encrypt Never Called)
- **ID**: `F-01`
- **Severity**: **P0 (CRITICAL)**
- **Title**: PII Plaintext Persistence at Rest in PostgreSQL
- **File/Line**: `apps/api/src/common/utils/encryption.util.ts`, `apps/api/src/modules/contacts/mappers/contact.mapper.ts:28-31`, `apps/api/prisma/schema.prisma:185-195`
- **Observed**: Although `EncryptionUtil.encrypt()` is implemented with AES-256-GCM and `PII_ENCRYPTION_KEY` is validated in `env.schema.ts` and `main.ts`, `EncryptionUtil.encrypt()` is never called in any service or repository. Contact Aadhaar numbers, PAN numbers, and phone numbers are stored as plaintext strings in PostgreSQL.
- **Expected**: Sensitive identity numbers (PAN, Aadhaar) and bank details must be encrypted at rest using AES-256-GCM before writing to the database.
- **Evidence**:
  ```bash
  Get-ChildItem -Recurse -Filter "*.ts" apps/api/src | Select-String -Pattern "EncryptionUtil\.encrypt"
  # Output: 0 occurrences
  ```
- **Impact**: Severe violation of IRDAI Cybersecurity Regulations and the Digital Personal Data Protection (DPDP) Act 2023. Database backups, database access logs, or SQL compromises expose all customer identities.
- **Release Decision**: **BLOCKER**. Must implement Prisma Client encryption extension or service-layer encryption before production release.

---

#### F-02: Soft-Delete Leakage in Paginated Policy & Entity Listings
- **ID**: `F-02`
- **Severity**: **P1 (HIGH)**
- **Title**: Soft-Deleted Policies and Entities Exposed in List Queries
- **File/Line**: `apps/api/src/common/base/base.repository.ts:36-47`, `apps/api/src/modules/policies/services/queries/get-policy.service.ts:30-33`
- **Observed**: `BaseRepository.findPaginated` constructs `whereClause = { ...where }` without injecting `deletedAt: null`. `GetPolicyService.executeAll` forwards the scope filter directly to `findPaginated`. Consequently, `GET /api/v1/policies` returns soft-deleted policies. Over 270 queries across the codebase omit `deletedAt: null`.
- **Expected**: All listing and count queries on soft-deletable models must enforce `deletedAt: null`.
- **Evidence**:
  `apps/api/src/common/base/base.repository.ts:36`:
  ```typescript
  const whereClause = { ...where };
  // No deletedAt: null added!
  const [data, total] = await Promise.all([
    (this.model as any).findMany({ where: whereClause, ... }),
    (this.model as any).count({ where: whereClause }),
  ]);
  ```
- **Impact**: Deleted policies, quotations, and leads reappear in agent dashboards, distorting financial analytics and allowing illegal operations on deleted policies.
- **Release Decision**: **BLOCKER**. Update `BaseRepository.findPaginated` to inject `deletedAt: null` and register Prisma `$extends` query filter.

---

#### F-03: Concurrent Invoice/Receipt Number Collision in Motor Payments
- **ID**: `F-03`
- **Severity**: **P1 (HIGH)**
- **Title**: Race Condition in Motor Payment Invoice and Receipt Generation
- **File/Line**: `apps/api/src/modules/motor/services/motor-payment-tracking.service.ts:523-524, 555-556`
- **Observed**: When a motor payment is marked `PAID`, invoice and receipt numbers are generated using un-locked `tx.invoice.count()` and `tx.receipt.count()` combined with `Date.now().toString().slice(-6)`. Under concurrent payment webhook deliveries or simultaneous customer checkouts, both transactions compute identical strings, triggering a `P2002` unique constraint failure.
- **Expected**: Must use atomic PostgreSQL sequences (such as `receipt_number_seq`) or pessimistic locking (`SELECT ... FOR UPDATE`), matching the pattern in `PaymentService`.
- **Evidence**:
  ```typescript
  const invoiceCount = await tx.invoice.count();
  const invoiceNum = `INV-${Date.now().toString().slice(-6)}-${(invoiceCount + 1).toString().padStart(4, '0')}`;
  ...
  const receiptCount = await tx.receipt.count();
  const receiptNum = `RCP-${Date.now().toString().slice(-6)}-${(receiptCount + 1).toString().padStart(4, '0')}`;
  ```
- **Impact**: Legitimate customer payments are rejected with HTTP 500/Conflict errors during concurrent transactions, causing payment status reconciliation failures.
- **Release Decision**: **BLOCKER**. Replace count-based generation with PostgreSQL sequences or pessimistic locking.

---

#### F-04: Sequences Created via Runtime DDL Instead of Migrations
- **ID**: `F-04`
- **Severity**: **P1 (HIGH)**
- **Title**: Dynamic DDL Execution for Sequences in Repository Runtime Code
- **File/Line**: `apps/api/src/modules/policies/repositories/policy.repository.ts:61-66`, `apps/api/src/modules/claims/repositories/claim.repository.ts:40-44`, `apps/api/src/modules/contacts/repositories/contact.repository.ts:38-43`, `apps/api/src/modules/quotation/repositories/quotation.repository.ts:68-73`
- **Observed**: Sequences `policy_number_seq`, `claim_number_seq`, `contact_number_seq`, and `quotation_number_seq` are not created in any Prisma migration file. Application repositories catch sequence errors and execute `CREATE SEQUENCE IF NOT EXISTS ... START 1;` at runtime.
- **Expected**: All database sequences must be defined in version-controlled Prisma migration scripts.
- **Evidence**:
  ```typescript
  try {
    const result = await this.prisma.$queryRaw<[{ nextval: bigint }]>`SELECT nextval('policy_number_seq')`;
    return `POL-${result[0].nextval.toString().padStart(6, '0')}`;
  } catch {
    await this.prisma.$executeRaw`CREATE SEQUENCE IF NOT EXISTS policy_number_seq START 1;`;
    ...
  }
  ```
- **Impact**: In a hardened production deployment where the application database user does not have DDL privileges (`CREATE SEQUENCE`), policy issuance, claims, and quotation creation will crash.
- **Release Decision**: **BLOCKER**. Create a formal Prisma migration adding all sequences.

---

#### F-05: Unindexed Tenant Column Vehicle.companyId and 42 FK Fields
- **ID**: `F-05`
- **Severity**: **P1 (HIGH)**
- **Title**: Missing Indexes on Tenant Keys and Foreign Keys
- **File/Line**: `apps/api/prisma/schema.prisma` (L3212, Vehicle model; L4350, Task model)
- **Observed**: `Vehicle.companyId` lacks an index. 42 foreign key fields (including `Task.policyId`, `Task.claimId`, `Task.customerId`, `CustomerAgentHistory.customerId`, `Quotation.insurerId`) are unindexed.
- **Expected**: Every foreign key and tenant partitioning column must have an index.
- **Evidence**: AST parser identified 43 unindexed FK fields in `schema.prisma`.
- **Impact**: As the vehicle and task databases grow, cross-tenant queries and entity joins cause full table scans, resulting in high database latency and connection pool exhaustion.
- **Release Decision**: **BLOCKER**. Add `@@index` annotations to all 43 unindexed FK fields in `schema.prisma`.

---

#### F-06: Absence of Automated Scheduled Backups & Runbook Procedures
- **ID**: `F-06`
- **Severity**: **P2 (MEDIUM)**
- **Title**: Missing Operational Backup Infrastructure and Documented Restore Runbook
- **File/Line**: `docs/OPERATIONS_RUNBOOK.md:1-26`, `infrastructure/docker/docker-compose.yml`
- **Observed**: No automated backup cron or offsite replication exists. `docs/OPERATIONS_RUNBOOK.md` contains no backup or restore commands or recovery procedures.
- **Expected**: Operational automated backup pipeline with documented point-in-time recovery runbook guaranteeing RPO <= 15 minutes and RTO <= 60 minutes.
- **Evidence**: `docs/OPERATIONS_RUNBOOK.md` contains zero occurrences of `backup`, `restore`, or `pg_dump`.
- **Impact**: High vulnerability to permanent data loss in case of hardware failure or accidental corruption.
- **Release Decision**: **RELEASE GATE**. Must configure automated backup cron and document restore commands prior to production launch.

---

#### F-07: Dangerous onDelete: Cascade on Regulatory Policy Endorsements
- **ID**: `F-07`
- **Severity**: **P2 (MEDIUM)**
- **Title**: Cascading Deletion of Historical Endorsements and Renewals
- **File/Line**: `apps/api/prisma/schema.prisma:680, 710, 715`
- **Observed**: `Endorsement.policy`, `RenewalTask.policy`, `RenewalJob.policy`, `PolicyMember.policy`, and `PolicyNominee.policy` are configured with `onDelete: Cascade`.
- **Expected**: Deletion of a policy must be restricted if active endorsements or renewal tasks exist (`onDelete: Restrict`).
- **Evidence**: `schema.prisma`:
  ```prisma
  model Endorsement {
    policy Policy @relation(fields: [policyId], references: [id], onDelete: Cascade)
  }
  ```
- **Impact**: An accidental policy delete operation silently deletes all historical endorsements, violating regulatory record retention guidelines.
- **Release Decision**: **MUST FIX BEFORE PRODUCTION**. Change `onDelete: Cascade` to `onDelete: Restrict` for endorsements and financial history.

---

#### F-08: Financial Amount Nullability in Settlement & MotorPaymentRecord
- **ID**: `F-08`
- **Severity**: **P2 (MEDIUM)**
- **Title**: Nullable Financial Amounts on Settlement and Payment Records
- **File/Line**: `apps/api/prisma/schema.prisma:2310, 3720, 4120`
- **Observed**: `Settlement.retainedCommission` and `Settlement.netPayable` are nullable `Decimal?`. `MotorPaymentRecord.amount` is nullable `Decimal?`. `MotorQuotation` defines 8 premium breakdown components as nullable `Decimal?`.
- **Expected**: Financial settlement and verified payment amounts must be strictly non-nullable.
- **Evidence**: `Settlement` and `MotorPaymentRecord` field definitions in `schema.prisma`.
- **Impact**: Incomplete financial entries can be persisted, causing reporting discrepancies and null-pointer exceptions in payout engines.
- **Release Decision**: **MUST FIX BEFORE PRODUCTION**.

---

#### F-09: Unindexed Quotation.expiryDate and 32 Status Columns
- **ID**: `F-09`
- **Severity**: **P2 (MEDIUM)**
- **Title**: Missing Query Indexes on Expiry Dates and Status Enums
- **File/Line**: `apps/api/prisma/schema.prisma` (Quotation, Proposal, Endorsement, Receipt, Settlement)
- **Observed**: `Quotation.expiryDate` is unindexed. 32 models lack indexes on their `status` columns.
- **Expected**: All date fields used in expiry filters and all status fields used in queue views must have indexes.
- **Evidence**: Scan of `schema.prisma` indexes.
- **Impact**: Increased query latency on quotation searches, lead queues, and financial receipt views.
- **Release Decision**: **RECOMMENDED ENHANCEMENT**.

---

#### F-10: PrismaService Swallows Database Connection Errors at Boot
- **ID**: `F-10`
- **Severity**: **P2 (MEDIUM)**
- **Title**: Fail-Open Database Bootstrap in PrismaService
- **File/Line**: `apps/api/src/database/prisma.service.ts:36-40`
- **Observed**: `onModuleInit()` catches database connection failures and logs a warning instead of throwing an error or exiting. The NestJS application starts and listens for traffic even when the database is unavailable.
- **Expected**: Application boot must fail fast if the primary database connection cannot be established.
- **Evidence**:
  ```typescript
  try {
    await this.$connect();
    this.logger.log('Prisma Database Client connected successfully.');
  } catch (err: any) {
    this.logger.warn(`[PrismaService] Database connection warning: ${err.message}...`);
  }
  ```
- **Impact**: Load balancers may route initial traffic to dead pods, generating 500 errors until health checks fail.
- **Release Decision**: **RECOMMENDED FIX**. Re-throw error in `onModuleInit()` to fail-fast.

---

#### F-11: Incomplete User Audit Fields on Financial Ledger & Vehicles
- **ID**: `F-11`
- **Severity**: **P3 (LOW)**
- **Title**: Missing Audit Trail on Financial Entries and Vehicle Records
- **File/Line**: `apps/api/prisma/schema.prisma` (Vehicle, Invoice, Receipt, Commission, Settlement, JournalEntry)
- **Observed**: `Vehicle` has neither `createdAt`, `updatedAt`, `createdById`, nor `updatedById`. Core ledger models (`Invoice`, `Receipt`, `Commission`, `Settlement`, `JournalEntry`) lack user tracking fields (`createdById`, `updatedById`).
- **Expected**: All business entities should record who created and last modified each record.
- **Evidence**: Audit trail completeness table in section F.1.5.
- **Impact**: Reduced forensic traceability during financial audits.
- **Release Decision**: **POST-RELEASE HARDENING**.

---

#### F-12: Webhook Idempotency Key Late Persistence Race Condition
- **ID**: `F-12`
- **Severity**: **P3 (LOW)**
- **Title**: Idempotency Key Record Persisted at Transaction End Without Row Lock
- **File/Line**: `apps/api/src/modules/motor/services/motor-payment-tracking.service.ts:343-371, 585-618`
- **Observed**: `recordPayment` checks `findFirst` at the beginning of the transaction, but does not write an `IN_PROGRESS` idempotency key until the transaction finishes.
- **Expected**: Insert an `IN_PROGRESS` idempotency record or acquire a lock on the key at the beginning of the transaction.
- **Evidence**: `motor-payment-tracking.service.ts:343-371`.
- **Impact**: Simultaneous webhook retries could slip through before the first transaction commits.
- **Release Decision**: **RECOMMENDED FIX**.
