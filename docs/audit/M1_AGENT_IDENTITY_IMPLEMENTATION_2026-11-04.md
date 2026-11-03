# M1–M3 Agent Identity Implementation Checkpoint

**Date:** 2026-11-04
**Repository:** `UroojAKI/JEST-TECH-`
**Branch:** `feature/health-insurance-crm`
**Base HEAD:** `d8fce7a9937a5a1ca980c968c6a17a104f4c168e`

## Gate summary

| Milestone | Status | Evidence and remaining work |
|---|---|---|
| M1 — Identity schema and APIs | **Implemented; DB verification blocked** | Additive external-code registry, tenant-scoped resolver, registration/verification/history routes, append-only audit history, and Admin User 360 External IDs panel. Prisma schema validates and Client generates. The migration has not been applied because no PostgreSQL staging/test database is configured. |
| M2 — Registration and attribution | **Implemented; runtime reconciliation blocked** | Contact, customer, lead, quotation, policy, and claim write paths now preserve canonical `Agent.id` and applicable external-code references. Direct and automated lead assignment write canonical attribution/history. Unit tests cover the changed paths; persisted end-to-end journeys need staging DB. |
| M3 — Historical reconciliation | **Dry-run tool implemented; data mapping blocked** | Read-only profiler inventories internal candidates from Contact and legacy MotorQuotation codes and marks mappings as non-automatic. The authoritative client catalogue and a database snapshot are unavailable, so no historical values were mapped or backfilled. |

## Implemented changes

### Identity model and controls

- Added `AgentExternalCode`, verification/status/history enums, and append-only `AgentExternalCodeHistory` and `AgentAssignmentHistory` models.
- External values retain case and punctuation; code-system keys are normalized to uppercase. Uniqueness is company + namespace + normalized value, and inactive identifiers remain reserved.
- Added nullable code references to Contact, Customer, Lead, Health quotation case, shared Quotation, Policy, Claim, and legacy MotorQuotation. Existing internal Agent foreign keys remain canonical.
- Added company-scoped resolution and management APIs in `AgentsController`:
  - `GET /agents/external-codes/resolve`
  - `POST /agents/:id/external-codes`
  - `GET /agents/:id/external-codes`
  - `PATCH /agents/:id/external-codes/:codeId`
  - `POST /agents/:id/external-codes/:codeId/deactivate`
  - `POST /agents/:id/external-codes/:codeId/reactivate`
  - `GET /agents/:id/external-codes/:codeId/history`
- Registration defaults to pending verification. Only Admin can verify or reject; Admin and Back Office can otherwise manage identifiers. Agents can access only their own identifiers.
- Contact/customer assignment history records old and new Agent/code IDs with actor, reason, and correlation ID. Agent and assignment history tables reject database-level update/delete operations.

### Attribution path

- Contact and Customer registration resolve an explicit namespace/code pair and store canonical Agent identity separately from the creator/actor.
- Lead creation and direct, round-robin, bulk, queue-routing, and PATCH reassignment paths carry canonical Agent identity. A lead's external-code reference is retained only when it belongs to the assigned Agent.
- Shared Health, Motor, and general quotations preserve Agent attribution from explicit input or verified lead/contact context. Policy issuance and proposal conversion carry the quote's Agent and code reference forward; claim reporting carries them from Policy.
- Customer reassignment updates the current Customer and Contact owner together while historical quote/policy attribution remains on those records.
- Added Agent-code management to `/admin/users/[id]`; Contact and Customer forms now support internal Agent selection or explicit external code + namespace resolution before submission.

### Historical profiling

Read-only command:

```text
pnpm --filter api exec tsx prisma/profile-agent-identifiers.ts [--out report.json]
```

The script groups legacy Contact and MotorQuotation identifier strings by company and compares them with internal Agent, employee, and User identifiers. It emits candidates and ambiguity classifications with `automaticMapping: false`. It performs no writes, and `--out` refuses to overwrite an existing report.

## Verification

| Check | Result |
|---|---|
| Prisma format, validate, and client generation | Passed |
| API production build | Passed |
| Web TypeScript (`tsc --noEmit`) | Passed |
| Focused API suites | 11 suites, 110 tests passed |
| Web Vitest suite | 16 files, 104 tests passed |
| API full Jest suite | 139 suites passed, 2 failed, 1 skipped; 1,187 tests passed, 9 failed, 1 skipped. All 9 failures are `connect EACCES 127.0.0.1` in the existing health and metrics HTTP socket suites, matching the M0 baseline environment failure. |
| Web production build | Blocked by Windows `EPERM` creating `apps/web/.next/server/app/api`; this matches the environment limitation recorded at M0. |
| Database migration and end-to-end journey | Not run: no staging/test PostgreSQL connection is configured and Docker is unavailable. |

## Remaining before the next gate

1. Apply the migration to staging and a disposable test database; verify indexes, foreign keys, immutable-history triggers, and rollback behavior.
2. Obtain the client's authoritative code catalogue and normalization rules; run the profiler against a database snapshot and review missing, duplicate, ambiguous, inactive, and unmatched rows. No inferred backfill is safe without those inputs.
3. Reconcile production/staging row counts for Health, Motor, proposal, policy, and claim attribution, including records created before this change.
4. Resolve the web production-build `EPERM` environment issue and rerun the build.
5. M4–M5 Agent 360 and subsequent BI/Action Centre work are not included in this checkpoint. The implementation plan requires review of M1–M3 before that gate; no Agent 360 or BI scope has been started here.

**Checkpoint:** M1–M3 source work is ready for review, with database validation and historical mapping explicitly outstanding. No migration has been applied, no backfill has run, and no commit or push has been made.
