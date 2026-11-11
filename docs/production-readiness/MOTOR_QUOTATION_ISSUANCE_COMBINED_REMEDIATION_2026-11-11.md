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
