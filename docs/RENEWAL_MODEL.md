# RENEWAL MODEL — JEST POLICY CRM
# Version: 1.0.0 | Status: BINDING | Branch: production-remediation

---

## 1. AUTHORITATIVE RENEWAL DATE

renewalDueDate = MIN(policy.odEndDate, policy.tpEndDate)
Source: InsurerPolicyDetail (populated by Back Office from actual insurer-issued policy)

NEVER use:
  - QuotationVersion.validTill
  - any manually-entered estimate
  - system creation date + assumptions

If InsurerPolicyDetail.odEndDate or tpEndDate is NULL:
  → Policy cannot transition to ACTIVE
  → Renewal task cannot be created
  → Back Office must capture all dates before activation

---

## 2. TASK CREATION SCHEDULE

Triggered: Policy.status transitions to ACTIVE
Offsets from renewalDueDate:

  Day -45: UPCOMING task created (NORMAL bucket)
  Day -30: Reminder notification; task priority → HIGH
  Day -15: Escalation notification if not CONTACTED
  Day -7:  Task priority → CRITICAL
  Day -1:  Final alert
  Day 0:   Expiry; if not RENEWED → ESCALATED
  Day +1:  LAPSED if no renewal action

Task creation is idempotent:
  upsert({ where: { policyId_offsetDays: unique }, create: {...}, update: {} })
  Prevents duplicate tasks from multi-pod schedulers.

Distributed lock:
  Redis SETNX "renewal_job:{policyId}" TTL=60s before processing
  Release on completion or error.

---

## 3. RENEWAL TASK ASSIGNMENT

Created task:
  assignedToId = original policy's assignedAgentId (if agent is in Renewal team)
  OR
  assignedToId = NULL → UNASSIGNED bucket → Renewal Manager assigns

Reassignment:
  Only Renewal Manager may reassign.
  Audit logged.

---

## 4. RENEWAL QUEUE BUCKETS

Bucket         | Days to Expiry | Priority
--------------|----------------|----------
UPCOMING       | 31–45          | NORMAL
DUE_SOON       | 8–30           | HIGH
CRITICAL       | 0–7            | CRITICAL
OVERDUE        | < 0            | ESCALATED
RENEWED        | n/a            | Completed
LOST           | n/a            | Terminal

---

## 5. RENEWAL WORKFLOW

UPCOMING
  → [Renewal Exec] CONTACT_INITIATED
  → [Renewal Exec] REQUOTED (new QuotationGroup linked to renewal)
  → [Renewal Exec] FOLLOW_UP
  → [System] PAYMENT_RECEIVED (when payment recorded)
  → [System] RENEWED (when new policy issued + linked)

Alternative:
  → LOST (with mandatory lostReason)

---

## 6. RENEWAL COMPLETION

Renewal is complete when:
  1. New QuotationVersion accepted for same vehicle
  2. Payment reconciled
  3. New Policy issued with InsurerPolicyDetail
  4. New Policy.status = ACTIVE
  5. RenewalTask.status = RENEWED
  6. originalPolicy.renewedByPolicyId = newPolicy.id

Only then is the original policy transitioned to RENEWED.

---

## 7. DEAD-LETTER HANDLING

If renewal task creation fails (DB error, pod crash):
  → Retry up to 3 times with exponential backoff
  → After 3 failures: task goes to RenewalTaskDLQ
  → Renewal Manager receives alert
  → Manual creation required from DLQ queue

Job deduplication prevents re-processing the same task after recovery.
