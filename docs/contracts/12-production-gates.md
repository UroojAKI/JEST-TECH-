# 12 — PRODUCTION GATES
# JEST POLICY CRM — Engineering Contract
# Version: 2.0.0 | Status: BINDING | Last updated: 2026-08-27
# GATE FAILURE = RELEASE BLOCKED. No exceptions. No partial passes.

---

## RELEASE ORDER

R0  Contract freeze         ← current
R1  Authentication + ActorContext
R2  Authorization + ownership + multi-user isolation
R3  Customer + Lead + deduplication
R4  Motor data completion + prefill
R5  Quotation + versioning + pricing + addons
R6  Inspection + documents
R7  Payment + Finance workspace
R8  Issuance + Back Office workbench
R9  Policy + insurer details + activation
R10 Renewal engine
R11 Claims
R12 Customer 360 + Management dashboards
R13 Audit + observability + resilience
R14 Security + abuse + concurrency certification
R15 Production deployment rehearsal
R16 PRODUCTION

---

## RELEASE GATE CHECKLIST

### Gate A — Security
- [ ] 0 P0 vulnerabilities
- [ ] 0 BOLA/IDOR failures in automated suite (all 15 scenarios)
- [ ] 0 cross-customer/cross-org/cross-branch data leakage
- [ ] 0 production default credentials (JWT, DB, MinIO, Redis)
- [ ] 0 unauthorized policy issuance paths

### Gate B — Authentication
- [ ] Login returns correct ActorContext for all 16 role types
- [ ] Session refresh works; expired refresh → /login
- [ ] Role-based workspace routing verified for all roles
- [ ] Unauthorized direct URL access → /unauthorized
- [ ] Account deactivation blocks login immediately

### Gate C — Ownership
- [ ] Agent A cannot read Agent B's leads/quotes/policies/documents
- [ ] Team Alpha cannot read Team Beta's records (same branch)
- [ ] Branch A cannot read Branch B's records without explicit permission
- [ ] Finance cannot modify quotation pricing
- [ ] Renewal Executive cannot modify issued policy financial values

### Gate D — Data Integrity
- [ ] All state transitions enforced server-side (state machine tests)
- [ ] Gate A (READY_FOR_ISSUANCE): no insurer data required
- [ ] Gate B (ISSUED): all insurer data required before activation
- [ ] Duplicate policy (same vehicle+period) → 409
- [ ] QuotationVersion: only one ACCEPTED per group

### Gate E — Financial
- [ ] ₹1 payment against ₹50,000 quote → 422 UNDERPAYMENT
- [ ] Duplicate transactionReference → 409 DUPLICATE_REFERENCE
- [ ] Payment against wrong quotation → 422 WRONG_QUOTATION
- [ ] Overpayment → approval workflow triggered, not auto-accepted
- [ ] Premium variance > threshold → requires approval before ISSUED

### Gate F — Workflow Continuity
- [ ] Lead → Quote → Payment → Issuance → Policy → Renewal → Claim
- [ ] Executable from clean environment, no DB intervention
- [ ] Every department queue updated at each handoff
- [ ] Transactional outbox: no handoff dropped on pod restart

### Gate G — Inspection
- [ ] Break-in case → inspection created atomically with quotation state
- [ ] 7/7 photos submitted → APPROVED → Gate A unblocked
- [ ] Inspection bypass attempt → 422 INSPECTION_REQUIRED
- [ ] Rejected → reassignment workflow created

### Gate H — Documents
- [ ] UPLOADED ≠ VERIFIED enforced everywhere
- [ ] No orphan documents (all linked to entity)
- [ ] Rejected document → re-upload workflow
- [ ] Gate A checks all required docs = VERIFIED

### Gate I — Renewal
- [ ] renewalDueDate = MIN(odEndDate, tpEndDate) from InsurerPolicyDetail
- [ ] Renewal tasks created at 45/30/15/7/1/0/-1 offsets
- [ ] Scheduler idempotent: UNIQUE(policyId, offsetDays) enforced
- [ ] Renewal queue visible by bucket
- [ ] Completed renewal links new policy to original

### Gate J — Claims
- [ ] Claim against inactive/expired policy → eligibility gate blocks
- [ ] incidentDate outside coverage period → blocked
- [ ] Duplicate claim (same incident+type) → 409

### Gate K — Handoffs
- [ ] Every department queue updated synchronously in same transaction (via outbox)
- [ ] No case silently stuck between departments
- [ ] SLA timer starts when record enters new queue

### Gate L — UI Truth
- [ ] 0 hardcoded business arrays in production screens
- [ ] 0 dead-end KPI cards
- [ ] All KPIs navigate to filtered real data endpoint
- [ ] Loading, empty, and error states implemented for all data-driven components
- [ ] Frontend truth audit: 0 REAL_DATA_BUG items open

### Gate M — Multi-user
- [ ] All 25 UAT personas complete their assigned scenarios
- [ ] No scenario requires workaround or manual DB fix
- [ ] Concurrent users on same case: optimistic lock conflict handled correctly

### Gate N — Audit
- [ ] All mandatory events in AuditLog (see contract 10)
- [ ] AuditLog is append-only (DB constraint verified)
- [ ] Each entry is in same transaction as business mutation
- [ ] PII masked in before/after fields

### Gate O — Resilience
- [ ] Idempotency: duplicate payment request → same result, not duplicate
- [ ] Concurrent issuance: one succeeds, one 409
- [ ] Multi-pod renewal scheduler: no duplicate tasks
- [ ] Pod restart mid-outbox: event eventually delivered

### Gate P — Deployment
- [ ] Real DB migration applied (not simulated)
- [ ] Migration rollback script tested
- [ ] Staging deployment verified
- [ ] Smoke test passes on staging

### Gate Q — Observability
- [ ] Prometheus /metrics endpoint returning request duration histograms
- [ ] Alert rules configured: payment failures, issuance failures, renewal job failures
- [ ] Structured logs: every request has correlationId, actorId, entity, duration, result

### Gate R — E2E Golden Path
- [ ] Full automated E2E test passes:
     Login → Lead → Complete → Inspect → Quote → Accept → Pay → Reconcile → Verify Docs → Issue → Insurer Data → Activate → Renewal Task → Renew
- [ ] Test uses realistic seeded data, no DB manipulation
- [ ] Failure scenarios tested (see contracts)

---

## PER-RELEASE EXIT GATE

A release is approved only when all gates relevant to that release are passing.
Partial gates are not acceptable.

| Release | Required Gates |
|:--------|:---------------|
| R1      | B              |
| R2      | A, C           |
| R3      | C, D (lead)    |
| R4      | L (prefill)    |
| R5      | D (quotation), E (partial) |
| R6      | G, H           |
| R7      | E (full)       |
| R8      | K (partial)    |
| R9      | D (policy), I (partial) |
| R10     | I (full)       |
| R11     | J              |
| R12     | L, M (partial) |
| R13     | N, O, Q        |
| R14     | A, B, C, O, R  |
| R15     | P, R           |
| R16     | ALL GATES      |
