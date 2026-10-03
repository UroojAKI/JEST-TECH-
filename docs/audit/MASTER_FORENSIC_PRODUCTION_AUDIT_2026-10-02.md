# JEST Policy CRM — Forensic Production Audit

**Audit date:** 2026-10-02  
**Repository:** `jest-policy-crm`, branch `main`, checkout HEAD `5da223b1f1934c8df4e74ccecd88867f8f2726bb`  
**Disposition:** **NOT CERTIFIED FOR PRODUCTION**  
**Scope:** Repository, checked-in documentation/configuration, automated checks runnable from this checkout. No production or staging credentials were supplied.

## 1. Executive summary

The checked-in release artifacts claim `PRODUCTION_READY` and a 25/25 gate pass, but the binding exit criteria leave deployment, real database migration, staging smoke tests, backup/restore, rollback, golden-path E2E, role UAT, and operations gates unchecked. The certification validator exits nonzero against this working tree because the Prisma schema has uncommitted changes and its hash differs from the certificate. This does **not** establish that the committed `main` schema differs from the certificate; release evidence for the dirty working tree is invalid, and the repository contains conflicting release claims.

One concrete infrastructure risk was confirmed: both Compose configurations publish Redis without authentication on host port 6380 using a wildcard host bind. If either stack runs on a host reachable by untrusted clients, they can reach the cache/queue service. Runtime exposure was not tested because these Docker services were not started.

The API build, Prisma schema validation, tenancy scanner, mock-data scanner, all API unit suites, and web tests passed. Those checks establish useful source-level evidence, but do not establish live authorization, production isolation, migration safety, concurrency, recoverability, performance, or end-to-end business readiness. The dedicated PostgreSQL inspection test was skipped because `E2E_DATABASE_URL` was not set.

No claim is made that the application is safe or unsafe in every deployment. Production infrastructure, database contents, secret stores, cloud IAM, backup configuration, deployment history, and browser/API behavior against a live environment remain unverified.

## 2. Findings register

### JEST-AUDIT-0001 — Unauthenticated Redis is published on host interfaces

- **Severity:** P1 when deployed on a shared/untrusted network; otherwise P2 configuration risk
- **Category:** Infrastructure / data security / availability
- **Locations:** `docker-compose.yml:29,33`; `infrastructure/docker/docker-compose.yml:33`
- **Affected components:** Redis cache and BullMQ service
- **Expected:** Redis should not accept unauthenticated traffic from host networks; host exposure should be explicit and restricted.
- **Actual:** Compose maps `6380:6379` without a loopback host IP, and starts Redis with persistence only (`redis-server --appendonly yes`), with no password or ACL configuration. The same port mapping is present in the infrastructure Compose copy.
- **Evidence:** `git grep` found these exact mappings and no `requirepass` configuration in the searched Compose/Kubernetes infrastructure files. The root Compose comment calls Redis internal-only while publishing its port to the host.
- **Impact:** A client able to reach the Docker host on port 6380 may read/alter cached data and queue state, enqueue work, or disrupt service. Actual reachability depends on host firewall and network placement and was not tested.
- **Verification:** Confirmed in configuration; runtime exploitability **UNVERIFIED**.
- **Recommended fix:** Remove the host port publication where unnecessary. If host access is required, bind to loopback and require Redis ACL/authentication; validate the same controls in both Compose files.
- **Regression test:** Render Compose configuration and assert Redis has no public host binding and authentication is enabled for any exposed listener.

### JEST-AUDIT-0002 — Release readiness claims conflict with mandatory open gates

- **Severity:** P1 — release governance blocker
- **Category:** Release / documentation drift / auditability
- **Locations:** `certification/RELEASE_CERTIFICATE_PRODUCTION.json`; `docs/PRODUCTION_EXIT_CRITERIA.md`
- **Expected:** A production-ready certificate should only be issued after every binding release gate has current, independently verifiable evidence.
- **Actual:** The certificate declares `PRODUCTION_READY`, all 25 gates PASS, and all defects resolved. The binding exit criteria explicitly leave G16–G20 and final release sign-off unchecked, including real staging deployment, database migration, smoke tests, human approval, backup/restore, rollback, golden-path E2E, 16-persona UAT, metrics/alerts, and operations runbook verification.
- **Evidence:** The checked-in checklist text marks these conditions `[ ]`; the certificate JSON marks every gate `PASS`. The local certificate verifier exits nonzero and reports a schema hash mismatch. The current schema hash is `sha256:022ce0bbf10f7352aa90b9f3107158ec08263f64bd8359181101560f8d6f33fa`; the certificate records `sha256:d7c698122af143d6eda3a2675631455be7d7cff6e545644a77ec9b7c1fc404d3`.
- **Impact:** Consumers can mistake historical/static evidence for current production approval.
- **Verification:** Contradiction and schema mismatch **CONFIRMED**. Live release state **UNVERIFIED**. The validator could not resolve Git history from its child process in this Windows execution environment, so its commit ancestry verdict is not relied on here.
- **Recommended fix:** Withdraw or mark the certificate invalid; reconcile each gate against dated artifacts from the target environment. Never regenerate evidence by writing synthetic pass records.
- **Regression test:** CI must fail certification if any mandatory release gate is unchecked, evidence is missing/stale, or the schema hash differs.

### JEST-AUDIT-0003 — Automatic deploy path has no health verification or rollback

- **Severity:** P1 — production change-control/recovery blocker
- **Category:** Deployment / reliability / incident recovery
- **Location:** `.github/workflows/deploy.yml`
- **Expected:** A deployment should verify the running release and provide a tested recovery path before reporting success.
- **Actual:** A push to `main` or `staging` triggers SSH deployment. The remote script fetches and hard-resets to the branch, installs dependencies, generates Prisma, applies migrations, builds, then runs `pm2 restart all` (or a fallback start). The workflow contains no post-deploy health probe, smoke test, backup step, rollback command, or declared GitHub Environment approval gate. Whether repository branch protection or environment approvals are configured remotely is unknown.
- **Evidence:** Workflow file inspected; the repository’s checklist independently leaves G16 and G17 unchecked.
- **Impact:** A failed build, migration, or startup can leave the deployment broken after the previous checkout has been overwritten; workflow completion does not prove service health.
- **Verification:** Workflow configuration **CONFIRMED**; actual deploy outcome and remote protection settings **UNVERIFIED**.
- **Recommended fix:** Deploy an immutable artifact, run migration with a documented expand/contract strategy and backup policy, probe readiness and golden-path smoke checks, and retain a tested rollback target behind an enforced approval gate.
- **Regression test:** Exercise deployment failure before/after migration in staging and verify health-gated promotion and rollback.

### JEST-AUDIT-0004 — Existing migration files are edited in the working tree

- **Severity:** P2 — migration rollout risk
- **Category:** Database / migration forensics
- **Locations:** `apps/api/prisma/migrations/20261001000001_add_task_code_sequence/migration.sql`; `.../20261001000002_wave2_canonical_motor_case_and_tasks/migration.sql`
- **Expected:** Applied migration files remain immutable; compatibility corrections ship as forward migrations.
- **Actual:** The checkout removes a BOM from migration 1 and removes a default-alter statement from migration 2, while new schema work adds migration `20261002090000_motor_inspection_case_link`.
- **Evidence:** `git diff` confirms modifications to the two existing migration paths. Earlier local migration-status evidence showed the configured development DB had those migrations pending; no production/staging migration history was available.
- **Impact:** If either edited migration has already been applied elsewhere, migration checksums/history may differ across environments and clean installs may not match existing installations.
- **Verification:** File modifications **CONFIRMED**; whether any deployed DB has applied the old contents **UNVERIFIED**.
- **Recommended fix:** Check migration history for every target environment. If already applied, restore the original migration contents and express corrections only in a new forward migration. Test both empty-database deployment and upgrade from a production-like snapshot.
- **Regression test:** Apply migrations to an empty database and an upgraded snapshot; compare `_prisma_migrations` checksums and resulting schema.

### JEST-AUDIT-0005 — Tenant scanner PASS does not prove tenant isolation across data access

- **Severity:** P2 — assurance gap; no specific cross-tenant exploit confirmed by this scanner finding
- **Category:** Authorization / tenancy / test quality
- **Location:** `scripts/check-tenant-scoping.js`
- **Expected:** A passing isolation gate should cover the query paths and relations that enforce authorization, including service/repository calls.
- **Actual:** The script enumerates controller files and checks a limited set of direct Prisma calls for textual `companyId` tokens. It does not analyze the service/repository query that a controller delegates to, and its own source comment describes only controller scans. The report’s “all controllers strictly enforce fail-closed tenant scoping” message overstates what this heuristic can establish.
- **Evidence:** The scanner source and this run’s result: 56 controllers scanned, PASS. `docs/ARCHITECTURE_FREEZE.md` describes dozens of direct-Prisma services, outside that scanner’s primary scope.
- **Impact:** A missing tenant predicate in a service/repository may pass this gate. This is a limit in the control, not proof of an exploitable data leak.
- **Verification:** Scanner limitation **CONFIRMED**; runtime tenant isolation **UNVERIFIED**.
- **Recommended fix:** Add negative integration tests that attempt cross-company reads and mutations for each high-risk resource through HTTP; treat the scanner as a lint aid, not a security certificate.
- **Regression test:** Seed two companies and test list/get/update/delete/export/document/approval/report paths as agent, back office, and admin across both tenants.

### JEST-AUDIT-0006 — Operations runbook references an absent worker container

- **Severity:** P2 — incident response dead end
- **Category:** Operations / supportability / documentation drift
- **Locations:** `docs/OPERATIONS_RUNBOOK.md:20`; `docker-compose.yml`
- **Expected:** Recovery steps should name a deployable service and a command verified in the current topology.
- **Actual:** The runbook instructs operators to restart `jest-api-worker`; the checked-in Compose stack defines `jest-api`, not `jest-api-worker`. The runbook also lists retry and health paths that were not validated against a live API during this audit.
- **Evidence:** `docker-compose.yml` service inventory and the exact runbook command.
- **Impact:** On-call staff may waste time or fail to restore queue processing during an incident.
- **Verification:** Missing Compose service **CONFIRMED**; runtime queue topology **UNVERIFIED**.
- **Recommended fix:** Document the actual worker process/container and verify every runbook API path against a running deployment.
- **Regression test:** A runbook smoke check should resolve each named service and endpoint in staging.

### JEST-AUDIT-0007 — Legacy motor reconciliation can leave partial destructive changes

- **Severity:** P1 — data integrity / migration safety
- **Category:** Database / transactionality / recovery
- **Locations:** `scripts/motor-migration-01.ts`; `apps/api/src/modules/motor/services/motor-migration.service.ts`
- **Expected:** A reconciliation tool should be dry-run by default, apply changes atomically or be safely resumable, and only report success after all invariants pass.
- **Actual:** The CLI performs a write run unless `--dry-run` is passed. The service first clears duplicate policies’ `quotationId` and marks them `SUPERSEDED`, creates/relinks canonical quotations and cases, and repoints policy foreign keys. These operations are not inside a transaction. Policy uniqueness, financial reconciliation, and orphan assertions run after mutations; if they fail, the CLI returns a failure code but leaves earlier writes committed.
- **Evidence:** `executeMigration` calls `deduplicateMotorPolicies` before legacy reconciliation; `policy.update`, quotation/case create/update and policy `updateMany` are called directly; no `$transaction` surrounds the method. The CLI’s `isDryRun` is only `process.argv.includes('--dry-run')`, defaulting false.
- **Impact:** A crash, FK/data error, or failed final assertion can leave partially migrated or detached records. Re-running may not restore original policy associations, and the current final checks do not cover every related entity.
- **Verification:** Control-flow behavior **CONFIRMED** by source. No migration was run against a production-like snapshot; actual affected data **UNVERIFIED**.
- **Recommended fix:** Make dry-run the default and require an explicit apply flag. Run on a restorable snapshot; use bounded transactions or a resumable checkpointed migration with before/after reconciliation and preserved source associations. Do not execute against production until the recovery plan is tested.
- **Regression test:** Inject failure after each mutation phase against a disposable PostgreSQL database; assert rollback or safe resumability and compare financial totals, policy links, cases, documents, payments and orphan counts.

### JEST-AUDIT-0008 — Generic claim update bypasses terminal-state protections

- **Severity:** P1 — financial/business-integrity risk
- **Category:** Authorization / state machine / claims
- **Location:** `apps/api/src/modules/claims/controllers/claims.controller.ts` (the generic `PATCH /api/v1/claims/:id` handler)
- **Expected:** A closed or settled claim cannot have decision/financial fields edited through a generic endpoint; all state-sensitive changes must go through an authorized domain command and produce the expected history.
- **Actual:** The PATCH handler loads a claim, checks tenant authorization, and directly updates `surveyorName`, `surveyorDetails`, and `approvedAmount`. It does not call `ClaimStateMachine.validateTransition` or reject `CLOSED`/`SETTLED`. The state machine marks `CLOSED` terminal, but the generic field update does not change status and therefore bypasses transition validation.
- **Evidence:** Controller source and `ClaimStateMachine` source inspected. The `UpdateClaimDto` allows `approvedAmount`; no terminal-state guard is in the controller path.
- **Impact:** A Back Office user or tenant ADMIN can change the approved amount after settlement/closure through the generic route. This can make claim and finance records disagree. This source-level behavior is confirmed; no authenticated live HTTP reproduction was run.
- **Verification:** Code path **CONFIRMED**; live exploit and downstream ledger effects **UNVERIFIED**.
- **Recommended fix:** Route updates through a claim command that checks status and company scope; prohibit financial changes once the claim is terminal, and ensure every permitted correction has an explicit reason, audit/history record, and reconciliation effect.
- **Regression test:** API tests for `CLOSED` and `SETTLED` PATCH attempts by Back Office and Admin return 400/409 and leave claim, history, audit, and ledger unchanged; allowed nonterminal edit remains covered.

### JEST-AUDIT-0009 — Public webhook accepts unsigned non-Razorpay events

- **Severity:** P1 — unauthenticated event injection
- **Category:** Webhook security / integrations
- **Location:** `apps/api/src/modules/platform/integrations/webhooks/controllers/webhook-gateway/webhook-gateway.controller.ts`
- **Expected:** Each accepted provider has a configured cryptographic verifier; unknown or unconfigured providers are rejected before persistence or event dispatch.
- **Actual:** The controller is `@Public()` and accepts `POST /api/v1/webhooks/:provider`. `validateSignature` only contains a validation branch for `razorpay`; other provider values return without checking any signature. If an event ID is supplied, the handler stores the payload and emits `integration.webhook.<provider>.<eventType>`.
- **Evidence:** Current controller source. Existing nearby tests shown in the audit run cover Razorpay signature cases; this audit did not find equivalent Twilio/unknown-provider rejection coverage.
- **Impact:** An unauthenticated caller can inject provider events. Downstream listeners may trust forged status or delivery events; exact effects depend on registered listeners and provider routes.
- **Verification:** Public route and validator fall-through **CONFIRMED** in source; live request and downstream impact **UNVERIFIED**.
- **Recommended fix:** Allow-list configured providers, verify each provider using its required signing inputs (including original request bytes and canonical URL where required), reject unknown providers, then atomically persist/idempotently dispatch only verified events.
- **Regression test:** Unsigned, invalid-signature, unknown-provider, stale/replayed and duplicate/conflicting event cases must be rejected or safely idempotent; include a valid signature test per configured provider.

### JEST-AUDIT-0010 — Premium calculation has a reproducible floating-point rounding error

- **Severity:** P2 — financial calculation correctness
- **Category:** Financial integrity / money representation
- **Location:** `apps/api/src/modules/quotation/engine/premium.service.ts:34`
- **Expected:** Premium rounding follows a documented currency rule and produces the same result independent of binary floating-point representation.
- **Actual:** OD premium is calculated using JavaScript `number` and `Math.round(idv * rate * ccMultiplier)`. An exact-rational comparison reproduced a one-rupee difference at IDV `3,000,000`, Zone A rate `0.03127`, and multiplier `1.15`: floating result `107881.49999999999` rounds to `107881`; exact decimal `107881.5` under half-up rounding is `107882`.
- **Evidence:** Source formula plus a local arithmetic check; the attachment’s example at IDV 500,000 was incorrect because both exact half-up and JS rounding yield 17,980 for 17,980.25. This separate boundary case reproduces the defect.
- **Impact:** A narrow class of inputs can yield a premium one currency unit below the specified rounding result, affecting quotes and reconciliation.
- **Verification:** Arithmetic divergence **REPRODUCED**; occurrence in insurer products and production records **UNVERIFIED**.
- **Recommended fix:** Use exact decimal inputs/rates/multipliers and one documented rounding mode through persistence and issuance comparison. Keep serialization to API numbers only at the boundary if required.
- **Regression test:** Assert the 3,000,000 example, half-unit boundaries for both zones and all multipliers, and reconciliation equality through the quote-to-issuance path.

### JEST-AUDIT-0011 — Receipt action reports success without issuing a receipt

- **Severity:** P1 — financial UI integrity
- **Category:** Frontend / finance workflow
- **Location:** `apps/web/src/app/finance/page.tsx` (receipt register action)
- **Expected:** “Issue Premium Receipt” creates a persistent, authorized receipt and displays the server-assigned receipt number only after success.
- **Actual:** The button displays a success toast with a fixed receipt number and amount; it makes no API call and writes no receipt.
- **Evidence:** Current source contains the literal `REC-2026-9901` success toast beside the Issue Premium Receipt button. A receipts hook exists elsewhere on the page, but this action is not wired to it.
- **Impact:** Staff may believe a regulated financial document exists when it does not.
- **Verification:** UI handler **CONFIRMED** by source; browser interaction was not repeated in this merge pass.
- **Recommended fix:** Until there is a real receipt command with authorization, payment linkage, idempotency, audit, and persistence, disable/remove this action and its success claim. Then wire the action to that command.
- **Regression test:** Component/API integration test asserts no success without a successful response and confirms the created receipt is persisted and listed once.

### JEST-AUDIT-0012 — Report and voucher download buttons show success without downloading

- **Severity:** P2 — misleading business UI
- **Category:** Frontend / reporting / documents
- **Locations:** `apps/web/src/app/reports/page.tsx`; `apps/web/src/components/finance/vouchers/VoucherPreviewModal.tsx`
- **Expected:** A download action retrieves an authorized file and starts a browser download, or explains that export is unavailable.
- **Actual:** Report Download and voucher Download PDF buttons call `toast.success` only; there is no request or file transfer in those click handlers.
- **Evidence:** Current handlers were inspected. Separate document download flows exist elsewhere but are not used by these two controls.
- **Impact:** Users can believe reports/vouchers were exported when no file was produced.
- **Verification:** Handler behavior **CONFIRMED** by source; browser network behavior not run.
- **Recommended fix:** Reuse an existing secured export/download service if suitable; otherwise disable the controls until implemented. Never show success before a successful response and completed download initiation.
- **Regression test:** Component tests assert an export request, error handling, and browser download behavior for authorized and unauthorized responses.

### JEST-AUDIT-0013 — Numbering configuration Save is a no-op

- **Severity:** P2 — admin configuration reliability
- **Category:** Frontend / configuration
- **Location:** `apps/web/src/app/admin/numbering/page.tsx`
- **Expected:** Save persists editable numbering rules or the interface is read-only and has no Save action.
- **Actual:** The page loads `useNumberSeries`, displays values as read-only, and the Save button only shows an informational toast.
- **Evidence:** Current component source.
- **Impact:** Administrators receive a false confirmation that numbering configuration was saved.
- **Verification:** Handler behavior **CONFIRMED** by source.
- **Recommended fix:** Remove the no-op Save button while the page is read-only, or implement a validated, authorized update mutation with audit and persistence.
- **Regression test:** Assert save is absent when read-only, or verify saved values survive reload when editing is supported.

### JEST-AUDIT-0014 — Customer notes, dismissed alerts, and completed tasks are browser-local

- **Severity:** P2 for customer notes; P3 for alert/task UI state
- **Category:** Data lifecycle / frontend / multi-agent workflow
- **Locations:** `apps/web/src/components/customer/tabs/CustomerTabsContainer.tsx`; `apps/web/src/components/customer/customer-alerts-queue.tsx`
- **Expected:** Shared customer notes and workflow task completion state should persist in the CRM and be visible to authorized coworkers across devices.
- **Actual:** Customer notes, resolved alert IDs, and completed task IDs are read from and written to `localStorage`. The alert queue also constructs suggested tasks in the component rather than persisting task completion to the task service.
- **Evidence:** Current source uses per-customer localStorage keys and local-only event handlers.
- **Impact:** Other agents/devices do not see notes or task completion; browser reset loses the state. Local notes also lack server authorization, audit, and retention controls.
- **Verification:** Browser-local storage behavior **CONFIRMED** by source; whether these fields are intended to be private drafts **UNVERIFIED**.
- **Recommended fix:** Product owner should classify each value as private draft or shared business record. Persist shared notes/tasks through company-scoped, audited APIs; label truly local-only state clearly and avoid presenting it as authoritative completion.
- **Regression test:** Two authorized users/devices observe shared notes/task state; cross-company access is denied; local draft state is explicitly labeled and isolated.

### JEST-AUDIT-0015 — CI and deployment use different Node.js major versions

- **Severity:** P2 — deployment compatibility risk
- **Category:** CI/CD / runtime consistency
- **Locations:** `.github/workflows/ci.yml` uses Node 20; `.github/workflows/deploy.yml` and `.github/workflows/production-remediation-ci.yml` use Node 24
- **Expected:** Build, test, and deployed runtime versions should follow one supported runtime policy.
- **Actual:** CI and deploy workflows pin different Node majors; there is no single checked-in version file referenced by all workflows.
- **Evidence:** Workflow files inspected.
- **Impact:** A green test/build on Node 20 may not reproduce Node 24 behavior, particularly for native modules/runtime APIs.
- **Verification:** Configuration mismatch **CONFIRMED**; a production-only failure **UNVERIFIED**.
- **Recommended fix:** Select the supported Node version, pin it in one repository version file, and consume that value in CI, build and deployment.
- **Regression test:** Run typecheck, unit/integration tests, build, and native dependency install under the same pinned version used by the image/runtime.

### JEST-AUDIT-0016 — Claim lookup hydrates cross-tenant records before authorization

- **Severity:** P2 — defense-in-depth / data minimization
- **Category:** Tenant isolation / repository boundary
- **Location:** `apps/api/src/modules/claims/repositories/claim.repository.ts:findById`
- **Expected:** A tenant-owned claim lookup should include the caller’s company boundary in the database predicate before loading related PII.
- **Actual:** `findById` filters only by ID and soft-delete status, hydrates policy/contact/account/documents/history/communications, and the controller performs `authorize` after the lookup. The authorization service rejects a mismatched organization before returning the response, so this source alone does not prove external data disclosure.
- **Evidence:** Repository, controller and `ResourceAuthorizationService` inspected.
- **Impact:** Unnecessary cross-tenant data is materialized in the API process and the response path can distinguish not-found from forbidden in some cases. A timing oracle is possible in theory but was not measured.
- **Verification:** Unscoped fetch **CONFIRMED**; attacker-visible disclosure/timing exploit **UNVERIFIED**.
- **Recommended fix:** Pass companyId into the repository lookup and include it in the predicate. Keep resource authorization as a second control.
- **Regression test:** Cross-tenant claim ID returns the same not-found behavior as an absent ID and does not hydrate related data.

### JEST-AUDIT-0017 — CI test command has a broken argument separator in one workflow

- **Severity:** P2 — CI reliability
- **Category:** Test infrastructure
- **Location:** `.github/workflows/production-remediation-ci.yml` (`pnpm test -- --runInBand`)
- **Expected:** The test job invokes Jest/Vitest with valid options and fails only on real test failures.
- **Actual:** Reproducing the same pnpm argument form for the certification suite passed a literal `--` to Jest; Jest interpreted `--runInBand` as a path and reported “No tests found” while listing 16 matching suites.
- **Evidence:** Local command `pnpm --filter api test:cert -- --runInBand` exited 1 with Pattern `--runInBand`, 0 tests run. Correct invocation `pnpm --filter api test:cert --runInBand` passed all 16 suites/241 tests.
- **Impact:** The affected workflow is red despite tests existing; maintainers may bypass or disable the job instead of getting test evidence.
- **Verification:** CLI behavior **REPRODUCED**; hosted workflow execution **UNVERIFIED**.
- **Recommended fix:** Remove the extra separator in the workflow and use the package manager’s supported script invocation consistently for API and web.
- **Regression test:** Validate the exact workflow command locally in CI and assert it discovers the expected nonzero suite count.

### JEST-AUDIT-0018 — Production build workflows lack an explicit secret-scanning step

- **Severity:** P3 — supply-chain control gap
- **Category:** Secrets / CI/CD
- **Locations:** `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`
- **Expected:** A committed credential is detected before merge/deployment, in addition to any hosting-provider scanning.
- **Actual:** The inspected workflows include CodeQL and dependency audit but no explicit repository secret-scanning action/command. GitHub organization-level secret-scanning settings were unavailable.
- **Evidence:** Workflow YAML inspected.
- **Impact:** A newly introduced credential may not fail these repository workflows.
- **Verification:** Missing workflow step **CONFIRMED**; hosted native secret scanning **UNVERIFIED**.
- **Recommended fix:** Enable provider-side secret scanning/push protection and add a pinned, maintained secret scanner to PR CI; rotate immediately if a real secret is found.
- **Regression test:** Add a synthetic canary secret fixture in an isolated scanner test and confirm CI fails without exposing the value in logs.

### JEST-AUDIT-0019 — Production arithmetic example in the supplied report is incorrect

- **Severity:** P4 — audit correction, not an application defect
- **Category:** Evidence quality
- **Location:** Supplied audit text, DATA-001
- **Actual:** The cited `500000 × 0.03127 × 1.15 = 17980.25` rounds to 17,980 under both JavaScript `Math.round` and positive half-up decimal rounding; it does not demonstrate a one-rupee difference. The separate 3,000,000-IDV boundary reproduction in finding 0010 does.
- **Disposition:** Do not copy the submitted example into tests or present it as proof.

## 3A. Supplemental report disposition

The attached V2 report is merged as evidence to investigate, not accepted wholesale. In particular:

- **Confirmed and added:** claim terminal-state PATCH bypass; unsigned non-Razorpay webhooks; premium rounding divergence (with corrected reproduction); fake receipt, report download, voucher download, and numbering Save actions; browser-only notes/alert/task state; Node 20/24 mismatch; claim read before tenant filtering; and the broken `--` test argument form.
- **Already present in this report:** unauthenticated host-published Redis, deployment/backup/rollback gates, and the non-transactional motor reconciliation utility.
- **Not proven as direct vulnerabilities:** ADMIN role short-circuit. Source comments and authorization service define ADMIN as a company-scoped administrator; keep the guard behavior only if that policy is intended, and prove every service/list query remains tenant-scoped. Do not label it a cross-tenant bypass based on the guard alone.
- **Not reproduced in current source:** fake WhatsApp share and the dashboard “New Task” toast described in the attachment. They remain candidates for a full UI action inventory, not confirmed findings.
- **Incorrect as stated:** “zero web tests” (this run found 4 web test files/9 tests, including the current untracked inspection dialog test); “no backup/restore procedure exists” (the deployment guide has `pg_dump`/`pg_restore` instructions, but no verified backup or restore drill); the sample premium arithmetic; and an unconditional claim that no authenticated data exposure follows from the claim repository query. A query-scope gap exists, but service authorization runs before returning data.
- **Not independently re-audited:** refresh-token safety, exhaustive BOLA/role coverage, all 30 commits for secrets, analytics isolation, all 25 certification gates, and hosted GitHub protection/secret-scanning settings. These stay **UNVERIFIED**.

The attachment’s aggregate “5 P1” count and overall letter grades are not carried forward: its scope, claims, and severity assignments differ, and some supplied findings were stale or overclaimed. The combined register currently has more than five P1/P2 issues and is not a statistical vulnerability count.

## 8. Implementation plan

This plan resolves confirmed issues first and closes evidence gaps before release approval. The time estimates from the supplied report are omitted because they are not based on the team’s current capacity or delivery process.

### Phase A — Contain P1 risks

1. **Claims state integrity (finding 0008).** Add a claim command for surveyor/approved-amount edits; reject updates for `CLOSED` and `SETTLED`; require a reason and append history/audit for any permitted financial correction. Scope `findById` by company while touching the repository (finding 0016).
   - **Acceptance:** HTTP regression tests cover Back Office/Admin, `CLOSED`/`SETTLED`, tenant mismatch, response, history/audit, and unchanged ledger.
2. **Webhook authentication (finding 0009).** Enumerate providers and configure provider-specific verification; use the provider’s canonical signing inputs/raw request data; reject unknown/unconfigured providers before database write or event emission. Make idempotency persistence atomic with dispatch/outbox intent.
   - **Acceptance:** valid signature accepted for each configured provider; missing/invalid signatures, unknown provider, stale timestamps and changed-payload replay rejected; exact duplicate remains idempotent; no listener fires on rejection.
3. **Redis exposure (finding 0001, attachment INFRA-001/002).** Remove host publication unless needed; otherwise bind loopback, require credentials/ACL, and apply equivalent restrictions in both Compose definitions and any Kubernetes Service/NetworkPolicy. Check firewall/security groups before production.
   - **Acceptance:** rendered manifests expose no unauthenticated host listener; network probe from an untrusted host cannot connect; app health/queue tests pass with ACLs enabled.
4. **Money rounding (finding 0010).** Replace the premium money path’s floating arithmetic with exact decimal arithmetic and one documented rounding policy. Trace values through tax, quotation persistence, payment reconciliation and issuance comparisons; remove/deprecate competing tax methods only after caller inventory.
   - **Acceptance:** regression for IDV 3,000,000 yields 107,882 half-up; boundary/property tests cover both zones, engine multipliers, GST and quote/payment equality.
5. **Receipt issuance truth (finding 0011).** Remove/disable the false-success action immediately. Then implement an authorized, idempotent receipt command linked to a reconciled payment and policy/quotation, with server-generated number, audit and persisted document metadata.
   - **Acceptance:** no success toast on failure; retry creates one receipt; database and UI show the same server-generated receipt.
6. **Motor migration safety (finding 0007).** Require explicit `--apply`; default to dry-run; back up and restore a production-like database; introduce transaction or durable checkpoints with source-link preservation and reconcile after each batch.
   - **Acceptance:** injected failures leave no partial corruption or can resume without duplicate/lost records; totals and all referenced relations reconcile before/after.

**Phase A gate:** No application/security/finance P1 remains open; the certificate/deployment P1 release blockers remain open until Phases C/D. Security and finance regression suites pass, and changes have been reviewed against current role/company policies. Do not run the migration tool on production before the restore rehearsal.

### Phase B — Close integrity and workflow gaps

1. **Exports and admin configuration (findings 0012–0013).** For reports/vouchers, connect to an authorized export endpoint or remove the action until supported. For numbering, either remove the Save button while the page is read-only or add a validated mutation with audit. No success toast may stand in for persistence.
2. **Shared customer state (finding 0014).** Decide whether customer notes are private drafts. Persist shared notes and task completion through company-scoped APIs; keep dismissible alerts as local preferences only if labeled as device-local. Avoid marking synthetic tasks “done” as if a CRM task transitioned.
3. **Tenant query boundary (finding 0016).** Add companyId-scoped claim repository reads and test identical not-found behavior for absent/cross-company IDs. Repeat for other high-risk services found through query-path review.
4. **Outbox/claim event semantics.** Audit every caller of `OutboxService.publish`; this pass found no direct service call in API source. Remove the unused escape hatch if no runtime callers exist, or constrain it to non-transactional events and ensure business mutations use `recordEvent(tx, ...)`.
5. **Money API contract.** Decide whether all monetary API fields are integer minor units or decimal strings. Validate rounding and equality at the boundaries and document the contract before changing serialization.

**Phase B gate:** No consequential button reports success without a persisted operation; cross-tenant negative tests pass; financial and outbox paths have failure-injection coverage.

### Phase C — Normalize environments and operations

1. **Runtime version (finding 0015).** Select a supported Node major and store it once (`.nvmrc`/`.node-version`); align test, build, deploy, Dockerfiles and CI runners.
2. **Staging environment mode.** Add an explicit staging configuration or require production-strength secrets whenever staging is deployed. Verify `NODE_ENV`/Zod validation and startup behavior; do not run a staging system with development defaults.
3. **Secret controls (finding 0018).** Enable hosted push protection/secret scanning and add a maintained scanner in CI with secret-safe logging. Scan Git history under an authorized secret-handling procedure; rotate any exposed values.
4. **Backups and rollback (findings 0003/0004).** Set and approve RPO/RTO; automate encrypted offsite database backups; verify object-storage versioning; restore into isolation; use forward-compatible expand/contract migrations and preserve a rollback artifact. Prisma migrations need not all contain `down.sql`, but every deployment needs a tested recovery path.
5. **Deployment safety (finding 0003).** Gate production promotion on an approved immutable artifact, migration preflight, health/readiness probe and smoke tests. Retain previous artifact and rollback procedure; verify host-side protection/approval settings.
6. **Runbook (finding 0006).** Correct service/container names and test each listed endpoint/command in staging. Capture queue retry, Redis outage, DB outage, failed migration and restore procedures.
7. **Observability.** Replace production-path console output with structured logger context for provider/migration events; verify metrics, alerts and on-call ownership.

**Phase C gate:** Staging deploy, smoke suite, migration upgrade, rollback/recovery drill, backup restore and runbook rehearsal all produce dated evidence.

### Phase D — Repair CI and certify

1. Fix the workflow test invocation (finding 0017) by removing the extra separator; run API, certification/security, web and E2E jobs using the exact workflow commands.
2. Add contract tests for the resolved findings and live two-company API authorization cases. Ensure no suite is skipped or marked `passWithNoTests` for required test paths.
3. Apply migrations to an empty database and an upgraded production-like snapshot; verify migration checksums. Resolve edited historical migrations with forward migrations where any target DB has already applied the originals.
4. Run the complete golden path: login → lead → quote → inspection → documents → payment → issuance → policy → renewal. Include failure recovery and role-separated approvals.
5. Run agreed load/soak scenarios and performance measurements; reconcile dashboards/reports against database truth.
6. Reconcile all G1–G20 exit criteria and the supplied audit’s findings against current evidence. Regenerate release evidence only from real executed gates; invalidate stale artifacts and require authorized security/operations sign-off.

**Final release gate:** zero unresolved P1s; P2s accepted by named owners with rationale; all binding gates have current evidence; certificate commit/schema/image/test-run identities match the actual release artifact; staging and recovery evidence are approved. Until then, status remains **NOT CERTIFIED FOR PRODUCTION**.

## 3. System inventory (repository-visible)

| Area | Observed in checkout | Runtime verification |
|---|---|---|
| Applications | `apps/api` (NestJS/Prisma), `apps/web` (Next.js/React) | Build/tests only; deployed processes not inspected |
| Data | PostgreSQL 16 in Compose; Prisma schema/migrations | Schema validates; production DB/table data not inspected |
| Cache/queues | Redis 7 in Compose; BullMQ is used by API | No live Redis or queue failure test |
| Storage | API code and environment docs mention MinIO/S3; root Compose has no storage service | Bucket/IAM/versioning unverified |
| Deployment | Kubernetes manifests, two Compose files, GitHub deploy workflow, Dockerfiles | No cluster/cloud credentials; no staging deployment |
| CI/security | CI, PR checks, production remediation workflow, CodeQL workflow | Workflow definitions inspected, hosted execution history unavailable |
| Integrations | Payment/webhook and insurer/provider code paths present | Provider accounts/signatures/replay behavior not exercised live |
| Git | `main` plus local and remote branches; current HEAD recorded above | Remote PRs, deleted refs, server-side branch rules unavailable |

This is a repository inventory, not a complete infrastructure inventory. DNS/CDN/API gateway/IAM/secrets manager/cloud resources, production containers/images, hosted CI logs, and backup stores were not accessible.

## 4. Verification performed

| Check | Result | What it establishes / does not establish |
|---|---|---|
| API unit suite | 113 suites passed; 799 passed, 1 skipped (800 total) | Unit behavior for covered tests; one DB test skipped; no live HTTP/auth evidence |
| API certification/security suite | 16 suites passed; 241 tests passed | Test correctness for included scenarios; does not cover every role/resource or prove live deployment behavior |
| Web tests | 4 files passed; 9 tests passed | Component/unit behavior; not full browser journey |
| API build | PASS | TypeScript/Nest build only |
| Prisma schema validate | PASS | Prisma schema is syntactically valid; no migration deployment |
| Tenant scanner | PASS, 56 controllers | Heuristic scan only; see finding 0005 |
| Mock-data scanner | PASS, 679 production source files scanned | Only enumerated regex patterns, not proof all production data is live |
| `git diff --check` | PASS | No whitespace errors |
| Certification verifier | FAIL | Working-tree schema hash differs from certificate; validator could not resolve Git history from its child process. This does not prove committed `main` has a hash mismatch |
| CI command reproduction | FAIL with extra `--`; PASS without it | The workflow form made Jest treat `--runInBand` as a test path (0 of 16 matched suites); corrected form ran 16/16 suites, 241/241 tests |
| Dedicated PostgreSQL inspection journey | SKIPPED | `E2E_DATABASE_URL` was absent; no persisted test result this turn |
| Production browser/API, staging smoke, restore drill, performance/load | NOT RUN | Required target environments/data/credentials unavailable |

## 5. Coverage and traceability certificate

This is an evidence-bounded audit. Statuses below prevent static inspection from being mistaken for runtime verification.

| Audit area requested | Status | Evidence / gap |
|---|---|---|
| System discovery and repository inventory | PARTIAL | Two apps, data services, infra manifests and workflows inventoried; external/cloud resources unavailable |
| Git/code archaeology | PARTIAL | Current history/branches inspected; no full historical secret scan, PR/revert review, or remote branch content comparison. The checkout has extensive uncommitted changes, including a migration CLI refactor, so findings apply to this working tree |
| Requirements and documentation traceability | PARTIAL | Exit criteria, architecture, runbook, role matrix, gap register reviewed; no requirement-by-requirement P0/P1 trace matrix was available |
| Threat model / STRIDE / insurance abuse | NOT VERIFIED | No complete asset-flow workshop or adversarial abuse tests run |
| Web input attacks (injection, XSS, SSRF, upload, CSRF, headers) | NOT VERIFIED | Source checks/tests do not prove attack resistance; no DAST/live requests |
| Authentication/session/token lifecycle | NOT VERIFIED | No credentialed login/deactivation/refresh/revocation testing |
| Authorization/RBAC/BOLA/IDOR | PARTIAL | Unit/security test files and tenant-scoping gate exist; no exhaustive role × resource × action HTTP matrix |
| Tenant isolation and data flow | PARTIAL | Static scanner passed; high-risk query paths not all exercised across two real tenants |
| Privacy, retention, deletion and offboarding | NOT VERIFIED | No production storage/log/backup/browser data reconciliation |
| Database schema and migration behavior | PARTIAL | Prisma schema validates; no old/new app compatibility, rollback, partial-failure, production-scale or deployed checksum test |
| Transactional integrity and concurrency | PARTIAL | Unit tests exist; no broad fault-injection/concurrent DB run for all workflows |
| State machines and event/queue contracts | PARTIAL | Motor inspection unit tests and 44 focused motor-service tests pass; other workflows and live queue behavior not covered here |
| Performance, capacity, cost and scale | NOT VERIFIED | No realistic data volume, load, stress, spike or soak run |
| Backups, restore and disaster recovery | NOT VERIFIED | No backup inventory or restore drill; release checklist itself leaves these gates open |
| Cloud/IAM/container/DNS/CDN | NOT VERIFIED | No cloud account access; static manifests only |
| CI/CD/supply chain/secrets | PARTIAL | Workflows/config inspected; no hosted execution history, image scan, secret-history scan, or GitHub protection settings |
| User journeys, UI truth, accessibility | PARTIAL | Web tests pass; no role-based browser session or accessibility audit across full journeys |
| Support/admin/bulk/export/incident operations | PARTIAL | Docs and route inventory reviewed; no live admin/export/bulk/incident recovery exercise |
| Code quality/redundancy/dead code | PARTIAL | Whole-repository surface reviewed in this pass; no complete symbol-level unused-code/dependency proof |
| Second-pass/root-cause propagation | PARTIAL | Redis exposure searched across Compose/Kubernetes; no full propagation audit for every possible finding pattern |

### Required coverage counts

- **Files inspected:** Selected architecture, security, deployment, CI, migration, Prisma schema, runbook, release and source/test files; not every repository file.
- **Files not inspected:** The majority of individual source files and historical versions; no full line-by-line audit.
- **Endpoints discovered:** Controller/route inventories exist; exact exhaustive endpoint count and live tested endpoint count were not established in this audit.
- **Endpoints tested live:** 0.
- **Controllers scanned:** 56 by the repository tenancy checker.
- **Modules/apps discovered:** API and web applications; runtime worker separation not proven.
- **Database tables inspected live:** 0 in production/staging; only schema source validated.
- **User roles tested live:** 0. Unit fixtures cover selected roles but do not establish live authorization.
- **User flows verified live:** 0.
- **Security attacks executed live:** 0.
- **Infrastructure components verified live:** 0.
- **Automated tests executed this audit:** 113 API suites (799 pass, 1 skip), 16 API certification/security suites (241 pass), and 4 web files (9 pass); build, Prisma validate, tenancy/mock scanners. Historical Playwright result was not repeated as a live app run.
- **Target environments verified:** Local checkout/tooling only. Production and staging not verified.

## 6. Required actions before production approval

1. Remove/restrict unauthenticated Redis host exposure in both Compose configurations.
2. Mark this working-tree certificate check failed; reconcile the conflicting readiness artifacts and every G16–G20 gate using current evidence before release.
3. Add health-gated deploy completion and a tested rollback path; enforce approval in the hosting platform.
4. Confirm applied migration history on each target database; do not rewrite migrations already applied in any environment.
5. Make the legacy motor reconciliation safe to dry-run, transactional/resumable, and fault-tested on a restored snapshot.
6. Run the inspection journey against the dedicated PostgreSQL database, then run full API/web/browser golden paths in staging with realistic role accounts.
7. Execute two-tenant HTTP authorization tests, restore a real backup in an isolated environment, validate storage/versioning, and run performance tests at agreed data volumes.
8. Correct the runbook’s worker/container and endpoint names; rehearse the procedures.

## 7. Over-engineering review (Ponytail)

No additional delete/simplify recommendation is included without stronger usage evidence. The current working tree already removes several previously unreferenced workspace packages; this audit did not treat their deletion as proof of functional completeness. The tenancy and mock-data scanners are deliberately narrow controls: replace their *claims* with appropriately scoped evidence rather than deleting a useful heuristic.

## Final assessment

**Production readiness: FAIL / NOT VERIFIED.** The certificate cannot certify this modified working tree because its schema hash differs; this does not prove the committed `main` schema has a mismatch. Binding release and recovery gates remain unchecked, Redis host exposure is unsafe by default, and live application/data-plane verification is absent. Passing unit tests and builds do not close these blockers.

## Implementation follow-up — 2026-10-03

The repository changes below address the listed findings in the current working tree. They are not yet deployed or verified in production. This section supersedes earlier statements for the named code findings only.

### Implemented in source; local regression checks are listed below

- **0001 Redis host exposure:** both Compose configurations bind host port 6380 to `127.0.0.1` only. Runtime firewall/service exposure still needs deployment review.
- **0002 release-certificate contradiction:** the checked-in certificate and 25 evidence records are now explicitly withdrawn, retaining their historical PASS results and recording that they are not current release approval. Synthetic evidence generation now refuses to write records, and certification tests check the withdrawn state. New independent evidence is still required for G16–G20.
- **0003 deploy health gate:** deploy now selects a GitHub Environment, performs a readiness probe after restart, and fails if readiness does not recover. Hosted Environment protection rules, a tested rollback path, backup/restore, and staging deployment remain unverified.
- **0004 migration history:** the current working tree has no modified files under `apps/api/prisma/migrations`; target database checksum/history still must be inspected before rollout.
- **0005 tenant-scanner claim:** scanner output and CI step names now explicitly call this a heuristic controller scan, not proof of complete tenant isolation. Direct portal queries now carry an explicit company filter; focused tests cover portal query scope and changed task, payment, and customer flows. Full HTTP two-company coverage remains open.
- **0006 operations runbook:** queue service, retry route, and health references were corrected against the checked-in application topology. A live rehearsal remains open.
- **0007 motor reconciliation:** CLI now defaults to dry-run and requires `--apply` for writes; service applies execute transactionally and check invariants. Unit coverage passes, but disposable-PostgreSQL fault injection and restore rehearsal remain open.
- **0008 terminal claim updates:** the generic PATCH path now rejects CLOSED claims; claim reads for GET/PATCH and other controller commands constrain lookup by the caller company before hydrating relations.
- **0009 unsigned provider webhook:** the public gateway now accepts Razorpay only; Twilio and other providers are rejected until a verifier is implemented. Nest captures raw request bytes and Razorpay HMAC verification uses those bytes. Timestamp replay checks run when a timestamp header is supplied (malformed/stale values are rejected); event-ID idempotency remains active when the provider omits it. Live Razorpay delivery still needs staging verification.
- **0010 premium rounding:** OD premium now uses integer arithmetic and positive half-up rounding. A regression case covers the 3,000,000 IDV boundary that previously returned 107,881 instead of 107,882.
- **0011 receipt/payment flow:** finance now records invoice payments through a tenant-scoped API, validates input, persists allocation/receipt records, and refreshes the register. Receipt exports use an authenticated API. Payment-register export remains unavailable and is disabled; live finance reconciliation was not run.
- **0012 report/voucher downloads:** reports use the API-backed export and browser download flow. Voucher PDF export is clearly unavailable and disabled; preview copy no longer implies issuance or ledger posting. Browser download behavior still needs staging/browser verification.
- **0013 no-op numbering Save:** removed from the read-only numbering page.
- **0014 customer notes/alerts/tasks:** notes use a tenant-scoped API. Customer-linked suggestions can create persistent tasks; task create/list/complete and linked customer/policy/claim/lead/assignee validation are tenant-scoped. Local alert dismissal is no longer presented as authoritative task completion. Cross-tenant regression tests pass.
- **0015 Node version mismatch:** CI, deploy build, and API/web container stages now use Node 24; `.node-version` records the selected major.
- **0016 cross-tenant claim hydration:** claim reads and mutations now scope the claim lookup to the caller's company before loading related records.
- **0017 broken workflow invocation:** removed the extra `--` from both remediation workflow test commands.
- **0018 secret scanning:** pinned Gitleaks scans are configured in CI/deploy workflows; remote execution is still pending.
- **0019 supplied arithmetic example:** corrected the report: the supplied 500,000-IDV example does not reproduce a rounding error; the separate 3,000,000-IDV boundary does.
- **Migration safety:** `scripts/motor-migration-01.ts` now defaults to dry-run; writes require explicit `--apply`.

### Still open; needs additional implementation or environment access

- **0001 runtime exposure:** verify host firewall/network policy and Redis access on the deployed hosts.
- **0002/0004 certification and migration history:** the false readiness claim is withdrawn; reconcile schema and checksums against each real target DB and replace it only with independent current release evidence. No target DB was inspected or migrated.
- **0003/0006 deployment and operations:** health-gated configuration and runbook corrections are in source; hosted approval rules, immutable rollback, staging deployment, restore rehearsal, and live runbook rehearsal remain unverified.
- **0005 tenant isolation:** expand the focused regressions to a two-company HTTP matrix for high-risk read, mutation, export, document, approval, and reporting paths; the scanner is a heuristic only.
- **0007 migration recovery:** transactionality is implemented, but database fault injection, financial reconciliation, and restore rehearsal have not been performed against disposable PostgreSQL.
- **0009 webhook runtime behavior:** live Razorpay signature, secret configuration, retry, replay, and event-processing checks still need staging verification.
- **0012 exports:** report and receipt downloads are API-backed in source; voucher PDF and payment export remain unavailable. Verify the available download flows in a browser against staging.
- **0018 secret scanning:** pinned Gitleaks checks are configured in CI/deploy workflows; the hosted runs and organization policy have not been verified.
- **Production gates:** no staging credentials, live provider secrets, or production database were available, so deployment, live integrations, backup restore, human UAT, and certification remain NOT VERIFIED.

The code changes are not deployed. No finding should be treated as production-closed solely from these local checks.

### Local verification results for this follow-up

- Targeted API regressions: **4 suites, 36 tests passed**, covering tasks, withdrawn certification state, payment tenant scoping, and migration safety.
- Portal tenant-scope regression: **1 suite, 2 tests passed**, including scoped portal reads/payments and POST quotation argument order.
- API and web TypeScript checks: passed after the latest source changes.
- Full API suite: **114 suites passed, 811 tests passed, 1 DB-dependent suite/test skipped** (requires `E2E_DATABASE_URL`).
- Web tests: **4 files passed, 9 tests passed**.
- Tenant-scoping heuristic passed (56 controllers scanned) and production mock-data guard passed (682 files scanned); neither proves complete isolation or production behavior.
- `git diff --check`: passed after the source, test, workflow, certification, and report edits.
- Certification verifier intentionally exits nonzero because the certificate is withdrawn, its recorded gates do not prove current readiness, and the working-tree commit/schema do not match the historical certification. This is the required release block, not a claim of current release approval.
- The prior full API run exposed a missing task-query `AND`, stale certificate expectation, motor status-array typing, and malformed agent-claim scope syntax. All were corrected; targeted task/certification/payment/migration tests (36 tests), affected motor tests (44 tests), and the portal tenant-scope tests (2 tests) pass.

These are source-level checks only. They do not verify production behavior, Docker service reachability, provider signatures against live Razorpay deliveries, target database migration safety, deployment rollback, hosted approval settings, or backup restoration. The release certificate remains deliberately withdrawn.
