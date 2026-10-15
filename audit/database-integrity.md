# JEST Policy CRM — Database Architecture, Integrity & Transactions Audit

**Audit Date:** October 15, 2026  
**Auditor Roles:** Principal Database Reliability Engineer, Data Architect, SRE  
**Database Engine:** PostgreSQL 16 / 17  
**ORM Framework:** Prisma 5.x / 6.x  
**Schema Definition:** `apps/api/prisma/schema.prisma` (158 Models, 19 Migrations)  
**Database Disposition:** **STRONG CONCURRENCY & COMPOSITE INTEGRITY; PERSISTENCE DEFECTS IDENTIFIED**  

---

## 1. Database Architecture & Schema Analysis

The JEST Policy CRM database schema is defined in `apps/api/prisma/schema.prisma` containing **158 models** and **19 sequential Prisma migrations**.

### 1.1 Multi-Tenant Storage Design
- **Company-Scoped Primary Entities (24 models):** `Company`, `Branch`, `User`, `Lead`, `Contact`, `Customer`, `Quotation`, `MotorQuotationCase`, `Policy`, `Claim`, `Document`, `MotorInspection`, `RenewalTask`, `PolicyPayment`, `Commission`, `JournalEntry`, etc.
- **Soft-Delete Lifecycle (19 models):** Models supporting audit retention implement `deletedAt DateTime?` with corresponding `@@index([deletedAt])` indexes to optimize active-record scans.
- **Physical Composite Foreign Key Constraints:**
  Migration `20260924000001_cross_tenant_composite_fks` established composite unique constraints and foreign keys:
  ```sql
  ALTER TABLE "leads" ADD CONSTRAINT "leads_companyId_contactId_fkey"
    FOREIGN KEY ("companyId", "contactId") REFERENCES "contacts"("companyId", "id") ON DELETE RESTRICT;

  ALTER TABLE "quotations" ADD CONSTRAINT "quotations_companyId_contactId_fkey"
    FOREIGN KEY ("companyId", "contactId") REFERENCES "contacts"("companyId", "id") ON DELETE RESTRICT;

  ALTER TABLE "policies" ADD CONSTRAINT "policies_companyId_quotationId_fkey"
    FOREIGN KEY ("companyId", "quotationId") REFERENCES "quotations"("companyId", "id") ON DELETE RESTRICT;
  ```
  These constraints guarantee physical cross-tenant referential integrity at the database storage engine layer.

---

## 2. Transactional Concurrency & Race Condition Verification

The test harness `scripts/deep-system-churn-test.ts` subjected the database layer to 100-iteration concurrency and race-condition scenarios:

### 2.1 Concurrent Policy Issuance (Anti-Double Issuance)
- **Scenario:** 100 concurrent asynchronous HTTP requests attempting to issue a policy for the same paid quotation.
- **Mechanism:** `IssuePolicyService` utilizes PostgreSQL row-level locking and optimistic check within a Prisma interactive `$transaction`.
- **Observed Result:**
  - Total Attempts: 100
  - Successful Issuances: 1 (Policy created and persisted)
  - Expected Rejections: 99 (HTTP 409 Conflict)
  - Duplicate Policies Generated: **0**
  - Result: **PASS**

### 2.2 Concurrent Payment Reconciliation (Anti-Double Ledger Entry)
- **Scenario:** 100 concurrent requests attempting to reconcile the same payment record into the general ledger.
- **Mechanism:** `FinanceReconciliationService` verifies payment status and creates `JournalEntry` records within a single transaction.
- **Observed Result:**
  - Total Attempts: 100
  - Successful Reconciliations: 1
  - Expected Rejections: 99 (HTTP 409 Conflict)
  - Duplicate Ledger Postings: **0**
  - Result: **PASS**

### 2.3 Atomic Sequence Generation (Zero Collision Guarantee)
- **Scenario:** 100 concurrent workers requesting next sequence numbers for policy, claim, and quote identifiers.
- **Mechanism:** `NumberingEngineService` executes raw atomic update:
  `UPDATE "number_sequences" SET "current" = "current" + 1 WHERE ... RETURNING "current"`
- **Observed Result:**
  - 100 unique, sequential, non-colliding codes generated in 14.8ms.
  - Result: **PASS**

---

## 3. Database Persistence Defects & Migration Integrity Findings

### 3.1 DEF-010: Database Column Persistence Assertions Failure
- **Location:** `scripts/deep-system-churn-test.ts:1132,1152`
- **Observed Failure:** In Section 8 of the deep system churn benchmark, 2 of 10 persistence integrity checks failed:
  1. *MotorInspection:* Inspection record created during workflow execution lacked one or more required photographic S3 keys (`frontImageKey`, `backImageKey`, etc.) or `inspectionCode`.
  2. *Policy:* Policy record created during workflow execution lacked required associated `PolicyHistory` audit rows upon cancellation.
- **Root Cause:** Certain workflow service commands transition state or update status without strictly enforcing that all required photographic and audit history records are written atomically.
- **Remediation:** Enforce validation requiring all 7 image keys in `MotorInspectionService.approveInspection` and guarantee that policy status transitions always write a corresponding `PolicyHistory` row inside `$transaction`.

### 3.2 DEF-011: Legacy Motor Migration Utility Lacks Transactional Safety
- **Location:** `scripts/motor-migration-01.ts:45`, `apps/api/src/modules/motor/services/motor-migration.service.ts`
- **Observed Defect:**
  1. The CLI defaults to write run (`dryRun: false`) unless `--dry-run` is explicitly passed in command-line arguments.
  2. The service executes policy deduplication, quotation case creation, and policy repointing across multiple separate Prisma calls without a surrounding `$transaction`.
  3. Integrity assertions (financial reconciliation, orphan checks) execute *after* mutations are already committed. If an assertion fails, earlier database writes remain committed.
- **Remediation:** Invert default to dry-run mode (`--apply` required to write). Wrap all deduplication and relinking mutations in a single interactive `$transaction`.

### 3.3 Historical Migration File Modifications (JEST-AUDIT-0004)
- **Location:** `apps/api/prisma/migrations/20261001000001_add_task_code_sequence/migration.sql`
- **Finding:** Existing historical migration files were modified in the working tree (BOM removed, default-alter statement altered).
- **Risk:** If these migrations have already been executed against staging or remote production environments, Prisma migration checksum validation (`_prisma_migrations`) will fail.
- **Remediation:** Check remote migration history; restore original migration files if applied remotely and express schema alterations exclusively as forward migrations.
