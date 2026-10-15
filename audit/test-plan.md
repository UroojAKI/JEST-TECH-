# JEST Policy CRM — Production Verification Test Plan

**Document Version:** 2.0.0  
**Effective Date:** October 15, 2026  
**Target Environment:** Isolated Test Sandbox / Pre-Production Staging  
**Auditor Roles:** Principal QA Architect, Application Security Engineer, Database Reliability Engineer  

---

## 1. Test Strategy & Scope Overview

This test plan defines the comprehensive testing methodology used to audit, evaluate, and verify the JEST Policy CRM application across functional correctness, authorization enforcement, multi-tenant data isolation, financial precision, concurrency resilience, and production readiness.

### Scope of Verification
- **Frontend Web Application (`apps/web`):** 82 App Router screens across public, authenticated, and role-scoped workspaces.
- **Backend API Service (`apps/api`):** 420 RESTful endpoints, 56 controllers, and 125 services across 32 domain modules.
- **Database Architecture (`apps/api/prisma`):** 158 models, composite foreign keys, soft delete cascades, and tenant isolation indexes.
- **Asynchronous Workers & Queues:** 6 BullMQ queues, 5 workers, 3 scheduled cron processors, and 1 transactional outbox processor.
- **External Integrations:** Razorpay payment webhooks, MinIO/S3 object storage, Twilio/SMTP notification dispatchers, and Prometheus telemetry.

---

## 2. Test Levels & Execution Matrix

```text
+-------------------------------------------------------------------------------+
| LEVEL 1: Static Verification & AST Architecture Guards                        |
| - TypeScript Compilation (tsc --noEmit) on API and Web                        |
| - Tenant Scoping Guard (check-tenant-scoping.js)                              |
| - Mock Data & Hardcoded Value Scanner (check-production-mock-data.js)         |
| - Frontend-Backend Contract Cross-Reference (verify-api-contracts.ts)         |
+-------------------------------------------------------------------------------+
                                    │
                                    ▼
+-------------------------------------------------------------------------------+
| LEVEL 2: Domain Unit Testing                                                  |
| - NestJS Unit Test Suites (126 suites, 881 tests)                             |
| - Web Component & Store Unit Suites (7 suites, 30 tests via Vitest)           |
+-------------------------------------------------------------------------------+
                                    │
                                    ▼
+-------------------------------------------------------------------------------+
| LEVEL 3: Certification & Security Adversarial Suites                          |
| - Role-Based Access Control Matrix (rbac-authorization.spec.ts)               |
| - Multi-Tenant Isolation & Composite FKs (tenant-isolation.spec.ts)           |
| - Agent Data Scoping & Cross-Branch Isolation (agent-isolation.spec.ts)       |
| - Round 2 Adversarial Audit Verification (round2-adversarial-audit.spec.ts)   |
| - Financial Anti-Tamper & Underwriting Floor (financial-tamper.spec.ts)       |
+-------------------------------------------------------------------------------+
                                    │
                                    ▼
+-------------------------------------------------------------------------------+
| LEVEL 4: Concurrency, Race Condition & Deep System Churn                     |
| - 100-Concurrent Policy Issuance Race (Duplicate issuance prevention)         |
| - 100-Concurrent Payment Reconciliation (Ledger double-entry prevention)      |
| - 100-Concurrent Numbering Sequence Generation (Zero ID collision)           |
| - 100-Iteration IRDAI Statutory Tariff Calculation Throughput                |
| - 100-Iteration Adversarial State Machine Fuzzing                             |
| - 100-Iteration Dirty Data & SQLi Payload Injections                          |
+-------------------------------------------------------------------------------+
                                    │
                                    ▼
+-------------------------------------------------------------------------------+
| LEVEL 5: End-to-End Multi-Tenant Browser Testing                              |
| - Playwright Browser Suite (5 Multi-Tenant Journey Scenarios)                 |
+-------------------------------------------------------------------------------+
```

---

## 3. Environment & Test Data Strategy

### 3.1 Isolation & Data Safety Invariants
- **No Production Data:** Testing is conducted exclusively on synthetic test data in isolated PostgreSQL databases.
- **Ephemeral Sandbox Tenants:** Every security and concurrency test constructs dedicated ephemeral tenant companies (`TEST_COMPANY_A`, `TEST_COMPANY_B`, `CHURN_TENANT_A`, `CHURN_TENANT_B`).
- **Clean Teardown:** Test harnesses remove ephemeral fixtures or run inside non-committing transactions where supported.

### 3.2 Statutory Master Data
- The test environment is seeded with the approved IRDAI Motor Tariff schedule (`scripts/seed-tariffs.ts`), populating 30+ active CC-band and GVW statutory rates across Private Car, Two Wheeler, and Commercial Vehicle categories.

---

## 4. Test Suites Breakdown & Execution Commands

### 4.1 Master Repeatable Verification Command
To run the full supported verification suite sequentially and capture all evidence:

```bash
# 1. Typecheck API & Web
pnpm --filter api exec tsc --noEmit
pnpm --filter web exec tsc --noEmit

# 2. Architecture & CI Guards
pnpm run check:tenancy
pnpm run check:mock-data
pnpm run check:api-contracts

# 3. Web Component Tests
pnpm --filter web test

# 4. API Certification & Security Suite (run sequentially to prevent heap exhaustion)
pnpm --filter api exec jest --config ./test/jest-cert.json --runInBand

# 5. API Unit Test Suite
pnpm --filter api exec jest --runInBand

# 6. Deep System Churn & Concurrency Harness (Requires live Postgres DB)
npx tsx scripts/deep-system-churn-test.ts
```

---

## 5. Exit Criteria & Quality Gates

| Gate ID | Quality Gate Description | Target Metric | Observed Audit Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| **G-01** | Static Typecheck (API & Web) | 0 compiler errors | 0 errors | **PASS** |
| **G-02** | Tenancy Scoping Controller Scan | 100% controllers scanned | 56/56 passed | **PASS** |
| **G-03** | Mock Data & Placeholder Scanner | 0 prohibited patterns | 703 files verified | **PASS** |
| **G-04** | API Contract Consistency | 0 unmatched calls | 304/304 matched | **PASS** |
| **G-05** | API Unit Test Execution | 100% pass rate | 881/881 passed | **PASS** |
| **G-06** | Certification & Security Suites | 100% pass rate | 252/252 passed | **PASS** |
| **G-07** | Web Unit Suite Execution | 100% pass rate | 30/30 passed | **PASS** |
| **G-08** | Concurrency Issuance Race | Exactly 1 success, 0 dups | 1 success, 99 rejections | **PASS** |
| **G-09** | Concurrency Payment Reconciliation | Exactly 1 success, 0 dups | 1 success, 99 rejections | **PASS** |
| **G-10** | High-Throughput Tariff Calculation | 100% correct IRDAI math | 100/100 passed (p50: 1.2ms) | **PASS** |
| **G-11** | Adversarial State Machine Fuzzing | 0 illegal state jumps | 100/100 rejected | **PASS** |
| **G-12** | Database Persistence Assertions | 100% core entities pass | 8/10 passed (2 defects) | **FAIL** |
| **G-13** | Release Governance Certification | Valid commit & schema hash | Certificate WITHDRAWN | **FAIL** |
| **G-14** | Production Mock UI Cleanliness | 0 fake success toasts | 83 fake toasts detected | **FAIL** |
| **G-15** | Infrastructure Network Isolation | 0 unauthenticated listeners | Redis unauth on port 6380 | **FAIL** |
