# Unified CRM Baseline and Audit Checkpoint

**Checkpoint date:** 2026-11-04
**Repository:** `UroojAKI/JEST-TECH-`
**Branch:** `feature/health-insurance-crm`
**HEAD:** `d6feac549f9a82a0a575dedbca16e9a7869a3fb6`
**Disposition:** **NO-GO for production promotion; audit remains in progress**

This checkpoint refreshes the repository baseline and records current, source-verified findings for the Health Insurance, identity, privacy, and release-certificate workstreams in the Unified Master Implementation Plan. It does not claim that the full 14-report adversarial audit is complete. Existing reports dated October 15–19 remain historical evidence and need revalidation against this branch.

## 1. Repository and architecture inventory

The requested target branch is checked out in `jest-policy-crm`. The workspace also contains separate `JEST-GST-FIX` and `jest-policy-crm-pre-refactor-backup` checkouts; neither is the target branch. The target working tree had one pre-existing tracked change in `docs/audit/baseline/api-contract-report.json` before this checkpoint. That change is preserved.

| Area | Current inventory |
|---|---:|
| API feature modules | 32 directories under `apps/api/src/modules` |
| API controllers / services | 58 / 144 |
| API unit specs | 140 |
| API security, certification, and E2E specs | 18 |
| Web App Router pages | 88 |
| Prisma models / enums | 161 / 83 |
| Prisma migration directories | 35 |
| Markdown documents under `docs` | 48 |

The API is a NestJS application, the web app is Next.js, and both use a shared pnpm workspace. `AppModule` registers the CRM identity and agent modules, Health Insurance, a business-intelligence module, and separate BI warehouse, dashboards, and forecasting modules. Their ownership boundaries need a route and service level map before any module is called duplicated.

The schema already has `Agent`, `CustomerAgentHistory`, `HealthQuotationCase`, and `HealthInsuredMember`. `Agent` is company-scoped and has a company-unique internal `agentCode`; customer assignment history exists. There is no external-agent-identifier model or namespace-aware external-code resolver. `CrmIdentityService` currently resolves CRM contacts and customers by phone/email; it is not an external-agent identity registry.

The admin User 360 API (`GET /users/:id/workspace`) and page exist. They aggregate user/agent-attributed leads, quotations, policies, activity, and commissions. This is the existing surface to extend for Agent 360 after attribution and access rules are verified.

## 2. Local baseline evidence

| Check | Result |
|---|---|
| API production build (`pnpm --filter api run build`) | **PASS** |
| API TypeScript check | **PASS** |
| Web TypeScript check | **PASS** |
| Web Vitest suite | **PASS — 16 files, 104 tests** |
| API unit suite | **ENVIRONMENT-LIMITED — 137 suites passed, 2 failed, 1 skipped; 1,178 tests passed, 9 failed, 1 skipped** |
| Tenant-scope scanner | **PASS — 372 queries classified, zero unscoped queries detected** |
| Production mock-data scanner | **PASS — 739 source files scanned** |
| Web production build | **BLOCKED — Next.js returned `EPERM` while creating `.next/server/app/admin`** |
| Production certificate guard | **FAIL — certificate SHA and current schema hash are stale** |
| Dependency audit | **PENDING — registry lookup failed with `ENOTFOUND` in this environment** |
| Database migration status / staging behavior | **NOT VERIFIED — local `DATABASE_URL` is blank and Docker is unavailable** |

The nine API test failures are confined to `health.controller.spec.ts` and `metrics.controller.spec.ts`; both fail while opening local HTTP test sockets with `connect EACCES 127.0.0.1`. The dedicated persisted motor journey was skipped because `E2E_DATABASE_URL` is not configured. These results do not establish that the tests would fail in CI or staging. The Health case ownership/payment and quotation PII regression specs pass as part of the 137 passing suites.

The passing tenancy scan is a heuristic for tenant predicates. It does not prove per-agent ownership: a query filtered by `companyId` can still expose one agent's record to another agent in the same company. The passing mock-data scan likewise does not validate API authorization or data persistence.

The pre-existing, uncommitted API contract report was generated on Nov. 3 and reports 358 frontend calls matched, no mismatches, and 224 backend routes uncalled (207 classified `UNUSED`). Treat those classifications as review candidates only; absence of a frontend call does not prove a route is unused, since routes can serve integrations, jobs, portals, or direct clients.

The current certificate claims `PRODUCTION_READY` for commit `e745111d967215907ebb588d378f19513487234c`. The guard reports current HEAD `d6feac549f9a82a0a575dedbca16e9a7869a3fb6` and schema hash `sha256:e95a03f31ebb64fd2a5bdea23b19943e5707e6262e880bc1fd645c470e6f9530`, versus certified schema hash `sha256:afbf897356222b5e9e481b1eeb6f4923f3c0ef23fb6cb8784b2fa826c160b66b`. Certification is invalid until current evidence is independently reviewed and the certificate is renewed through release governance.

## 3. Current finding register

Statuses describe code evidence. Runtime/database confirmation remains pending where noted.

| ID | Severity | Status | Finding and evidence |
|---|---|---|---|
| CRM-HEALTH-001 | Critical | Source remediation implemented; unit query-scope test passes; runtime reproduction pending | Health case reads and mutations now use a shared tenant + Agent ownership predicate, and document attach/list/remove checks resolve through the same case access helper. Agent ownership uses `HealthQuotationCase.agentId`, with a legacy creator fallback for unassigned cases. CI/staging role tests and migration execution remain pending. Evidence: `health-quotation-case.service.ts`, `health-quotation-document.service.ts`, `health-quotation-case.service.spec.ts`. |
| CRM-HEALTH-002 | High | Source remediation implemented; unit test passes; database-backed verification pending | Case creation now verifies each distinct `familyMemberId` belongs to the proposer's contact and company, and rejects repeated family-member IDs in one proposal. Evidence: `health-quotation-case.service.ts`, `health-quotation-case.service.spec.ts`. |
| CRM-HEALTH-003 | High | Source remediation implemented; payment unit tests pass; concurrency and database verification pending | Payment-record and quotation workflow writes now share a transaction; the selected quote is re-read under company/case scope. Verified payments cannot be downgraded or replaced, and in-process evidence cannot be silently replaced. Evidence: `health-quotation-case.service.ts`, `health-quotation-case.service.spec.ts`. |
| CRM-PII-001 | Critical | Health case and standard quotation response masking implemented; focused tests pass; broader response audit pending | Health case contact/snapshot/quote KYC values and standard quotation contact/calculation metadata are masked. Health case updates no longer copy PAN/Aadhaar into quote metadata. Existing metadata is not database-cleaned by this code change, and other CRM, export, log, User 360, insurer, and document paths still require audit. Evidence: `health-quotation-case.service.ts`, `quotation.mapper.ts`, related specs. |
| CRM-PII-002 | Critical | Open; plaintext persistence remains | Contact and Customer are still persisted with PAN/Aadhaar in plaintext. This slice masks standard responses and avoids new Health quote metadata copies, but does not migrate stored values to authenticated ciphertext, add keyed lookup hashes, or remove historical duplicate values. Encryption, lookup, migration, and reveal authorization/audit need a cross-module rollout. |
| CRM-IDENTITY-001 | High | Confirmed missing capability | No external identifier registry, namespace, verification state, or resolver exists. Current agent identifiers are internal `Agent.agentCode` / `User.employeeCode`, while `Contact.agentCode` is a denormalized string. This cannot safely resolve partner/insurer codes or support the same code in separate namespaces. |
| CRM-RELEASE-001 | Critical | Confirmed | The production certification guard fails because the certified commit/schema do not match this checkout. The checked-in `PRODUCTION_READY` label is not valid evidence for current HEAD. |

Additional questions remain open: full route-to-requirement traceability; per-module API and UI verification; source-data reconciliation; status-transition and transaction coverage; dependency advisories; migration drift; job/queue and insurer integration behavior; and performance against documented targets.

## 4. Next audit and remediation gates

1. Complete the current-branch security and business-flow re-audit, keeping the findings above open until tests or staging evidence verify them.
2. Record the shared identity, case ownership, PII, and payment decisions in `docs/audit/UNIFIED_MASTER_ARCHITECTURE_DECISIONS.md` before source changes.
3. Continue the cross-module PII audit and add permission-checked KYC reveal/audit behavior; verify Health ownership, family-member validation, and atomic payment behavior against an isolated database.
4. Add the external identifier registry and attribution history against the existing `Agent` entity; do not replace shared CRM entities.
5. Extend the existing User 360 path for Agent 360 and reconcile the existing BI module boundaries before adding reporting surfaces.
6. Re-run current checks in a CI or staging environment with isolated PostgreSQL/Redis, then complete independent re-audit and release certification.

The source remediation slice adds the Health case Agent relation and additive backfill migration, ownership guards, family-member checks, payment transaction/state protections, and PII masking with focused regression tests. No production data was read or changed. Database migration status, live workflow behavior, broader PII coverage, and production readiness remain unverified.
