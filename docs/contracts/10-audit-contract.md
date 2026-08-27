# 10 — AUDIT CONTRACT
# JEST POLICY CRM — Engineering Contract
# Version: 1.0.0 | Status: BINDING | Last updated: 2026-08-27
# Audit is a non-negotiable transactional requirement. Not best-effort logging.

---

## AUDIT RECORD SCHEMA

Every AuditLog entry contains:
  id             UUID (auto)
  correlationId  string (from request header / job id)
  actor          { userId, role, organizationId, branchId, teamId }
  action         string (see canonical action list below)
  entity         string (Lead | QuotationVersion | Payment | Policy | ...)
  entityId       UUID
  fromState      string | null
  toState        string | null
  reason         string | null (required for certain transitions)
  before         JSONB | null (sanitized — no PAN/Aadhaar in plain text)
  after          JSONB | null (sanitized)
  timestamp      DateTime (server UTC; never client-supplied)
  ipAddress      string
  userAgent      string
  requestId      UUID

---

## IMMUTABILITY CONTRACT

AuditLog rows are APPEND-ONLY.
Database policy must prohibit UPDATE and DELETE on the audit_logs table.
Application code must never issue UPDATE or DELETE against audit_logs.
Soft deletion is prohibited. Hard deletion is prohibited.
Archival must preserve the original record (write to cold storage, do not delete from hot).

---

## TRANSACTIONAL REQUIREMENT

For every state transition:
  The business mutation + the AuditLog entry must be in the SAME database transaction.

If the transaction fails, NEITHER the mutation NOR the audit entry is persisted.
If the transaction succeeds, BOTH are guaranteed to exist.

This prevents "mutation with no audit" and "audit with no mutation" gaps.

---

## MANDATORY AUDIT EVENTS (canonical action list)

Authentication:
  USER_LOGIN | USER_LOGOUT | USER_LOGIN_FAILED | SESSION_REFRESHED | PASSWORD_RESET

Authorization failures (security):
  UNAUTHORIZED_READ_ATTEMPT | UNAUTHORIZED_WRITE_ATTEMPT | CROSS_ORG_ACCESS_ATTEMPT

Lead lifecycle:
  LEAD_CREATED | LEAD_ASSIGNED | LEAD_REASSIGNED | LEAD_CONVERTED | LEAD_LOST | LEAD_DUPLICATE_DETECTED

Quotation:
  QUOTATION_CALCULATED | QUOTATION_SHARED | QUOTATION_ACCEPTED | QUOTATION_REJECTED | QUOTATION_SUPERSEDED

PII access:
  CUSTOMER_PII_ACCESSED | DOCUMENT_DOWNLOADED | POLICY_DOCUMENT_DOWNLOADED

Payment:
  PAYMENT_RECORDED | PAYMENT_RECONCILED | PAYMENT_RECONCILIATION_FAILED | PAYMENT_REFUND_INITIATED

Inspection:
  INSPECTION_CREATED | INSPECTION_ASSIGNED | INSPECTION_SUBMITTED | INSPECTION_APPROVED | INSPECTION_REJECTED

Documents:
  DOCUMENT_UPLOADED | DOCUMENT_VERIFIED | DOCUMENT_REJECTED | DOCUMENT_RESUBMITTED

Issuance:
  ISSUANCE_QUEUED | ISSUANCE_SUBMITTED_TO_INSURER | POLICY_RECEIVED | POLICY_DOCUMENT_VERIFIED

Policy:
  POLICY_ISSUED | POLICY_ACTIVATED | POLICY_CANCELLED | POLICY_LAPSED | POLICY_RENEWED
  POLICY_MODIFIED (Back Office correction with reason)

Renewal:
  RENEWAL_TASK_CREATED | RENEWAL_CONTACTED | RENEWAL_REQUOTED | RENEWAL_PAYMENT | RENEWAL_COMPLETED | RENEWAL_LOST

Claims:
  CLAIM_SUBMITTED | CLAIM_ASSIGNED | CLAIM_SURVEYOR_ASSIGNED | CLAIM_APPROVED | CLAIM_REJECTED | CLAIM_SETTLED

Administration:
  USER_CREATED | USER_DEACTIVATED | USER_ROLE_CHANGED | PERMISSION_GRANTED | PERMISSION_REVOKED
  EMPLOYEE_OFFBOARDING_INITIATED | RECORDS_TRANSFERRED

Finance:
  PREMIUM_VARIANCE_APPROVED | OVERPAYMENT_APPROVED | RECONCILIATION_EXCEPTION_RAISED

---

## PII HANDLING IN AUDIT

Fields containing PII (PAN, Aadhaar, mobile, email, bank account) must be:
  - Masked in before/after JSONB: e.g., "pan": "ABCPX1234X" → "pan": "ABC***234X"
  - Or excluded from audit before/after and referenced by ID only

PII access events (CUSTOMER_PII_ACCESSED, DOCUMENT_DOWNLOADED) must record which specific
fields or documents were accessed, not the full data.

---

## COMPLIANCE OFFICER ACCESS

COMPLIANCE_OFFICER role has READ access to all AuditLog entries across the organization.
This is the ONLY read-all-audit permission.
MD has read access to management-relevant events only.
No other role can read another user's audit trail.

---

## AUDIT QUERY CONTRACT

GET /audit/logs?entity=Policy&entityId=:id
GET /audit/logs?actor=:userId&from=:date&to=:date
GET /audit/logs?action=UNAUTHORIZED_READ_ATTEMPT

Response is paginated. No unbounded audit queries.
Results sorted by timestamp DESC by default.
