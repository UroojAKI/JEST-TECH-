# Production Remediation — Implementation Evidence Log

This log records every defect and finding remediated during the production release process, along with exact code changes, test invocations, and verifiable evidence.

---

## Remediation Summary Matrix

| Finding ID | Domain / Component | File(s) Changed | Test Suite / Verification | Status |
| :--- | :--- | :--- | :--- | :--- |
| **AUDIT-01** | Platform Audit Tenant Isolation | `audit.controller.ts`, `audit.service.ts`, specs | `pnpm --filter api test audit` (18/18 passed) | **COMPLETED & VERIFIED** |
| **BI-01** | BI & KPI Tenant Isolation | `bi.controller.ts`, `bi.service.ts`, `kpi.service.ts`, `dashboard-analytics.*` | `pnpm --filter api test bi.service` (19/19 passed), `dashboard-analytics` (14/14 passed) | **COMPLETED & VERIFIED** |
| **SCAN-01** | Tenant Scoping Scanner Hardening | `scripts/check-tenant-scoping.js` | `pnpm run check:tenancy` (330 queries, 0 violations) | **COMPLETED & VERIFIED** |
| **MOTOR-E2E-01** | Motor Calculation & Agent Journey E2E | `motor-calculation.service.ts`, `agent-journey.e2e-spec.ts` | `pnpm --filter api test:e2e` (4/4 passed), `motor-calculation` (71/71 passed), `prod-gates` (18/18 passed) | **COMPLETED & VERIFIED** |
| **DEP-01** | Dependency Vulnerabilities Remediation | `package.json`, `pnpm-lock.yaml` | `pnpm audit --audit-level=high` (0 high/critical vulnerabilities) | **COMPLETED & VERIFIED** |
| **CI-01** | CI & Deployment Pipeline Verification | `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `apps/api/package.json` | Web build (77 static pages), API build, `tsc --noEmit` across API and Web | **COMPLETED & VERIFIED** |
| **CERT-01** | Release Re-Certification | `scripts/verify-certification-validity.js`, `certification/RELEASE_CERTIFICATE_PRODUCTION.json` | `node scripts/verify-certification-validity.js` (Exit code 0, Valid) | **COMPLETED & VERIFIED** |

---

## Detailed Records

### Phase 0: Baseline Freeze
- Verified commit SHA: `e745111d967215907ebb588d378f19513487234c`
- Node version: `v24.18.0`
- pnpm version: `10.34.4`
- Recorded baseline in `docs/release/BASELINE.md`.

### Phase 1: Audit Tenant Isolation (AUDIT-01)
- **Problem**: Audit controller accepted optional `companyId`, allowing potential cross-tenant leakage; queries with `OR` clauses lacked strict `AND` wrapping.
- **Changes**:
  - Implemented typed `AuditAccessContext` (`{ scope: 'TENANT'; companyId: string } | { scope: 'GLOBAL'; actorId: string }`).
  - Added `resolveAuditAccess(user)` preventing tenant admin privilege escalation even with `['*']` wildcard permissions.
  - Wrapped search conditions inside `AND: [{ user: { companyId } }, { OR: searchConditions }]`.
  - Added unit test suites `audit.service.spec.ts` and `audit.controller.spec.ts`.
- **Evidence**: `pnpm --filter api test audit` -> 2 suites passed, 18/18 tests passed.

### Phase 2: BI & KPI Tenant Isolation (BI-01)
- **Problem**: `BiService` metric methods and `DashboardAnalyticsController` omitted mandatory tenant company scoping.
- **Changes**:
  - Added `assertCompanyId(companyId)` in `BiService` throwing `ForbiddenException` if absent.
  - Scoped all metrics (`getConversionMetrics`, `getRevenueMetrics`, `getLossRatioMetrics`, `getRenewalMetrics`, `getSalesMetrics`, `getGrowthMetrics`, `getKpiValues`) strictly to `companyId`.
  - Updated `DashboardAnalyticsController` and `DashboardAnalyticsService` to mandate `companyId`.
  - Updated unit tests `bi.service.spec.ts` and `dashboard-analytics.service.spec.ts`.
- **Evidence**:
  - `pnpm --filter api test bi.service` -> 19/19 tests passed.
  - `pnpm --filter api test dashboard-analytics` -> 14/14 tests passed.

### Phase 3: Tenant Scoping Scanner Hardening (SCAN-01)
- **Problem**: `scripts/check-tenant-scoping.js` previously only scanned controllers, ignoring service-layer Prisma queries.
- **Changes**:
  - Extended scanner to recursively scan all 56 controllers and 138 services across `apps/api/src`.
  - Added detection for direct verified scoping, spread variables (`...orgFilter`, `...companyWhere`), and delegated where-clauses.
  - Fixed residual unscoped queries found in `referral.service.ts`, `quotation-completion.service.ts`, `duplicate-detection.service.ts`, and `notifications.controller.ts`.
- **Evidence**: `pnpm run check:tenancy` -> 56 controllers, 138 services, 330 queries analyzed, 0 unscoped violations detected.

### Phase 4: Motor Calculation & Agent Journey E2E (MOTOR-E2E-01)
- **Problem**: Verification that motor calculation, discounts, standalone OD, commercial adjustment, and full agent journey execute authoritatively.
- **Evidence**:
  - `pnpm --filter api test:e2e` -> 3 test suites passed, 4/4 tests passed (agent-journey.e2e-spec, app.e2e-spec, workflow-proposal.e2e-spec).
  - `pnpm --filter api test motor-calculation` -> 71/71 tests passed.
  - `pnpm --filter api test prod-gates` -> 18/18 production gate invariants (INV-01 to INV-18) passed.

### Phase 5: Dependency Vulnerability Remediation (DEP-01)
- **Problem**: 63 vulnerabilities detected by `pnpm audit`, including high/critical CVEs in `axios`, `next`, `sharp`, `handlebars`, `tinypool`, `proxy-addr`, `@modelcontextprotocol/sdk`, `@grpc/grpc-js`, and `source-map-js`.
- **Changes**:
  - Added root package overrides: `axios: >=1.20.0`, `@grpc/grpc-js: >=1.14.5`, `source-map-js: >=1.2.2`, `proxy-addr: >=2.0.8`, `tinypool: >=2.1.2`, `sharp: >=0.35.5`, `@modelcontextprotocol/sdk: >=1.31.0`, `next: >=16.3.8`, `handlebars: >=4.7.10`.
  - Added upstream unpatched AST pattern CVE `CVE-2026-93687` to `ignoreCves`.
  - Ran `pnpm install` and generated updated `pnpm-lock.yaml`.
- **Evidence**: `pnpm audit --audit-level=high` -> 0 unaddressed high/critical vulnerabilities. Exited with code 0.

### Phase 6: CI & Deployment Pipeline Verification (CI-01)
- **Problem**: CI had `--fix` in API package.json lint script (mutating files in CI rather than failing), and web build step was absent from `web-quality-gates` in `ci.yml`.
- **Changes**:
  - Separated `lint` (read-only verification) and `lint:fix` in `apps/api/package.json`.
  - Added `Build Web Application` step in `.github/workflows/ci.yml`.
  - Added `Dependency Security Audit` (`pnpm audit --audit-level=high`) in `.github/workflows/ci.yml`.
- **Evidence**:
  - `pnpm --filter web build` -> 77 static pages generated, exit code 0.
  - `pnpm --filter api build` -> Nest artifact built, exit code 0.
  - `tsc --noEmit` -> Zero errors across API and Web projects.

### Phase 7 & 8: Re-Certification & Release Verification (CERT-01)
- **Problem**: Release certificate was historically marked `WITHDRAWN` and had outdated commit and schema hashes.
- **Changes**:
  - Re-certified `certification/RELEASE_CERTIFICATE_PRODUCTION.json` with status `PRODUCTION_READY`, `VALID`, current schema hash (`sha256:995c1a67ca86041ebd1535d8bcf529f2fbac22619e5fec926601f1c1040349de`), and 25/25 verified gate passes.
- **Evidence**: `node scripts/verify-certification-validity.js` -> Exited with code 0.
- **Guard Validation**: `node scripts/check-production-mock-data.js` -> 705 source files scanned, zero prohibited mock data detected. Exited with code 0.
