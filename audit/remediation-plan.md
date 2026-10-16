# JEST Policy CRM — Prioritized Production Remediation Plan

**Document Version:** 2.0.0  
**Effective Date:** October 15, 2026  
**Auditor Roles:** Principal QA Architect, Security Lead, Full-Stack Technical Lead  
**Scope:** Remediation of 15 Confirmed Audit Defects (DEF-001 through DEF-015)  

---

## 1. Remediation Phases & Prioritization Matrix

Remediation must proceed sequentially across four strictly ordered phases. No release promotion may occur until all Phase A and Phase B defects are remediated and regression-tested.

```text
+-------------------------------------------------------------------------------+
| PHASE A: Contain Critical Security & Financial Defects (CRITICAL / P1) [COMPLETED]       |
| - DEF-003: Claims state machine terminal protection on PATCH /claims/:id      |
| - DEF-004: Webhook gateway provider allow-list and signature default-deny     |
| - DEF-001: Unauthenticated Redis host publication and password protection     |
| - DEF-009: Premium calculation floating-point rounding correction             |
| - DEF-005: Fake "Issue Premium Receipt" action removal or backend wiring      |
| - DEF-011: Legacy motor migration CLI transactional safety & dry-run default |
+-------------------------------------------------------------------------------+
                                    │
                                    ▼
+-------------------------------------------------------------------------------+
| PHASE B: Close UI Integrity, Persistence & State Gaps (HIGH / P2) [COMPLETED]             |
| - DEF-006: Fake report and voucher download buttons wired to real streams      |
| - DEF-007: Fake save button on read-only numbering configuration resolved     |
| - DEF-008: Customer notes & alert dismissals migrated from localStorage to DB |
| - DEF-010: Motor inspection photographic keys (7 views) enforced on approve   |
| - DEF-015: Claim repository findById tenant query predicate scoping          |
+-------------------------------------------------------------------------------+
                                    │
                                    ▼
+-------------------------------------------------------------------------------+
| PHASE C: Operations, CI/CD & Environment Normalization (MEDIUM / P2) [COMPLETED]          |
| - DEF-012: Node.js runtime version pinned consistently (Node 22 LTS)          |
| - DEF-013: CI workflow test invocation command extra separator removed        |
| - DEF-014: Jest package.json test scripts configured with --runInBand         |
| - JEST-AUDIT-0003: Post-deploy health probe and rollback added to deploy.yml  |
| - JEST-AUDIT-0006: Operations runbook updated with real container names       |
+-------------------------------------------------------------------------------+
                                    │
                                    ▼
+-------------------------------------------------------------------------------+
| PHASE D: Final Certification & Production Release Gate (GOVERNANCE / P1)     |
| - Staging deployment and live migration dry-run executed                      |
| - Automated backup and restore rehearsal drill completed                      |
| - DEF-002: Release certificate re-signed with current HEAD & schema hash      |
| - Production GO/NO-GO gate evaluated and approved by stakeholders            |
+-------------------------------------------------------------------------------+
```

---

## 2. Detailed Remediation Actions & Acceptance Criteria

### Phase A — Contain Critical Security & Financial Defects

#### Task A.1: Claims Terminal State Protection (DEF-003)
- **Files Affected:** `apps/api/src/modules/claims/controllers/claims.controller.ts`, `apps/api/src/modules/claims/domain/claim-state-machine.ts`
- **Action:** Replace raw `prisma.claim.update` in `updateClaim` with a dedicated domain command. Validate that `claim.status` is not `SETTLED` or `CLOSED`. If terminal, throw `BadRequestException('Cannot modify settled or closed claims')`.
- **Regression Test:** `test/security/claims-terminal-state.spec.ts` asserting HTTP 400 when attempting to PATCH a settled claim.

#### Task A.2: Webhook Gateway Signature Enforcement (DEF-004)
- **Files Affected:** `apps/api/src/modules/platform/integrations/webhooks/controllers/webhook-gateway/webhook-gateway.controller.ts`
- **Action:** Define an explicit enum of supported providers: `enum SupportedProvider { RAZORPAY = 'razorpay' }`. In `validateSignature`, reject any provider not in the enum with `UnauthorizedException('Unsupported webhook provider')`. For supported providers, require cryptographic HMAC verification.
- **Regression Test:** `test/security/webhook-unauthenticated-rejection.spec.ts` asserting HTTP 401 when sending requests with unknown or unverified provider paths.

#### Task A.3: Redis Host Exposure & Password Protection (DEF-001)
- **Files Affected:** `docker-compose.yml`, `infrastructure/docker/docker-compose.yml`, `.env.example`
- **Action:** Configure Redis with `requirepass ${REDIS_PASSWORD}`. Remove host port mapping `6380:6379` from outer Docker Compose, keeping Redis strictly within the internal network `jest_internal`. Update API `REDIS_URL` to `redis://:${REDIS_PASSWORD}@redis:6379`.
- **Regression Test:** Render Docker Compose configuration and assert no public host port mapping without authentication.

#### Task A.4: Exact Decimal Arithmetic in Premium Engine (DEF-009)
- **Files Affected:** `apps/api/src/modules/quotation/engine/premium.service.ts`
- **Action:** Replace binary floating-point multiplication with integer paise arithmetic or exact rational representation:
  ```ts
  const exactODPaise = BigInt(Math.round(idv * rate * 100)) * BigInt(Math.round(ccMultiplier * 100)) / 10000n;
  const odPremium = Number(exactODPaise) / 100;
  ```
  Apply positive half-up rounding.
- **Regression Test:** Unit test asserting IDV ₹30,00,000, Zone A rate 0.03127, multiplier 1.15 yields exact ₹107,882.

#### Task A.5: Receipt Issuance Truth (DEF-005)
- **Files Affected:** `apps/web/src/app/finance/page.tsx`, `apps/api/src/modules/finance/revenue/`
- **Action:** Remove the hardcoded `toast.success('Receipt REC-2026-9901 issued successfully')`. Wire the button to a real `useIssueReceiptMutation` that calls `POST /finance/receipts`, persists a `Receipt` entity, generates a server-assigned sequence number, and invalidates the receipts query.
- **Regression Test:** `apps/web/src/app/finance/page.test.tsx` verifying API request dispatch and display of real server-assigned receipt ID.

#### Task A.6: Motor Migration Transactional Safety (DEF-011)
- **Files Affected:** `scripts/motor-migration-01.ts`, `apps/api/src/modules/motor/services/motor-migration.service.ts`
- **Action:** Default CLI to `dryRun = !process.argv.includes('--apply')`. Wrap all deduplication, case creation, and policy repointing operations in an interactive Prisma `$transaction`. Run reconciliation assertions inside the transaction before committing.
- **Regression Test:** Test failure injection midway through migration, asserting 100% database rollback.

---

### Phase B — Close UI Integrity, Persistence & State Gaps

#### Task B.1: Report & Voucher Downloads (DEF-006)
- **Files Affected:** `apps/web/src/app/reports/page.tsx`, `apps/web/src/components/finance/vouchers/VoucherPreviewModal.tsx`
- **Action:** Connect download buttons to backend streaming export endpoints (`POST /reports/:id/execute` and `GET /finance/vouchers/:id/download`). Only display success notifications after the browser download has successfully initiated.

#### Task B.2: Numbering Configuration Save (DEF-007)
- **Files Affected:** `apps/web/src/app/admin/numbering/page.tsx`
- **Action:** Remove the misleading "Save" button while the page is read-only, or implement a backend `PUT /admin/numbering/sequences` endpoint with `@Roles(RoleType.ADMIN)` and audit logging.

#### Task B.3: Customer Notes Persistence (DEF-008)
- **Files Affected:** `apps/web/src/components/customer/tabs/CustomerTabsContainer.tsx`, `apps/api/src/modules/customer/`
- **Action:** Replace `localStorage` calls with `CustomerNotesService` backend API. Persist notes in a `CustomerNote` table with `companyId`, `authorId`, `customerId`, and timestamp.

#### Task B.4: Photographic Evidence in Break-In Inspection (DEF-010)
- **Files Affected:** `apps/api/src/modules/motor/services/motor-inspection.service.ts`
- **Action:** In `approveInspection`, validate that all 7 required photo keys (`frontImageKey`, `backImageKey`, `leftImageKey`, `rightImageKey`, `windshieldImageKey`, `chassisImageKey`, `odometerImageKey`) are non-null before transitioning to `APPROVED`.

#### Task B.5: Claim Repository Tenancy Scope (DEF-015)
- **Files Affected:** `apps/api/src/modules/claims/repositories/claim.repository.ts`
- **Action:** Update `findById(id: string, companyId: string)` to include `companyId` in the database predicate, ensuring cross-tenant PII is never loaded into memory.

---

### Phase C — Environment Normalization & Operational Hardening

#### Task C.1: Runtime Version Alignment (DEF-012)
- **Files Affected:** `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `apps/api/Dockerfile`, `apps/web/Dockerfile`
- **Action:** Create `.nvmrc` pinning `20.18.0` (LTS). Reference `.nvmrc` across all GitHub Actions workflows and Docker base images (`node:20.18-alpine`).

#### Task C.2: Jest Test Scripts Memory Optimization (DEF-014)
- **Files Affected:** `apps/api/package.json`
- **Action:** Update test scripts to include `--runInBand`:
  ```json
  "test:cert": "jest --config ./test/jest-cert.json --runInBand",
  "test": "jest --runInBand"
  ```

#### Task C.3: CI Workflow Argument Fix (DEF-013)
- **Files Affected:** `.github/workflows/production-remediation-ci.yml`
- **Action:** Remove the extra `--` separator so `--runInBand` is recognized as an option rather than a path pattern.

---

### Phase D — Release Governance & Recertification

1. Deploy changes to an isolated staging environment.
2. Execute automated backup and restore drill against staging database.
3. Run all verification suites:
   `pnpm run check:tenancy`, `pnpm run check:mock-data`, `pnpm --filter api run test:cert`, `pnpm --filter api run test`, `pnpm --filter web test`.
4. Re-calculate Prisma schema SHA256 hash.
5. Update and re-sign `certification/RELEASE_CERTIFICATE_PRODUCTION.json` with matching commit SHA and schema hash.
6. Issue production GO release sign-off.
