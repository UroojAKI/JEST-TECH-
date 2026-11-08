# Combined Production Remediation Report — JEST Policy CRM
**Date:** 9 November 2026  
**Repository:** `UroojAKI/JEST-TECH-`  
**Remediation branch:** `ai/health-crm-production-remediation-2026-11-08`  
**Pull request:** https://github.com/UroojAKI/JEST-TECH-/pull/19  
**Latest remediation commit:** `689b06cb37572932fceda1780c9aad2fee798739`

## Executive assessment

The original health-insurance, tenant-integrity, PII, authentication and dependency findings have received code changes. The newly supplied runtime findings have also been incorporated into the same remediation branch. This is **not yet a production sign-off**: the latest changes have not completed CI verification, several runtime/deployment validations remain outstanding, and the production PII backfill and invitation lifecycle are not complete.

## A. Previously identified remediation findings

| Area | Code remediation | Verification / remaining |
|---|---|---|
| Health quotation document gate | Removed APPROVED/ACCEPTED bypass; required documents are loaded per case; issuance blocks missing/unverified requirements; rejected documents are represented separately. | Regression tests were added in earlier commits. Latest full E2E run after fixture correction is not confirmed. |
| Policy issuance | Removed automatic promotion of uploaded health documents to VERIFIED; tenant ownership check precedes KYC mutation. | Must complete full API E2E and deployed workflow testing. |
| Portability | Portability form requirement now depends on persisted PORTABILITY renewal subtype. | Regression coverage added; confirm with representative renewal records. |
| Quote selection | Atomic compare-and-set prevents concurrent selection of multiple quotes. | Regression coverage added; runtime concurrency testing remains. |
| Tenant/user integrity | Branch and department ownership validated; Agent profile creation is atomic with User creation; company/branch scope resolver restored. | Static scanner previously reported five unscoped operations in User workspace queries. Direct company filters have now been added to task and quotation queries; rerun scanner is pending. |
| PII | Prisma delegate encryption/decryption wrapper, PAN blind indexes, encrypted-field masking, and restartable batch backfill script/runbook added. | Production backfill has **not** run. Verify backups, key custody, raw SQL, exports, object storage and external integrations separately. |
| Authentication | Failed-login counters and lockout expiry moved to atomic database state; database failures fail closed. | CI regression tests were added; production abuse/race testing remains. |
| Dependencies | Joi and follow-redirects overrides/lockfile updated. | Previous high-severity dependency audit passed; rerun on latest head pending. |

## B. Newly identified motor / CRM / operations findings

| ID | Finding | Remediation on branch | Status |
|---|---|---|---|
| MTR-01 | Five-year bike TP label was passed through `Number()`, becoming NaN and defaulting to one year. | Parse supported legacy labels at the API boundary; reject unrecognized values; pass numeric `tpTenureYears`. | Implemented; CI and business-rule tests pending. |
| MTR-02 | OD and TP durations were represented by one ambiguous tenure. | Added separate `odTenureYears` and `tpTenureYears` calculation contract fields; OD remains one year and TP is independently validated. | Implemented at API contract; verify persisted dates and insurer payloads end-to-end. |
| MTR-03 | SAOD UI displayed VERIFIED while dates were expired, future-dated or reversed. | Frontend now separates document verification from active coverage validity, compares dates in Asia/Kolkata business-date terms, constrains date inputs, and blocks calculation unless coverage is active. Backend already validates missing verification, reversed dates, future starts and expiry. | Implemented; frontend/backend integration tests pending. |
| CRM-01 | Vehicle history query selected nonexistent `Policy.insurerName`; errors were swallowed and returned an empty list. | Query now selects schema field `insurerNameSnapshot`; maps it to the response; lookup failures are logged and surfaced as an explicit server error instead of a false successful empty history. | Implemented; Prisma and identity-flow tests pending. |
| MTR-04 | Wizard sent unsupported `contactId` to strict motor journey DTO. | Removed unsupported `contactId` from journey creation request; kept supported `leadId` and `vehicleCategory`. Strict DTO validation remains enabled. | Implemented; new-lead and existing-contact journeys need E2E verification. |
| MTR-05 | At least one IDV request failed range validation; exact request-body root cause was not present in supplied logs. | Client now validates finite IDV and ₹10,000–₹5,00,00,000 bounds before sending; aborts prior requests and invalidates stale results when inputs become invalid. | Mitigation implemented; original triggering payload still unproven. Add request correlation/payload-safe diagnostics and reproduce. |
| MTR-06 | Save flow showed a generic calculation failure. | Save message now directs the user to the actual inline calculator error; calculator surfaces the backend error or IDV field validation. | Implemented; UX test pending. |
| OPS-01 | Authenticated requests logged as anonymous. | Logger now reads ActorContext `userId` (the JWT shape), and includes company, role and correlation/request ID. | Root cause fixed in code; verify with authenticated HTTP smoke tests and confirm no PII/secrets are logged. |
| OPS-02 | MinIO failure could silently result in local filesystem writes in DUAL mode. | Production MinIO requires explicit host and credentials; DUAL storage refuses local upload fallback in production unless `ALLOW_LOCAL_STORAGE_FALLBACK=true`; warning no longer falsely claims MinIO itself performs fallback. | Implemented; validate production env, durability, replication, restore and explicit fallback policy. |

## C. CI evidence and limitations

- On the prior head `9017606...`, the Multi-Tenant AST Security Analysis failed with **5 errors and 55 warnings**. The five errors were in `users.service.ts` task counts, quotation counts and task listing. The latest remediation adds explicit `companyId` predicates and rejects workspace access without a company context.
- On that same prior run, migration safety and dependency security audit passed. CodeQL Actions analysis passed; JavaScript/TypeScript analysis was still running at the time checked.
- The latest head `689b06cb...` currently has no reported workflow runs or combined status checks available through the GitHub status endpoint. Therefore the new code must be treated as **unverified** until CI runs on this exact commit.
- Do not treat the 55 scanner warnings as confirmed vulnerabilities or safe findings without manual review. Each must be traced to its owning tenant boundary and classified with evidence.
- No local test execution is claimed in this report.

## D. Outstanding blockers before production approval

1. **Invitation lifecycle:** Implement the SRS-aligned single-use, 72-hour user activation flow with verified outbound email delivery. Current active-user/initial-password flow remains.
2. **PII migration:** Take and verify backup; confirm production key custody; run the backfill in an approved window; verify encrypted records, blind indexes, read/write compatibility, restore and key recovery. This has not been executed.
3. **Tenant isolation:** Rerun AST scanner on latest head; manually review all warnings; add cross-tenant negative tests for BI, policy, quotation, task, customer, contact, documents, exports, jobs and webhooks.
4. **Motor journey acceptance:** Test new bike Package (OD 1 + TP 5), new bike TP-only (TP 5), new private car (TP 3), existing renewal, and commercial cases; assert premium, stored component dates and policy output.
5. **SAOD acceptance:** Test active TP, expired TP, future start, expiry-before-start, malformed dates, and document-verified-but-coverage-invalid states. Verify server rejection as well as frontend display.
6. **CRM identity acceptance:** Verify associated vehicle and latest policy history are returned; simulate Prisma query failure and confirm the API does not return a misleading successful empty list.
7. **Storage acceptance:** Verify production MinIO connectivity and upload/download/delete; confirm outage fails closed by default; test explicitly approved fallback and read-repair; validate backup/restore and multi-instance access.
8. **Audit logging:** Run authenticated HTTP requests and verify userId, companyId, role and correlation ID are present; unauthenticated requests must remain clearly anonymous.
9. **Performance and resilience:** Run load/soak, queue/retry, database failover, backup restore and disaster-recovery exercises.
10. **Final regression:** Run API typecheck, web typecheck/build, unit/integration tests, certification/security tests, full E2E, migration checks, dependency audit, CodeQL and tenant scanner on the exact final head.

## E. Release decision

**Decision: NOT READY FOR PRODUCTION / DO NOT MERGE YET.**

The branch contains remediation code for the newly reported defects and the earlier findings, but there is no successful verification run for the latest commit. Close each outstanding item with evidence (test output, scanner result, deployment validation or approved operational record) before converting the draft PR to ready-for-review.
