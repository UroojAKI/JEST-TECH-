# Motor Quotation, Comparison, Back-Office and Policy History — Combined Remediation Plan

**Date:** 2026-11-11  
**Base:** main (2ccebdc5763799f7c3cf67458188c3d5912a77fe)  
**Branch:** `fix/motor-quotation-issuance-workflow-2026-11-11`  
**Status:** Audit confirmed; implementation and runtime verification pending  
**Release posture:** Do not merge/deploy until acceptance tests and legacy-data reconciliation pass.

## 1. Product workflow decisions

1. One customer/risk capture creates or resumes one durable MotorQuotationCase.
2. The case snapshot is the reusable source of proposer, contact, vehicle, previous-policy and selected policy-form inputs.
3. Each insurer alternative is a separate Quotation under the same case, with its own insurer identity, rating inputs, calculation snapshot/version, premium breakdown, documents and status.
4. An alternative quote starts from the saved case snapshot; only insurer-specific fields and genuinely insurer-specific questions need fresh input.
5. Comparison is read-only and accepts only existing quotation IDs from the same case/customer/product context. It must never calculate a new quote or create a Quotation.
6. Render the Motor Quotations workspace as a dense, accessible line/table view grouped by case/customer, not a grid of quote cards. Keep quote actions on each row.
7. Sales explicitly selects one winning quote at case level. Only that selected quote may be submitted to Back Office. Unselected alternatives remain visible to Sales and are excluded from Back Office queues.
8. The existing approval and issuance workflow remains authoritative. Submission, approval, insurer punching/submission, insurer acknowledgement and verified policy issuance are distinct states.
9. A policy is issued from the selected saved quotation snapshot. The policy must preserve the selected insurer, premium components, IDV, add-ons, OD/TP dates, tenure, calculation version, documents and predecessor-policy lineage.
10. Existing issued policies and their history must remain visible. Renewal creates a new policy linked to the predecessor; it must not overwrite the old policy or manufacture historical records.

## 2. Confirmed repository findings on main

### MTR-Q-01 — Insurer is not truly mandatory in the Motor wizard (confirmed)
`apps/web/src/components/leads/motor-quote/MotorQuoteWizard.tsx` sends:
`insurerName: insurerName || 'Partner Insurer'`.
The DTO has `@IsString()` but no non-empty/trimmed validation. This can create a quote against a placeholder rather than a selected insurer. The UI and API must both reject missing, blank, placeholder and inactive/unmapped insurer values. The API must resolve the insurer against the tenant's active insurer catalogue; a client-supplied display name alone must not establish insurer authority.

### MTR-Q-02 — Alternative-quote hydration exists but is duplicated / incomplete (confirmed)
The wizard has two clone hydration effects. They repeat field assignments and are vulnerable to stale state when the same modal is reused for another case/quote. The alternative flow must hydrate once from the authoritative saved case, reset transient calculation/inspection/agent state, retain the case ID, and require a fresh insurer selection and calculation. Do not blindly copy a previous insurer's calculated premium into a new insurer's quote.

### MTR-Q-03 — Current workspace is card/grid based (confirmed)
`apps/web/src/components/sales/MotorQuotationsWorkspace.tsx` groups quotes but renders each group in a responsive grid of `QuoteCard` components. Replace the presentation with a compact row/table view with customer/vehicle/case context, insurer, quote number, policy form, IDV, OD, TP, GST, total premium, status, created time and row actions. Preserve responsive mobile behaviour and accessible controls.

### MTR-Q-04 — Placeholder insurer also appears in quote list mapping (confirmed)
Workspace mappings use `'Partner Insurer'` as a fallback. Historical records with no insurer should be shown as **Insurer missing / data-quality exception**, not represented as a real insurer. Such quotes must be blocked from selection/handoff/issuance until corrected from an authoritative source.

### MTR-Q-05 — Explicit Back Office handoff needs end-to-end enforcement (partially implemented)
The repository has explicit submit-to-back-office metadata/endpoint and row/card handoff logic in the remediation work. Verify on current main that selection is persisted atomically, only the selected quote is submitted, duplicate submissions are idempotent, the queue filters strictly by explicit submission, and changing the selected quote invalidates prior submission/approval. Do not rely on frontend filtering.

### MTR-Q-06 — Quotation-to-policy mapping needs a field-level contract (partially implemented)
Motor issuance reads the saved quotation and calculation snapshot and writes several fields to Policy, but this audit has not yet proved that every policy-form field and insurer-specific value is mapped correctly. Define and test a mapping contract for insurer, quote ID, customer/contact, vehicle, policy type, IDV, premium components, GST, NCB, add-ons, OD/TP dates, tenure, nominee, POS attribution, documents and renewal predecessor. No silent fallbacks to default insurer, default dates or stale client values.

### MTR-Q-07 — Historical policy/issuance data visibility is unresolved (requires data + API audit)
The Policy repository's relation graph includes quotation, documents, renewals, payments, histories and insurer details. That alone does not prove the UI's policy register includes legacy records. Trace the entire path: database rows and migrations/imports -> tenant-scoped policy list query -> filters/statuses/soft-delete -> response mapping/pagination -> frontend policy register and detail/history tabs. Determine whether records are absent from the database, excluded by joins/filters, hidden by pagination/status tabs, or not mapped/rendered. Do not invent or re-create issued policies. If legacy source data exists outside the current Policy table, prepare a dry-run, idempotent import/reconciliation with source IDs, duplicate detection, audit trail and rollback.

### MTR-Q-08 — Current legacy renewal and prior remediation issues remain in scope
Carry forward the renewal design requirements: case reuse, predecessor validation, lapse-aware expiry handling, approval invalidation, insurer-specific eligibility, idempotency/concurrency, trace ID `78b0634c-c612-454b-a13f-4ca035fd49e` investigation, cross-tenant isolation and all previously reported JEST Policy CRM production findings. Do not assume an earlier PR description proves runtime behaviour.

## 2A. Additional findings from the 2026-11-11 runtime screenshots

The supplied screenshots show two different application surfaces:

- Sales > Motor Quotations: `Active Quotes (20)`; the visible customer/vehicle group `test test | KA00AA0000` has two saved quotation records. One displays `Partner Insurer`, demonstrating that placeholder-insurer records already exist in stored data. These records must be preserved and flagged for correction; do not rewrite their insurer identity without source evidence.
- Operations > Policy Issuance: the visible queue contains three Motor cases. This is a Back Office work queue, not a complete archive of every historical policy or every Sales quotation.

Source inspection explains part of the difference:
- `BackOfficeQueueService.getBackOfficeQueue` includes only quotations where `backOfficeSubmittedAt IS NOT NULL`. A saved Sales quotation is intentionally absent until explicitly submitted.
- The queue's primary query then considers a limited set of statuses and computes payment, inspection, customer and document gates. A draft test quotation cannot be issued merely because it appears in Sales.
- `MotorQuotationsWorkspace` requests `GET /quotations?productType=MOTOR&page=...&limit=...`; it has page controls (10/20/50/100). Older quotations may be on later pages or excluded by tenant scope/productType. The screenshot's 20 is the currently loaded result total, not proof that all legacy Motor data has been imported.
- `GetPolicyService.executeAll` returns only rows from the canonical `Policy` table under `ScopeResolver` scope and pagination. It does not automatically union legacy `MotorQuotation` records into the Policy register.
- Both `BackOfficeQueueService` and the `GET /back-office/queue` controller originally caught broad errors and returned an empty queue shape. This could make an API/query failure look like "there are no records". The draft now propagates queue query failures as a 500 response instead of reporting a false empty queue. The Sales Motor quotation query also now rethrows fetch errors so React Query can render its existing error/retry state rather than a false empty register.
- Queue summary counters are computed across the fetched submitted quotations before some display filters, while the cards' motor/health counts are computed from the filtered in-memory queue. Keep summary definitions consistent and label counts accurately.

### Required separation of datasets and views

1. **Sales quotations:** every accessible quotation, including draft/alternative versions, paginated and grouped by customer + vehicle + case.
2. **Back Office pending handoffs:** only the explicitly selected and submitted quotation per case, with gates and approval state.
3. **Issued policy register:** canonical issued policies and their policy documents/history.
4. **Legacy issuance archive / reconciliation:** historical source records not yet represented as canonical Policy rows. Read-only until reconciled; never mix them into the live issue queue or allow issue actions on archive-only rows.

A new quotation should be visible immediately in Sales after a successful save and refetch. It should appear in Back Office only after the agent explicitly selects and submits it and it meets the queue's lifecycle rules. A test/draft quote must not be silently promoted into an issue-ready item.

### Additional confirmed defects / investigations

- The queue catches database/query exceptions and returns `data: []`; frontend can interpret a service outage as a genuinely empty queue. Add structured error logging, request correlation and a visible retry/error state.
- The queue query has no pagination in the inspected implementation; large historical backlogs can become expensive and may be truncated at API/database limits. Add server-side pagination and stable ordering.
- The quotation list UI has pagination, but its request's `total` and loaded row counts need regression coverage across pages, filters, tenant scopes and legacy source types.
- Investigate old policy rows that are soft-deleted, tenant-owned under a previous company mapping, absent from `Policy`, or retained only in `MotorQuotation` / other legacy tables. Distinguish "not imported", "filtered", "deleted", "unlinked" and "not visible" in the reconciliation report.

## 3. Implementation workstreams

### P0-A — Canonical Motor case and alternative quote lifecycle
- Resolve/create the case once and persist complete snapshots.
- Make all alternative insurer quotes reference the same case and source policy where renewal applies.
- Consolidate clone hydration into one reset-safe effect or an explicit case-loading function.
- On modal open, load the latest case snapshot from the API; avoid trusting stale props as the sole source.
- Require active insurer selection before calculation and before save.
- Validate insurer ID, company ownership, active status and supported product mapping server-side.
- Keep each insurer calculation independently versioned and immutable once saved.
- Prevent duplicate alternative creation from retries using an idempotency key scoped to case + insurer + request intent.

### P0-B — Saved quotation comparison
- Remove any demonstration/fresh-calculation compare flow.
- Fetch selectable quotations for the current case.
- Compare existing quote IDs via the read-only comparison endpoint.
- Ensure no POST create/calculate endpoint is invoked by comparison.
- Show insurer, quote reference, total, OD, TP, GST, IDV, add-ons, tenure, dates, exclusions/notes, quote validity and status.
- Clearly distinguish unavailable fields from zero values.

### P0-C — Line-view Motor workspace
- Replace quote-card grid with a grouped, sortable table/line view.
- Group by case/customer/vehicle; show all insurer alternatives as rows.
- Keep one row per saved quote and a visible selected marker.
- Provide row actions: View, Compare, Select, Send selected to Back Office, Documents, Proposal/issuance status.
- Do not show issue/submit actions for unselected alternatives.
- Keep filters, pagination, search and responsive mobile row expansion.

### P0-D — Single-quote Back Office handoff
- Agent selects exactly one quote for a case.
- Server performs compare-and-set on case.selectedQuoteId.
- Selection change clears or invalidates prior approval/handoff and records an audit event.
- Handoff endpoint verifies tenant, case, selected quote, insurer mapping, completion gates and current version.
- Create exactly one BackOfficeTask with a stable idempotency key.
- Queue query includes only explicitly submitted, selected quotations.
- Unselected alternatives remain in Sales; Back Office cannot issue them by direct URL/API.
- Keep existing approval workflow and role permissions authoritative.

### P0-E — Issuance mapping and lifecycle
- Create a field-by-field quotation-to-policy mapping contract.
- Ensure selected quote ID and selected quote version are pinned at approval/handoff.
- Revalidate quote version, insurer, calculation snapshot, payment, documents, approval and policy dates at issuance.
- Persist insurer and full premium/coverage snapshots on Policy and policy history.
- Preserve OD/TP-specific dates and tenure for PACKAGE, SAOD and TP_ONLY.
- Distinguish insurer punch request, accepted/acknowledged, rejected/needs-correction and final policy document received/verified.
- Do not mark policy active/issued merely because a request was sent to an insurer.
- Add idempotency and concurrency tests to prevent duplicate punching and duplicate policy rows.

### P0-F — Historical policy/issuance recovery
- Audit production schema/data counts by tenant, product, status and date, plus soft-deleted records.
- Reconcile Policy, Quotation, legacy MotorQuotation, policy documents, PolicyHistory, PolicyRenewal and any legacy import tables.
- Inspect list API filters, joins, tenant scoping, pagination, default date ranges and frontend rendering.
- Produce a dry-run reconciliation report: source record, target policy, duplicate/conflict classification, missing fields and proposed action.
- Only after owner approval, run an idempotent, transactional migration/import with immutable source references and audit logs.
- Verify totals and sample records against source-of-truth exports. Never fabricate policy numbers, issue dates, insurer details or premiums.

### P0-G — Carry-forward production remediation
- Verify all previously reported tenant/BI scope, RBAC, payment permissions, notifications, audit exports, migrations, renewal/lapse and trace-ID defects.
- Add tenant isolation, API contract, regression, browser journey, concurrency and data migration tests.
- Keep unresolved external configuration/operations (email provider, PII backfill, storage recovery, DR/load) as release blockers, not code-complete claims.

## 4. Required acceptance tests

1. Create a Motor case once; save insurer A quote; add insurer B and C without re-entering customer/vehicle/previous-policy details.
2. Verify all quote rows have the same case ID and independent insurer IDs/calculation snapshots.
3. Attempt save with no insurer, whitespace insurer, placeholder insurer, inactive insurer and cross-tenant insurer; every attempt must fail server-side.
4. Compare two or more saved quotes; database quotation count and all quote rows remain unchanged.
5. Verify compare rejects quotes from different cases/customers/vehicle/product contexts.
6. Select quote B; submit to Back Office; exactly quote B appears in the queue and A/C do not.
7. Retry handoff concurrently; exactly one task exists and the same operation result is returned.
8. Change selection after handoff/approval; previous approval and handoff are invalidated/revoked safely and audit history explains why.
9. Attempt to issue an unselected quote directly through API; server rejects it.
10. Issue selected quote; assert insurer, customer, vehicle, IDV, OD/TP, GST, total, add-ons, dates, tenure, document and source quote snapshots match.
11. Verify policy status changes only after verified issuance, not on insurer submission/acknowledgement.
12. Verify Motor policy list shows legacy and newly issued policies across permitted statuses, with pagination and filters.
13. Compare production/source record counts and sample historical policy data before and after any approved import.
14. Verify renewal creates a new policy linked to the old policy; old policy values/history remain unchanged.
15. Run role, tenant, approval, document, duplicate issuance, idempotency, concurrency and E2E tests on exact PR head.

## 5. Delivery sequence

1. Complete Phase 0 source/data/API audit and publish evidence for historical policy visibility.
2. Fix mandatory insurer validation and canonical case hydration.
3. Complete saved quote comparison and line-view workspace.
4. Complete selected-only Back Office handoff and approval invalidation.
5. Complete quotation-to-policy mapping and insurer punching lifecycle.
6. Complete historical data reconciliation only after source-of-truth and backup approval.
7. Run CI, browser E2E, concurrency, tenant-isolation and production-like data tests.
8. Submit a draft PR with findings, migration plan, evidence and unresolved operational dependencies. Merge only after explicit review and acceptance.

## 6. Scope boundary and safety

- This branch starts from current `main`; no production database has been accessed by this audit.
- Historical-data absence cannot be conclusively diagnosed from source code alone.
- Do not run destructive migrations, bulk updates or production backfills from this workstream without backup, dry-run output and explicit approval.
- Do not mark this work production-ready based on TypeScript/build success alone.

## 4. User-approved implementation order and current branch state

| Priority | Workstream | Completion requirement | Draft branch status |
|---|---|---|---|
| P0 | Insurer validation | Only active Insurer Master records can receive quotations | Implemented in draft: UI uses active DB insurer list only; API resolves exact active insurer and stores insurerId |
| P0 | Case reuse | Enter customer and vehicle details once | Implemented in draft: server reuses persisted case snapshots for alternatives and rejects customer/registration drift |
| P0 | Alternative quotations | Multiple insurer quotes under one case | Partially implemented: case-linked quote creation is reused; same-case duplicate vehicle block bypassed; insurer-specific rating adapter still needs proof |
| P0 | Comparison | Read-only comparison of saved quotes | Existing saved-quote compare path retained; tenant scope tightened; requires 2–10 distinct saved IDs and same case/customer/product context |
| P0 | Line-view workspace | Replace quote cards with table rows | Implemented in draft UI: insurer/quote, cover, IDV, NCB, premium, status, date and workflow actions |
| P0 | Selected-only handoff | Only one selected quote enters Back Office | Existing selected-case handoff retained; backend issuance now requires selected quote; queue remains explicitly handoff-only; E2E concurrency tests pending |
| P0 | Issuance mapping | Quotation data correctly appears in issued policy | Partial: insurer snapshot and renewal lineage are persisted; full field-by-field mapping audit and policy schedule verification remain |
| P0 | Historical records | Recover visibility and reconcile legacy records | Read-only reconciliation script and runbook added; production execution blocked pending approved read-only DB access |
| P1 | Insurer punching | Submission, acknowledgement, rejection and verified issuance are distinct | Not complete; insurer integration adapter and state machine required |
| P1 | Renewal lifecycle | Preserve previous policy, lapse checks and renewal lineage | Partial; source-policy and lineage checks exist; insurer-specific eligibility and lapse edge cases remain |
| P1 | Regression/security | Tenant isolation, concurrency, permissions and E2E verification | Partial; comparison tenant check and refresh-token CAS tests added; full CI/runtime suite pending |

## 5. Production log findings supplied on 2026-11-11

### AUTH-REFRESH-01 — Prisma array transaction failure

The supplied `POST /api/v1/auth/refresh` error reports that an element passed to Prisma's array-form `$transaction([...])` was not a Prisma Client promise. Both refresh-token replay revocation and normal token rotation were changed in this draft to interactive callback transactions. Normal rotation uses a conditional update on `revokedAt IS NULL` and an unexpired token, then creates the replacement token in the same transaction. A concurrent loser receives an Unauthorized response instead of issuing a second token.

A focused unit test was added for normal rotation and the compare-and-set concurrency loser. Exact-head API CI and a live concurrent-refresh test are still required.

### RATE-LIMIT-01 — 429 lacks route attribution

The supplied throttler stack trace does not include the rejected HTTP method/path, correlation ID, user, or throttle bucket. The visible successful workflow-projection GET is not evidence that it caused the 429. This draft adds structured, credential-safe rate-limit diagnostics to `CustomThrottlerGuard`, including correlation ID, route path, authenticated user/tenant, role, limit, TTL and retry interval. It does not loosen limits or exempt routes. Capture a fresh occurrence after deployment before changing thresholds.

### AUTH-REFRESH-02 — request correlation

Preserve correlation ID `6e1fca82-956d-479c-8640-8cabc9a6e9a6` in the incident record. The preceding successful request had correlation ID `86fbd102-7be0-452e-8280-4339b764c6ba`. These are separate requests; the first successful projection does not establish a causal relationship with the later refresh failure.

## 6. Validation status

All changes described above are committed to the draft branch only. No production DB connection was available in this session, so the read-only reconciliation script has not been run. GitHub reported no CI status checks or workflow runs for the latest draft head at the time of inspection. Do not merge or deploy until API typecheck/tests, web typecheck/build, Prisma validation, tenant isolation tests, E2E flows and read-only production reconciliation have been completed.

### QUOTE-LIST-COUNT-01 — page length was used as a false total

The inspected `QuotationRepository.findAll` caught a failed COUNT query and substituted `fallbackData.length`. With a page size of 20, this could report a total of 20 even if the database held more records. The fallback has been removed: data and count now execute together, and count failures surface to the Sales list error state. This is a confirmed code defect, not proof that it caused the specific production screenshot; the read-only database report is still needed to establish the real record counts.
