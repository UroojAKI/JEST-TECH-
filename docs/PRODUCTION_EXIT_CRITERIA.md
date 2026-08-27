# PRODUCTION EXIT CRITERIA — JEST POLICY CRM
# Version: 1.0.0 | Status: BINDING | Branch: production-remediation
# These are binary gates. FAIL on any single gate = NO RELEASE.

---

## G1 — SECURITY
- [ ] 0 P0 vulnerabilities
- [ ] 0 unresolved BOLA/IDOR failures (automated test suite)
- [ ] 0 cross-customer data leakage (automated test suite)
- [ ] 0 production default credentials (JWT secret, DB password, MinIO password)
- [ ] 0 unauthorized policy issuance paths
- [ ] 0 privilege escalation paths

## G2 — AUTHORIZATION
- [ ] Agent A cannot read Agent B's leads/quotes/policies/documents
- [ ] Finance cannot issue policy
- [ ] Finance cannot modify quotation pricing
- [ ] Back Office cannot alter payment reconciliation
- [ ] Renewal Executive cannot modify issued policy financial values
- [ ] All 15 cross-role abuse scenarios pass (automated)

## G3 — DATA INTEGRITY
- [ ] All state machine transitions enforced server-side
- [ ] No entity can bypass IssuanceEligibilityGate
- [ ] Payment idempotency (duplicate reference → 409)
- [ ] Quote version acceptance (only 1 ACCEPTED per group)
- [ ] InsurerPolicyDetail required before Policy → ACTIVE

## G4 — FINANCIAL
- [ ] Underpayment (₹1 against ₹50,000) → blocked
- [ ] Overpayment → approval workflow triggered
- [ ] Duplicate payment reference → blocked
- [ ] Payment against wrong quotation → blocked
- [ ] Premium variance > threshold → approval required
- [ ] All financial mutations in AuditLog

## G5 — WORKFLOW CONTINUITY
- [ ] Lead → Quote → Payment → Issuance → Policy → Renewal → Claim
- [ ] Executable from clean environment with no database manipulation
- [ ] All handoff queues updated at each transition
- [ ] No manual database intervention required

## G6 — INSPECTION
- [ ] Break-in case automatically creates Inspection record
- [ ] Inspection with 7 photos → APPROVED → issuance gate unblocked
- [ ] Inspection bypass attempt → blocked
- [ ] Inspection REJECTED → re-inspection workflow triggered

## G7 — DOCUMENTS
- [ ] Upload ≠ Verified (verified by authorized actor required)
- [ ] All documents linked to entity (no orphans)
- [ ] Rejected document → re-upload workflow triggered
- [ ] All required documents VERIFIED before issuance

## G8 — RENEWAL
- [ ] renewalDueDate = MIN(odEndDate, tpEndDate) from InsurerPolicyDetail
- [ ] Renewal tasks created at 45/30/15/7/1/0/-1 day offsets
- [ ] Scheduler is idempotent (duplicate run = no duplicate tasks)
- [ ] Renewal queue visible by bucket in Renewal workspace
- [ ] Renewal completion links new policy to original

## G9 — CLAIMS
- [ ] Claim against inactive policy → blocked
- [ ] Claim with incidentDate outside policy period → blocked
- [ ] Duplicate claim → blocked
- [ ] Claims state machine enforced end-to-end

## G10 — UI TRUTH
- [ ] 0 hardcoded business data in production screens
- [ ] 0 dead-end KPIs (every KPI is clickable)
- [ ] 0 unexplained or orphaned status values
- [ ] 0 mock/dummy/sample data in production components
- [ ] All loading, empty, and error states implemented

## G11 — DASHBOARD ACTIONS
- [ ] Every KPI number navigates to filtered real data
- [ ] Dashboard metrics computed by SQL aggregation (not Node in-memory)
- [ ] Dashboard p95 load < 2 seconds

## G12 — AUDIT
- [ ] All consequential actions produce AuditLog entries
- [ ] AuditLog is append-only (no UPDATE/DELETE)
- [ ] AuditLog contains: actor, action, entity, entityId, before, after, timestamp, IP, requestId

## G13 — CONCURRENCY
- [ ] Two simultaneous payment submissions for same quotation → one succeeds, one 409
- [ ] Two simultaneous issuance requests for same case → one succeeds, one 409
- [ ] Renewal scheduler multi-pod → no duplicate tasks
- [ ] Optimistic locking prevents last-write-wins data corruption

## G14 — PERFORMANCE
- [ ] CRUD operations p95 < 300ms
- [ ] Dashboard load p95 < 2 seconds
- [ ] All list APIs paginated (no unbounded queries)
- [ ] No SELECT * with 10,000 row processing in Node

## G15 — CI/CD
- [ ] Build failure blocks merge
- [ ] Test failure blocks merge
- [ ] Security test failure blocks merge
- [ ] Migration validation runs in CI
- [ ] No simulated/skipped test steps in pipeline

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
