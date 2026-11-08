# JEST Policy CRM — Renewal, Multi-Quotation and Back-Office Workflow Remediation

**Date:** 2026-11-09  
**Status:** In progress — implementation branch only  
**Branch:** `ai/health-crm-production-remediation-2026-11-08`  
**Base:** `feature/health-insurance-crm`  
**PR:** #19 (draft; not merged)

## 1. Confirmed product decisions

- Support multiple insurer quotations for one customer requirement / renewal case.
- Capture customer, risk, vehicle/member and previous-policy details once; reuse the saved case snapshot for alternative insurer quotes.
- Comparing existing quotations is a read-only operation and must not create a quotation.
- The agent explicitly selects one quotation and submits only that selected quotation to back office.
- Keep the existing approval engine; provide renewal-specific context and gates.
- Allow expired policies into a lapse-aware renewal pathway. Never represent expired coverage as active or backdate coverage without authoritative insurer evidence.
- Initial scope: all supported insurance product categories, with product-specific data/eligibility rules.

## 2. Findings confirmed from current repository inspection

### QF-01 — Alternative quote wizard does not hydrate clone data

`MotorQuoteWizard` accepts `cloneQuoteData`, but prior to this remediation it only used the case ID when saving. It did not hydrate proposer, vehicle, previous-policy or policy-specific form state. The Motor Quotations workspace's “Compare With Another Plan” action therefore reopened a mostly blank wizard, requiring the agent to re-enter information.

### QF-02 — Existing data model already supports multiple motor quotes per case

`MotorQuotationCase` has a one-to-many `quotations` relation and a `selectedQuoteId`. `HealthQuotationCase` has the equivalent case-to-quotes relationship and selected quote field. This is the intended foundation: one case, multiple insurer quotation records, one selected quote for progression.

### QF-03 — Comparison page uses hardcoded demonstration input

`apps/web/src/app/sales/quotations/compare/page.tsx` invokes `/quotations/enterprise-compare` with hardcoded vehicle price, registration year, engine capacity, NCB and add-ons. This is not a comparison of the customer's saved quotations. It can produce a fresh calculation matrix unrelated to saved quotation records.

The canonical `POST /quotations/compare` endpoint already accepts saved quotation IDs and is read-only. The comparison UX must be migrated to select and compare existing quote IDs. This remains a follow-up implementation item.

### QF-04 — Back-office queue automatically includes unsubmitted quotations

`BackOfficeQueueService` originally included DRAFT, PENDING_APPROVAL, APPROVED and ACCEPTED quotations, plus selected issuance workflow states. This means quotations that an agent is still comparing can appear in back office before the agent has chosen one.

### QF-05 — Renewal drawer bypasses quotation and approval

`RenewalWizardDrawer` had a final action that called the direct `renewPolicy` operation, extending the existing policy expiry and creating a renewal history row using the existing premium. This bypasses insurer comparison, selected quote, approval, insurer submission and verified issuance. It also conflicts with the intended policy-lineage model.

### QF-06 — Direct renewal command rejects expired policies

`RenewPolicyService` accepts only ACTIVE and PENDING_RENEWAL statuses and rejects expired/lapsed policies. The redesigned quotation-based renewal path must handle expired policies using product- and insurer-specific lapse checks. The legacy direct-renewal service should not be used as a shortcut for the new renewal lifecycle.

### QF-07 — Existing submission conflict requires trace-level diagnosis

The reported UI message “A conflicting update or submission is already registered for this record” with trace ID `78b0634c-c612-454b-a13f-4ca035fd49e` has not yet been traced to its originating server request/transaction. Do not remove optimistic concurrency or conflict protection. Determine whether the event is a duplicate request, stale version, race, idempotency collision or partial-success retry.

## 3. Changes pushed in this remediation increment

1. Added nullable `backOfficeSubmittedAt` and `backOfficeSubmittedById` fields to Quotation.
2. Added migration `20261109100000_explicit_backoffice_submission` and an index on company/submission time.
3. Added `POST /quotations/:id/submit-to-back-office`.
   - Reuses canonical quotation authorization.
   - Requires company context and an insurer name.
   - Rejects rejected, expired and converted quotations.
   - Requires the quotation to be the selected quote on its motor/health case.
   - Checks quotation completion before handoff.
   - Uses conditional update to avoid duplicate handoff.
   - Writes a quotation history event.
4. Back-office queue now filters to explicitly submitted quotations, including its fallback query. A quotation that exists or is merely a draft no longer enters the queue automatically.
5. Exposed `caseId` and `backOfficeSubmittedAt` in quotation response mapping.
6. Added the web repository method and a “Select & Send to Back Office” action on motor quote cards. Successful handoff refreshes the workspace and marks the card as sent.
7. The Motor Quotations workspace passes the existing case ID and saved context into the alternative-quote wizard.
8. `MotorQuoteWizard` now hydrates proposer, vehicle, previous-policy and applicable policy form state from `cloneQuoteData`; insurer selection and insurer-specific calculation remain a fresh decision.
9. The renewal drawer's final action now routes into the comparative renewal quotation journey instead of directly extending the existing policy. Removed obsolete direct-issuance state from the drawer.
10. Replaced the hardcoded demonstration comparison screen with a saved-quotation picker. It calls the read-only compare endpoint with existing quotation IDs and renders the returned saved quotations; no quotation is created by comparing.
11. Backend comparison now rejects mixed customer/case contexts: case-backed quotations must belong to the same MotorQuotationCase or HealthQuotationCase; non-case quotations must share contact and product category.
12. Added explicit handoff UI for the selected health quotation in HealthCaseWorkspace.
13. Motor workspace mapping now preserves case ID, previous-policy details and handoff state so the alternative quote flow can hydrate the existing case.

## 4. Intended user journeys

### 4.1 Multiple insurer quotations

1. Agent opens an existing lead/customer/policy or starts a new case.
2. Agent completes customer and risk information once.
3. The system persists or resolves one case.
4. Agent chooses an eligible insurer and generates a quotation.
5. Agent selects “Compare With Another Plan”.
6. The wizard reopens with saved case information prefilled; agent selects a different insurer.
7. A second quotation is created under the same case. No new customer or renewal case is created.
8. Repeat for additional insurers.
9. Agent compares already-generated quotation IDs using the read-only comparison endpoint.
10. Agent selects one quote for progression.

### 4.2 Back-office handoff

1. All alternatives remain visible to the sales agent.
2. Agent chooses the quote to progress.
3. Backend verifies tenant ownership, insurer binding, case selection and completion.
4. Backend records one explicit handoff.
5. Only that quotation appears in the back-office workbench.
6. Back office continues the existing review/approval/issuance flow.
7. Other insurer alternatives remain in the agent workspace and are not automatically sent to back office.

### 4.3 Renewal

1. Agent opens an existing policy and chooses Renew.
2. The drawer routes to the quotation-based renewal workspace.
3. Previous policy details are fetched and prefilled.
4. Expired/lapsed policies are identified explicitly.
5. Product-specific renewal eligibility and insurer checks run.
6. Multiple insurer quotes are generated under the renewal case.
7. One quotation is selected and submitted to existing approval.
8. Existing approval and insurer submission/issuance steps continue.
9. New issued policy links to the predecessor. The old policy is not overwritten.

## 5. Required remaining work

### P0 — Complete multi-quotation experience

- Replace the hardcoded comparison page with saved quotation selection and read-only comparison using `POST /quotations/compare`.
- Verify all motor alternative quotes share the same `MotorQuotationCase`.
- Ensure all saved form fields, including previous policy and product-specific form state, are hydrated and revalidated.
- Verify case-level `selectedQuoteId` updates atomically and invalidates old approval when selection changes.
- Add equivalent multi-quote reuse and selection UX for health.
- Define equivalent case-level grouping for life and other supported products; do not assume every product has an existing case model.

### P0 — Back-office workflow across products

- Add explicit handoff UI to health and other product quotation workspaces.
- Confirm the existing approval queue consumes only explicitly submitted work.
- Verify back-office users can see submitted quotations, while agents retain unsubmitted alternatives.
- Verify approval, return-for-correction and rejection state transitions.
- Verify direct issue endpoint cannot be used to bypass approval or handoff.

### P0 — Renewal domain completion

- Inspect and implement a persistent renewal case for all supported product categories, reusing existing MotorQuotationCase/HealthQuotationCase where appropriate.
- Link renewal case to previous policy and new policy lineage.
- Ensure expiry/lapse rules are product- and insurer-specific.
- Remove/retire unsafe direct expiry-extension paths from user-facing workflows; preserve compatibility only where explicitly required and guarded.
- Implement renewal case resume, duplicate-cycle protection and historical snapshots.
- Ensure policy prefill works for motor, health, life and configured other products.

### P0 — Concurrency / idempotency

- Trace `78b0634c-c612-454b-a13f-4ca035fd49e` through structured logs.
- Identify request endpoint, record ID, transaction and conflicting version.
- Add idempotency keys to submission and insurer punching where absent.
- Ensure same retry returns the original operation result.
- Ensure stale updates return actionable conflict responses.
- Add concurrent browser/session tests.

### P1 — Reporting and automation

- Renewal pipeline dashboards.
- Agent-owned drafts and alternatives.
- Submitted-to-back-office queue.
- Pending approvals and returned work.
- Failed insurer submissions and reconciliation.
- Renewal reminders and communication history.

## 6. Acceptance criteria

- [ ] Customer and risk details entered once per case.
- [ ] Alternative insurer quotation reopens with saved details prefilled.
- [ ] All alternatives share the same case ID.
- [ ] Generating a comparison does not create or mutate a quotation.
- [ ] Comparison uses existing saved quotation IDs.
- [ ] Each quotation has its own insurer and independent premium calculation.
- [ ] Only the explicitly selected quotation can be handed off.
- [ ] Unsubmitted quotations do not appear in back-office queue.
- [ ] Duplicate handoff does not create duplicate work.
- [ ] Existing approval engine remains authoritative.
- [ ] Material changes invalidate prior approval.
- [ ] Expired policies enter a lapse-aware path, not an active-coverage shortcut.
- [ ] New policy retains predecessor lineage.
- [ ] Same behaviour is verified for motor, health, life and other supported products.
- [ ] Tenant isolation, authorization and document controls pass.
- [ ] End-to-end and concurrency tests pass on the exact PR head.

## 7. Release status

**Not production-ready.** The code changes listed in Section 3 are pushed to the remediation branch, but they have not yet been proven by a successful CI run or complete end-to-end tests. The comparison page, health/other product handoff UX, all-product renewal domain, expiry/lapse rules, policy lineage and conflict trace investigation remain open. Do not merge or deploy until the acceptance criteria pass.
