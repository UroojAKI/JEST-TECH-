# Combined Production Remediation Report — JEST Policy CRM
**Date:** 9 November 2026  
**Repository:** `UroojAKI/JEST-TECH-`  
**Remediation branch:** `ai/health-crm-production-remediation-2026-11-08`  
**Pull request:** https://github.com/UroojAKI/JEST-TECH-/pull/19  
**Latest implementation commit at report update:** `e346e7940cc32ad8b3dd2022c0f3c79d203c5bf2`

## Executive assessment

The original health-insurance, tenant-integrity, PII, authentication and dependency findings have received code changes. The newly supplied runtime findings, multi-quotation workflow, explicit back-office handoff, Motor/Health renewal lineage and 72-hour invitation lifecycle are also implemented on the remediation branch. The exact implementation head passed the configured GitHub API and Web quality-gate workflows. This is **not a production sign-off**: real provider delivery, production PII backfill, insurer-specific acceptance and operational resilience evidence remain outstanding.

## A. Previously identified remediation findings

| Area | Code remediation | Verification / remaining |
|---|---|---|
| Health quotation document gate | Removed APPROVED/ACCEPTED bypass; required documents are loaded per case; issuance blocks missing/unverified requirements; rejected documents are represented separately. | Regression tests were added in earlier commits. Exact-head API unit, certification/security and E2E suites passed in CI. |
| Policy issuance | Removed automatic promotion of uploaded health documents to VERIFIED; tenant ownership check precedes KYC mutation. | Must complete full API E2E and deployed workflow testing. |
| Portability | Portability form requirement now depends on persisted PORTABILITY renewal subtype. | Regression coverage added; confirm with representative renewal records. |
| Quote selection | Atomic compare-and-set prevents concurrent selection of multiple quotes. | Regression coverage added; runtime concurrency testing remains. |
| Tenant/user integrity | Branch and department ownership validated; Agent profile creation is atomic with User creation; company/branch scope resolver restored. | Static scanner previously reported five unscoped operations in User workspace queries. Direct company filters have now been added to task and quotation queries; rerun scanner is pending. |
| PII | Prisma delegate encryption/decryption wrapper, PAN blind indexes, encrypted-field masking, and restartable batch backfill script/runbook added. | Production backfill has **not** run. Verify backups, key custody, raw SQL, exports, object storage and external integrations separately. |
| Authentication | Failed-login counters and lockout expiry moved to atomic database state; database failures fail closed. | API unit and security suites passed on exact head; production abuse/race testing remains. |
| Dependencies | Joi and follow-redirects overrides/lockfile updated. | Dependency security audit passed on exact head. |

## B. Newly identified motor / CRM / operations findings

| ID | Finding | Remediation on branch | Status |
|---|---|---|---|
| MTR-01 | Five-year bike TP label was passed through `Number()`, becoming NaN and defaulting to one year. | Parse supported legacy labels at the API boundary; reject unrecognized values; pass numeric `tpTenureYears`. | Implemented; exact-head API/Web CI passed. Dedicated product-specific premium/date matrix remains required. |
| MTR-02 | OD and TP durations were represented by one ambiguous tenure. | Added separate `odTenureYears` and `tpTenureYears` calculation contract fields; OD remains one year and TP is independently validated. | Implemented at API contract; verify persisted dates and insurer payloads end-to-end. |
| MTR-03 | SAOD UI displayed VERIFIED while dates were expired, future-dated or reversed. | Frontend now separates document verification from active coverage validity, compares dates in Asia/Kolkata business-date terms, constrains date inputs, and blocks calculation unless coverage is active. Backend already validates missing verification, reversed dates, future starts and expiry. | Implemented; frontend/backend integration tests pending. |
| CRM-01 | Vehicle history query selected nonexistent `Policy.insurerName`; errors were swallowed and returned an empty list. | Query now selects schema field `insurerNameSnapshot`; maps it to the response; lookup failures are logged and surfaced as an explicit server error instead of a false successful empty history. | Implemented; CRM identity unit test passed on exact head. |
| MTR-04 | Wizard sent unsupported `contactId` to strict motor journey DTO. | Removed unsupported `contactId` from journey creation request; kept supported `leadId` and `vehicleCategory`. Strict DTO validation remains enabled. | Implemented; new-lead and existing-contact journeys need E2E verification. |
| MTR-05 | At least one IDV request failed range validation; exact request-body root cause was not present in supplied logs. | Client now validates finite IDV and ₹10,000–₹5,00,00,000 bounds before sending; aborts prior requests and invalidates stale results when inputs become invalid. | Mitigation implemented; original triggering payload still unproven. Add request correlation/payload-safe diagnostics and reproduce. |
| MTR-06 | Save flow showed a generic calculation failure. | Save message now directs the user to the actual inline calculator error; calculator surfaces the backend error or IDV field validation. | Implemented; UX test pending. |
| OPS-01 | Authenticated requests logged as anonymous. | Logger now reads ActorContext `userId` (the JWT shape), and includes company, role and correlation/request ID. | Root cause fixed in code; verify with authenticated HTTP smoke tests and confirm no PII/secrets are logged. |
| OPS-02 | MinIO failure could silently result in local filesystem writes in DUAL mode. | Production MinIO requires explicit host and credentials; DUAL storage refuses local upload fallback in production unless `ALLOW_LOCAL_STORAGE_FALLBACK=true`; warning no longer falsely claims MinIO itself performs fallback. | Implemented; validate production env, durability, replication, restore and explicit fallback policy. |

## C. CI evidence and limitations

**Exact implementation head:** `e346e7940cc32ad8b3dd2022c0f3c79d203c5bf2`  
**GitHub Actions run:** [#42520922062](https://github.com/UroojAKI/JEST-TECH-/actions/runs/42520922062)

Both quality-gate jobs completed successfully on this exact commit.

- **API:** secret scan passed; frozen lockfile install passed; Prisma Client generation passed; all migrations applied; API TypeScript passed; dependency security audit passed; heuristic tenant-scope validator reported **0 unscoped tenant queries**; production source/mock-data AST scanner passed across **766 production files** with zero prohibited mock data or unsafe persistence patterns; unit tests **1,255 passed, 1 skipped**; certification/security tests **265 passed**; E2E **3 suites and 5 tests passed**; live HTTP readiness probe passed.
- **Web:** frozen lockfile install, TypeScript typecheck, Vitest unit/integration tests and production build all passed.

The earlier tenant-scope scanner result of 5 errors / 55 warnings was on an older commit. The five reported errors were corrected, and the latest heuristic scanner now reports zero unscoped tenant queries. This scanner is not a proof of runtime isolation. The remaining warnings and tenant-boundary behavior still require manual review and cross-tenant negative tests.

CI uses test-only database credentials and test fixtures. It does not prove production key custody, real SendGrid delivery, live insurer punching, production MinIO durability, load capacity, failover or disaster recovery. The exact-head CI success therefore supports code-level readiness only, not a production deployment approval.

## D. Outstanding blockers before production approval

1. **Invitation operations:** Configure and verify SendGrid `SENDGRID_API_KEY`, verified `MAIL_FROM` and `FRONTEND_URL` in each environment; run admin invite/activation/resend smoke tests. No real email delivery has been exercised from this repository session.
2. **PII migration:** Take and verify backup; confirm production key custody; run the backfill in an approved window; verify encrypted records, blind indexes, read/write compatibility, restore and key recovery. This has not been executed.
3. **Tenant isolation:** Latest heuristic scanner passed with zero unscoped tenant queries; manually review remaining warnings and add cross-tenant negative tests for BI, policy, quotation, task, customer, contact, documents, exports, jobs and webhooks.
4. **Motor journey acceptance:** Test new bike Package (OD 1 + TP 5), new bike TP-only (TP 5), new private car (TP 3), existing renewal, and commercial cases; assert premium, stored component dates and policy output.
5. **SAOD acceptance:** Test active TP, expired TP, future start, expiry-before-start, malformed dates, and document-verified-but-coverage-invalid states. Verify server rejection as well as frontend display.
6. **CRM identity acceptance:** Verify associated vehicle and latest policy history are returned; simulate Prisma query failure and confirm the API does not return a misleading successful empty list.
7. **Storage acceptance:** Verify production MinIO connectivity and upload/download/delete; confirm outage fails closed by default; test explicitly approved fallback and read-repair; validate backup/restore and multi-instance access.
8. **Audit logging:** Run authenticated HTTP requests and verify userId, companyId, role and correlation ID are present; unauthenticated requests must remain clearly anonymous.
9. **Performance and resilience:** Run load/soak, queue/retry, database failover, backup restore and disaster-recovery exercises.
10. **Final regression:** API/Web quality-gate workflows passed on exact head. Run CodeQL and any additional organization-required security scans on the final merge candidate; repeat all quality gates if any code changes are made.

## D2. Renewal, quotation and notification increment

- Renewal quotations now retain a direct predecessor-policy reference. Newly issued policies retain a self-referential `renewedFromPolicyId` link. Both motor issuance and generic non-motor conversion persist the lineage.
- Motor renewal prefill maps into canonical previous-policy fields, carries the predecessor policy ID, and validates tenant/customer/vehicle consistency server-side.
- Health renewal flow passes the predecessor policy into the health wizard, preloads policy/member/customer context, stores the source policy ID in the health case snapshot, and attaches it to each health quotation after tenant/customer validation.
- The renewal drawer no longer presents simulated approval/payment/issuance steps. It routes supported Motor/Health products into their quotation journeys and blocks unsupported categories.
- EmailProvider no longer returns a fabricated SENT response based on SMTP/SES environment variables. It performs a real SendGrid API request and requires `SENDGRID_API_KEY` plus `MAIL_FROM`.

## D3. User invitation lifecycle

- Added tenant-scoped invitation records with a hashed, single-use token and 72-hour expiry.
- Admin user-management now exposes an invitation action; invited users are created in `PENDING_VERIFICATION` and cannot log in before activation.
- Activation endpoint is public but rate-limited, validates the token and minimum password length, and atomically consumes the invitation while activating the pending account.
- Re-invitation revokes prior unused tokens; email delivery failure revokes the failed token while leaving the pending account eligible for a safe retry.
- Added an account activation page and focused tests for successful activation, invalid/expired tokens, concurrent token consumption and account-state mismatch.
- Email transport now sends through SendGrid only when `SENDGRID_API_KEY` and `MAIL_FROM` are configured. A configured-but-unimplemented SMTP/SES variable can no longer produce a fake success.

## E. Release decision

**Decision: NOT READY FOR PRODUCTION / DO NOT MERGE YET.**

The branch contains remediation code for the newly reported defects and the earlier findings, but the exact implementation head passed the configured API and Web quality-gate workflows. Close the remaining external operational and product-specific acceptance items with evidence (provider delivery, PII backfill, insurer rules, tenant runtime isolation, storage restore, load/failover and DR) before converting the draft PR to ready-for-review.
