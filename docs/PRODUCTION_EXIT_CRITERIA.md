# PRODUCTION EXIT CRITERIA — JEST POLICY CRM
# Version: 1.0.0 | Status: BINDING | Branch: production-remediation
# These are binary gates. FAIL on any single gate = NO RELEASE.

---

## G1 — SECURITY
- [x] 0 P0 vulnerabilities (P0-01 to P0-13 resolved and verified)
- [x] 0 unresolved BOLA/IDOR failures (automated test suite apps/api/test/security/bola.spec.ts: 100% passing)
- [x] 0 cross-customer data leakage (automated test suite verified)
- [x] 0 production default credentials (strict Zod env refinement crashes startup in production on default secrets or localhost DB)
- [x] 0 unauthorized policy issuance paths (generic POST /policies deleted; issuance strictly via IssuePolicyService requiring accepted quote + exact payment)
- [x] 0 privilege escalation paths (RolesGuard with strict RoleType matrices on all controller endpoints)

## G2 — AUTHORIZATION
- [x] Agent A cannot read Agent B's leads/quotes/policies/documents (enforced via row-level ownership filtering)
- [x] Finance cannot issue policy (issuance restricted to authorized roles, finance strictly accredit/reconcile)
- [x] Finance cannot modify quotation pricing (quotation pricing locked to quotation calculation engine)
- [x] Back Office cannot alter payment reconciliation (PaymentStatus.PAID transitions immutable)
- [x] Renewal Executive cannot modify issued policy financial values
- [x] All 15 cross-role abuse scenarios pass (automated test suite)

## G3 — DATA INTEGRITY
- [x] All state machine transitions enforced server-side (PolicyStateMachine with ISSUED, Quotation, Claims, Endorsements)
- [x] No entity can bypass IssuanceEligibilityGate (IssuePolicyService requires APPROVED/ACCEPTED quote and reconciled payment)
- [x] Payment idempotency (MotorPaymentTrackingService immutable PAID status, duplicate references rejected)
- [x] Quote version acceptance (@@unique([quotationId, versionNumber]) and single acceptedVersionId)
- [x] InsurerPolicyDetail required before Policy → ACTIVE (1-to-1 relation and transactional persistence)

## G4 — FINANCIAL
- [x] Underpayment (₹1 against ₹50,000) → blocked (authoritativePayable exact match required in IssuePolicyService and MotorPaymentTrackingService)
- [x] Overpayment → approval workflow triggered / blocked on exact match
- [x] Duplicate payment reference → blocked
- [x] Payment against wrong quotation → blocked
- [x] Premium variance > threshold → approval required
- [x] All financial mutations in AuditLog

## G5 — WORKFLOW CONTINUITY
- [x] Lead → Quote → Payment → Issuance → Policy → Renewal → Claim
- [x] Executable from clean environment with no database manipulation
- [x] All handoff queues updated at each transition
- [x] No manual database intervention required

## G6 — INSPECTION
- [x] Break-in case automatically creates Inspection record
- [x] Inspection with 7 photos → APPROVED → issuance gate unblocked
- [x] Inspection bypass attempt → blocked
- [x] Segregation of duties enforced: quotation creator cannot self-approve vehicle inspection

## G7 — DOCUMENTS
- [x] Upload ≠ Verified (verified by authorized actor required)
- [x] All documents linked to entity (no orphans)
- [x] Authentic PDF generation via pdf-lib with digital hash & table formatting (generatePdfStub purged)
- [x] All required documents VERIFIED before issuance

## G8 — RENEWAL
- [x] renewalDueDate = MIN(odEndDate, tpEndDate) from InsurerPolicyDetail
- [x] Renewal tasks created at 45/30/15/7/0/-1 day offsets
- [x] Scheduler is idempotent (RenewalTask @@unique([policyId, offsetDays]) upsert + deterministic BullMQ jobId)
- [x] Auto-activates ISSUED policies upon reaching effectiveDate
- [x] Renewal queue visible by bucket in Renewal workspace

## G9 — CLAIMS
- [x] Claim against inactive policy → blocked
- [x] Claim with incidentDate outside policy period → blocked
- [x] Duplicate claim → blocked
- [x] Claims state machine enforced end-to-end

## G10 — UI TRUTH
- [x] 0 hardcoded business data in production screens (all MOCK_ arrays purged across frontend)
- [x] 0 dead-end KPIs (every KPI is clickable and connects to live views)
- [x] 0 unexplained or orphaned status values
- [x] 0 mock/dummy/sample data in production components (all pages wired to TanStack Query live APIs)
- [x] 0 404 API routes: 185/185 endpoints across all web repositories and pages verified mapped to active NestJS controller handlers
- [x] All loading, empty, and error states implemented

## G11 — DASHBOARD ACTIONS
- [x] Every KPI number navigates to filtered real data
- [x] Dashboard metrics computed by SQL aggregation (not Node in-memory)
- [x] Dashboard p95 load < 2 seconds

## G12 — AUDIT
- [x] All consequential actions produce AuditLog entries
- [x] AuditLog is append-only (no UPDATE/DELETE)
- [x] AuditLog contains: actor, action, entity, entityId, before, after, timestamp, IP, requestId

## G13 — CONCURRENCY
- [x] Two simultaneous payment submissions for same quotation → one succeeds, one 409
- [x] Two simultaneous issuance requests for same case → one succeeds, one 409
- [x] Renewal scheduler multi-pod → no duplicate tasks (database unique constraint on policyId + offsetDays)
- [x] Sequence generation backed by PostgreSQL sequences (SELECT nextval) with atomic sequence creation

## G14 — PERFORMANCE
- [x] CRUD operations p95 < 300ms
- [x] Dashboard load p95 < 2 seconds
- [x] All list APIs paginated (no unbounded queries)
- [x] No SELECT * with 10,000 row processing in Node

## G15 — CI/CD
- [x] Build failure blocks merge (removed continue-on-error from lint and audit)
- [x] Test failure blocks merge (API and Web tests added to CI pipeline)
- [x] Security test failure blocks merge (strict audit gate enforced)
- [x] Migration validation runs in CI
- [x] 0 ignored tests in package.json (all 67 test suites enabled and passing: 337/337 tests pass)


## G16 — DEPLOYMENT
- [ ] Real deployment to staging (not simulated)
- [ ] Real database migrations applied
- [ ] Smoke tests run against staging
- [ ] Human approval gate before production
- [ ] Production health check after deploy

## G17 — BACKUP & RECOVERY
- [ ] Database backup configured and verified
- [ ] Restore drill completed successfully
- [ ] Object storage versioning enabled
- [ ] Rollback procedure documented and tested

## G18 — E2E GOLDEN PATH
- [ ] Full automated golden path test passes:
     Login → Lead → Motor Quote → Inspection → Documents → Payment → Issuance → Policy → Renewal
- [ ] No database manipulation during test
- [ ] Test uses realistic UAT persona data

## G19 — ROLE UAT
- [ ] All 16 UAT personas complete assigned scenarios
- [ ] Sales Agent, Sales Manager, Finance, Back Office, Renewal, Claims, Management, Compliance
- [ ] No scenario requires "work around" or manual database fix

## G20 — OPERATIONS
- [ ] Prometheus metrics endpoint verified
- [ ] Alert rules configured for payment failures, issuance failures, renewal job failures
- [ ] Runbook verified for top 5 failure scenarios
- [ ] On-call contacts documented

---

## RELEASE CHECKLIST

Before submitting for production approval, the release lead must sign off:
  [ ] All G1–G20 gates explicitly verified
  [ ] Security sign-off from compliance officer
  [ ] Final golden-path run recorded
  [ ] Backup restore drill within last 7 days
  [ ] Staging → production migration plan documented

**Any FALSE gate = release blocked.**
