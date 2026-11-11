# JEST Policy CRM — Next-flow and UI remediation status

**Review date:** 12 November 2026  
**Branch:** `feat/mobile-search-payment-functional-ui`  
**Base:** `fix/quotation-workflow-remediation` (PR #25)  
**Review type:** Repository source inspection and GitHub Actions metadata/log review. This is not a live browser or production exploit test.

## Implemented on this branch

1. **Responsive navigation shell**
   - Sidebar opens as a small-screen overlay drawer, closes on backdrop and route selection, and starts closed on mobile.
   - Main workspace uses responsive padding and min-width constraints.
   - Desktop navigation remains in the layout.
2. **Responsive header and search entry**
   - Search is available as an icon action on mobile, with label and keyboard shortcut at larger breakpoints.
3. **Dynamic global-search interaction**
   - 250 ms debounce, React Query cache, input focus on open, Escape/backdrop close, arrow-key navigation and Enter selection.
   - Search errors now have an explicit unavailable message.
   - Search entity coverage remains limited by the backend/repository response mapping; do not assume every entity type is indexed.
4. **Quotation payment discoverability**
   - Added a **Complete Payment** action at the quotation row.
   - It opens the existing Proposal/Payment flow, which posts to `POST /motor/quotations/:id/payment` and uses the backend's authenticated actor/tenant context and payment rules.
   - This does not mark payment complete on click; the server remains authoritative.
5. **Sales task creation**
   - Replaced the sales dashboard's toast-only Add Task action with a form that calls the existing `POST /tasks` API.
6. **Commission bulk approval feedback**
   - The commissions page now awaits the existing bulk-approval API and shows counts from its response rather than reporting success immediately after launching individual requests.
7. **Analytics truthfulness**
   - Sales analytics errors are no longer caught and converted to `null`.
   - Pipeline/renewal cards no longer manufacture zero-valued fallback rows when metrics are absent.
8. **Unmapped Quick Action Controls**
   - Actions without an explicit `href` or route mapping are now disabled instead of showing a false “Workflow initiated” toast.
9. **Read-only numbering screen**
   - Clarified that the screen is read-only in this release; no fake save action is exposed in the current file.

## Verified UI/API gaps still outstanding

| Area | Finding | Current classification | Required follow-up |
|---|---|---|---|
| Global search | Frontend result mapping currently surfaces contacts/customers, leads, policies and claims. The UI placeholder mentions documents, but returned document/proposal entity coverage is not demonstrated by this repository mapping. | Capability gap | Verify backend indexed entity types, then add typed mapping and deep links for supported proposals/documents. |
| Customer notes | Notes themselves are submitted through `customerRepository.addCustomerNote(...)` and reloaded from the customer workspace. An **unsaved note draft** is kept in browser `localStorage` under `customer_note_draft_<customerId>`. | Not a server-persistence defect for saved notes; unsaved drafts are browser-local | Keep this as a documented UX limitation; optionally warn before clearing browser storage or provide explicit draft sync if cross-device drafts are required. |
| Voucher PDF | `VoucherPreviewModal` disables Download PDF and explicitly says PDF export is not available. | Missing capability, honest disabled control | Implement an authorized server-generated voucher PDF, or keep unavailable state until then. |
| Finance receipt issuance | Prior audit reports a hard-coded receipt toast. The current `/finance` page is a wrapper around `FinanceOperationsHub`; the prior literal was not found in the current page source inspected. | Historical finding requires current path verification | Search current FinanceOperationsHub receipt controls and confirm whether any route still exposes a false receipt-success action. |
| Numbering configuration | Current page is read-only and inputs are read-only. This branch clarifies its release status; configuration write API is not implemented here. | Read-only limitation | Add authenticated update API + validation/audit if editable configuration is required. |
| Quick Action Card | When an action has neither `href` nor a mapped route, handler only emits `Workflow initiated` toast. | Confirmed no-op fallback | Remove/disable unmapped actions or add explicit route/API per action. |
| Finance commission page | Bulk approval used parallel individual mutations and an immediate “started” toast although an existing bulk API hook exists. | Remediated on this branch | Test partial failures and response counts in UI. |
| Dashboard Add Task | Previous handler showed “New Task added” without a request. | Remediated on this branch | Browser test create success/failure and assigned-task refresh. |
| Reports export | Current reports page calls export API, receives Blob and triggers browser download for CSV/PDF. Older audit claim that /reports is toast-only is stale for this path. | Current implementation appears wired from source | Browser test actual files, content type, filename and empty/error responses. |
| Mobile/tablet | Main app shell, header and sidebar received responsive changes. Many data grids/tables and modals throughout the 82-screen audit remain candidates for per-screen testing. | Partially remediated, not certified | Run viewport tests at 375, 768, 1024 and 1440 widths and record horizontal overflow/focus/scroll behavior. |

## Claims, renewal and finance lifecycle — still open

### Claims
- Settlement repeat-submission/concurrency remediation is in PR #26; latest current head CI has all four workflows green, including API and web quality jobs.
- Settlement still lacks structured persistence for payment method, UTR/payment reference, bank details, settlement date, and finance verification reference. Storing these only in history comments is insufficient for reconciliation/reporting. A schema, migration, domain service, API DTO, audit and regression suite are still required.
- Claims create permission conflict remains unresolved: `ROLE_SCOPE_MATRIX.md` allows AGENT, while the Claims controller/`ReportClaimService` implementation restricts ADMIN/BACK_OFFICE. Product owner must decide before changing access.
- Re-check the conditional tenant checks in claim creation and policy cancellation against route guards and actor construction; current notes are not a completed exploit verification.
- Audit generic claim PATCH paths against state-machine protections, especially terminal SETTLED/CLOSED claims.

### Renewal and motor underwriting
- Do not use premium fields as IDV fallback. Require a verified IDV source or explicit validated manual IDV with provenance.
- Unify vehicle-age calculation between renewal prefill and renewal quote creation.
- Establish the depreciation schedule from the approved business/insurer rule before changing calculations. Do not infer the intended rule from the current test.
- Add tests for renewal quotation state transitions, duplicate renewal prevention, case/task consistency and tenant isolation.
- Policy endorsements, cancellation and renewal must keep policy status, accounting, document, commission and audit history consistent.

### Commission and finance
- Audit commission accrual and realization APIs to ensure actor and tenant context reaches services and all records derive company from the authenticated context, not caller-controlled IDs.
- Add cross-tenant and role tests for accrual, approval, realization and payout.
- Reconcile commission payouts against payment/settlement/ledger data; test idempotency and partial failures.
- Investigate the Finance receipt issuance control on current source and ensure it either persists a real receipt with authoritative sequence and ledger/payment linkage or is disabled honestly.

### Legacy historical policies — PR #27
- Legacy records must remain independent of standard Policy/Quotation/Payment/Inspection records; do not fabricate any historical transaction or inspection.
- Evidence document + mandatory agent declaration remain required; exemption is attached only to the individual historical policy.
- Future renewals must go through normal eligibility, inspection, quotation, payment and issuance rules.
- Renewal reminders are currently persistence/API visibility, not proof of an outbound notification delivery worker.
- PR #27 CI Quality Gates failed during migration setup: test DB did not contain base `companies` table when migration added FK to it. Migration application failed and API typecheck/tests were skipped. Fix base migration setup/order, then rerun all gates.

## Workflow and review status at time of this report

PR #28 was retargeted to `main` so the repository's `pull_request` CI trigger can validate the complete stack. Its diff therefore includes the quotation remediation commits from PR #25 as well as the UI changes; review it as a combined stack, not as an isolated UI-only diff.

- **PR #25:** open, unmerged, non-draft; GitHub reports `mergeable=false`. It remains the base of this stacked UI branch.
- **PR #26:** open, draft, unmerged; current head `6aab2b12d3e35d6d5e5ad0df9de0861d2d6aaee0`; Production Remediation CI, PR Checks, CodeQL and CI Quality Gates succeeded.
- **PR #27:** open, draft, unmerged; current head `29d961ed090eafb2fdf1c67334d09c42ba826154`; PR Checks, CodeQL and Production Remediation CI succeeded, but CI Quality Gates failed at migration setup, before API typecheck/tests.
- **This UI branch:** changes are committed, but no browser/device test or local build was run by this review. Keep PR draft until CI and viewport testing complete.

## Acceptance tests still needed for this branch

- Open mobile drawer from hamburger; ensure it starts closed, overlays content, closes by backdrop and route selection, and does not shift desktop layout.
- Test tablet/phone header, workspace switcher, command palette, dialogs and horizontal scrolling.
- Search with 1-character, 2-character, slow, rapid, no-result and API-error inputs; test Ctrl/Cmd+K, arrow keys, Enter, Escape, and touch.
- Open Complete Payment from quotation row; verify payment is blocked when underwriting/inspection gates fail, amount mismatches, non-cash reference is absent, or tenant/role is invalid; confirm paid status only after API success.
- Create task and verify it appears in the correct task queue; confirm API errors are not shown as success.
- Bulk approve commissions with all-success, already-processed, partial-failure and state-mismatch responses.
- Confirm analytics endpoint errors render as errors and missing metrics are not shown as false zeroes.

## Audit integrity note

Static matches of `toast.success` or `toast.info` are not by themselves defects. Many are success callbacks after real mutations or informational status messages. Classify a control by tracing its actual click handler, repository/mutation call, backend route, persistence behavior and error handling. This report records only the actionable cases inspected above.
