# 11 — IDEMPOTENCY CONTRACT
# JEST POLICY CRM — Engineering Contract
# Version: 1.0.0 | Status: BINDING | Last updated: 2026-08-27

---

## REQUIRED ON ALL CRITICAL MUTATIONS

The following endpoints MUST support idempotency:

  POST /payments                   (payment creation)
  POST /payments/:id/reconcile     (reconciliation)
  POST /inspections                (inspection creation)
  POST /inspections/:id/submit     (photo submission)
  POST /policies/issue             (policy issuance)
  POST /renewals/tasks             (renewal task creation — also idempotent via DB constraint)
  POST /claims                     (claim submission)
  POST /leads/:id/assign           (assignment)

---

## IDEMPOTENCY KEY MECHANISM

Client sends:
  Idempotency-Key: <client-generated UUID>

Server behavior:
  1. Check Redis: key exists?
     - If YES + in-flight (value = "PROCESSING"):
       Return 409 with { error: "IDEMPOTENCY_CONFLICT" }
     - If YES + completed (value = cached response):
       Return cached response with header X-Cache-Lookup: HIT
  2. If NO:
     - Store key = "PROCESSING" with TTL = 60s
     - Execute operation
     - On success: cache full response, TTL = 24h
     - On error: delete key (allow retry)

---

## DB-LEVEL IDEMPOTENCY (defense in depth)

These unique constraints enforce idempotency even if Redis is unavailable:

  PaymentRecord:          UNIQUE(transactionReference)
  Policy:                 UNIQUE(insurerPolicyNumber)
  Policy:                 UNIQUE(vehicleId, odStartDate, odEndDate) — partial index
  RenewalTask:            UNIQUE(policyId, offsetDays)
  Claim:                  UNIQUE(policyId, incidentDate, claimType)
  Inspection:             UNIQUE(quotationGroupId) — one per group

If a DB unique constraint fires after idempotency key check:
  → Return 409 DUPLICATE_* with appropriate error code
  → DO NOT return 500

---

## TRANSACTIONAL OUTBOX PATTERN

For async handoffs (payment → finance queue, policy → renewal task), use outbox:

  BEGIN TRANSACTION
    UPDATE entity_state
    INSERT INTO audit_logs (...)
    INSERT INTO outbox_events (type, payload, status=PENDING)
  COMMIT

  Outbox worker (separate process):
    SELECT outbox_events WHERE status=PENDING ORDER BY created_at
    Publish to event bus / queue
    UPDATE status=PROCESSED

This guarantees: "if the business state changed, the downstream event will eventually fire."
No fire-and-forget event publishing inside application code.

---

## RETRY CONTRACT

Clients may safely retry any idempotent endpoint with the same Idempotency-Key.
Clients must NOT retry without an Idempotency-Key (creates duplicates).
Retry-After header is returned on 409 IDEMPOTENCY_CONFLICT.

Non-idempotent endpoints (GET, DELETE, specific PATCHes) do not use Idempotency-Key.

---

## OPTIMISTIC LOCKING

Every mutable aggregate carries a `version` field (integer).
On UPDATE: WHERE id = :id AND version = :clientVersion → rowsAffected check.
If rowsAffected = 0: return 409 OPTIMISTIC_LOCK_CONFLICT.
On success: version incremented by 1.

Entities requiring optimistic locking:
  Lead, QuotationGroup, QuotationVersion, Proposal, Policy, PaymentRecord,
  Inspection, RenewalTask, Claim
