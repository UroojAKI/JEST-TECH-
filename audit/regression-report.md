# JEST Policy CRM — Regression Verification & Before/After Evidence Report

**Audit Date:** October 15, 2026  
**Auditor Roles:** Principal QA Architect, Test Automation Architect  
**Scope:** Verification of Historical Fixes (Round 2 Findings R2-001..R2-015) and Baseline Suite Execution  
**Regression Status:** **PREVIOUS FIXES INTACT (ZERO REGRESSIONS); NEW FINDINGS DEF-001..DEF-015 LOGGED**  

---

## 1. Verified Remediations (Round 2 Adversarial Audit)

The 15 vulnerabilities identified during Round 2 Adversarial Testing were re-tested against the current codebase using `test/security/round2-adversarial-audit.spec.ts`. All 18 adversarial tests passed cleanly:

| Finding ID | Vulnerability Vector | Baseline State (Before) | Remediated State (After) | Verification Test Evidence | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **R2-001** | Global Search Cross-Tenant PII Enumeration | `SearchService.search()` queried contacts, leads, policies, claims globally without `companyId` filter. | `search(query, companyId)` enforces mandatory tenant scope; throws `ForbiddenException` if absent. | `round2-adversarial-audit.spec.ts` (Lines 35–100): 2 tests pass. | **PASS** |
| **R2-002 & R2-006** | Warehouse Reporting Multi-Tenant Leakage | All 6 methods in `WarehouseService` queried global tables without `companyId`. | `getEffectiveCompanyId()` fail-closed check added across all methods; queries bound to tenant. | `round2-adversarial-audit.spec.ts` (Lines 102–165): 1 test passes. | **PASS** |
| **R2-003 & R2-010** | CustomersService Inverted Role Scoping & Fallback | `findAll()` bypassed `companyId` for Admin; `assignAgent` fell back to `company.findFirst()`. | Base filter `{ companyId, deletedAt: null }` enforced for all roles; arbitrary fallback replaced with 403 throw. | `round2-adversarial-audit.spec.ts` (Lines 167–235): 3 tests pass. | **PASS** |
| **R2-004 & R2-008** | AgentsService Foreign Provisioning Guard | Admin could provision agents for users belonging to other companies; stats unscoped. | Added check verifying `targetUser.companyId === actor.companyId`; scoped stats to `agent.companyId`. | `round2-adversarial-audit.spec.ts` (Lines 237–305): 3 tests pass. | **PASS** |
| **R2-005** | Customer 360 Sub-Resource Data Leakage | Sub-resources (policies, claims, quotes) queried by `customerId` without tenant filtering. | All nested queries filtered by `companyId`; Agent queries additionally scoped by `agentId`. | `round2-adversarial-audit.spec.ts` (Lines 307–365): 1 test passes. | **PASS** |
| **R2-007 & R2-009** | Document Verification Role Escalation | `DocumentsController` lacked `RolesGuard`; agents could self-verify documents. | Attached `RolesGuard`; restricted review/verify to Admin/Back Office; verified uploader company match. | `round2-adversarial-audit.spec.ts` (Lines 367–440): 3 tests pass. | **PASS** |
| **R2-014** | Endorsement Financial Manipulation | `PREMIUM_CHANGE` allowed arbitrary unvalidated amounts and client field overwrites. | Statutory underwriting floor (₹100) enforced; server-side pro-rata recalculation implemented. | `round2-adversarial-audit.spec.ts` (Lines 442–560): 3 tests pass. | **PASS** |
| **R2-015** | Renewal Engine Synthetic Actor Bypass | `toActorContext()` converted empty companyId to Admin with unbounded `{}` queries. | Synthetic Admin fallback removed; `buildPolicyScope()` strictly requires non-empty `companyId`. | `round2-adversarial-audit.spec.ts` (Lines 562–610): 2 tests pass. | **PASS** |

---

## 2. Regression Test Suite Execution Summary

### 2.1 Full Certification & Security Test Execution
- **Command:** `pnpm --filter api exec jest --config ./test/jest-cert.json --runInBand`
- **Suites Executed:** 17 suites
  - `round2-adversarial-audit.spec.ts`
  - `tenant-isolation.spec.ts`
  - `rbac-authorization.spec.ts`
  - `forensic-blockers-regression.spec.ts`
  - `agent-isolation.spec.ts`
  - `financial-tamper.spec.ts`
  - `http-route-security.spec.ts`
  - `concurrency-contracts.spec.ts`
  - `authoritative-workflow-invariants.spec.ts`
  - `bola.spec.ts`
  - `scope-resolver.spec.ts`
  - `branch-isolation.spec.ts`
  - `direct-resource-bola.spec.ts`
  - `prod-gates.spec.ts`
  - `core-acceptance-scenario.spec.ts`
  - `bola-matrix.spec.ts`
  - `user-status-fsm.spec.ts`
- **Result:** **17 passed, 17 total (252 passed, 0 failed, 100% pass rate in 16.615s)**

### 2.2 Full API Domain Unit Test Execution
- **Command:** `pnpm --filter api exec jest --runInBand`
- **Suites Executed:** 126 suites across all domain modules
- **Result:** **125 passed, 1 skipped (`test:inspection:db`), 881 tests passed, 0 failed**

### 2.3 Web Component & Vitest Execution
- **Command:** `pnpm --filter web test`
- **Suites Executed:** 7 test files (`api-client`, `protected-route`, `VehicleDetailsForm`, `health`, `InspectionDialog`, `agent-workspace`, `PolicyFormsDiscountCommissionCoupling`)
- **Result:** **7 passed, 30 tests passed, 0 failed**

### 2.4 End-to-End Browser Isolation Suite (Playwright)
- **Command:** `pnpm run test:e2e`
- **Journeys Tested:**
  1. Unauthenticated workspace navigation redirects to `/login`
  2. Unauthenticated leads navigation redirects to `/login`
  3. Unauthenticated claims navigation redirects to `/login`
  4. Complete logout evicts all auth storage (`jest-auth-storage`) and browser Back navigation does not expose protected data
  5. Canonical route redirects are enforced (`/sales/leads` $\to$ `/crm/leads`)
- **Result:** **5 passed, 0 failed**

---

## 3. Outstanding Defect Verification Matrix

The newly discovered defects (DEF-001 through DEF-015) were logged in `audit/defect-register.csv` and are tracked for post-audit remediation.
