# 09 — ERROR CONTRACT
# JEST POLICY CRM — Engineering Contract
# Version: 1.0.0 | Status: BINDING | Last updated: 2026-08-27
# Every API error must follow this contract. No module may invent its own error format.

---

## STANDARD ERROR ENVELOPE

```json
{
  "statusCode": 422,
  "error": "UNDERPAYMENT",
  "message": "Reconciled amount ₹1 is less than payable amount ₹51,920",
  "details": {
    "payableAmount": 51920,
    "reconciledAmount": 1,
    "shortfall": 51919
  },
  "correlationId": "abc-123",
  "timestamp": "2026-08-27T07:30:00Z"
}
```

---

## CANONICAL ERROR CODES

### Auth
  AUTH_REQUIRED           401  No valid JWT token
  AUTH_EXPIRED            401  JWT expired; refresh required
  AUTH_INSUFFICIENT       403  Token valid but role/permission insufficient
  ACCOUNT_INACTIVE        403  User account deactivated

### Authorization
  FORBIDDEN               403  Actor cannot perform this action on this resource
  NOT_FOUND_OR_FORBIDDEN  404  Deliberately ambiguous for unauthorized reads (IDOR prevention)
  CROSS_ORG_ACCESS        403  Attempt to access another organization's resource
  CROSS_BRANCH_ACCESS     403  Actor's branch does not include this resource

### Business Rules
  UNDERPAYMENT            422  reconciledAmount < payableAmount
  OVERPAYMENT             422  reconciledAmount > payableAmount (approval required)
  DUPLICATE_REFERENCE     409  transactionReference already exists
  DUPLICATE_POLICY        409  Policy already exists for this vehicle and period
  DUPLICATE_CLAIM         409  Claim already exists for this incident date and type
  INSPECTION_REQUIRED     422  Case cannot proceed; inspection is mandatory
  INSPECTION_INCOMPLETE   422  Not all 7 photo slots submitted
  DOCUMENTS_UNVERIFIED    422  One or more required documents not in VERIFIED state
  PAYMENT_NOT_RECONCILED  422  Payment must be RECONCILED before issuance
  QUOTE_NOT_ACCEPTED      422  No accepted quotation version for this case
  WRONG_QUOTATION         422  Payment quotationId does not match accepted version
  STATE_TRANSITION_INVALID 422 Requested transition is not allowed from current state
  ELIGIBILITY_GATE_FAILED 422  One or more issuance gate checks failed (details array)
  ISSUANCE_DATA_INCOMPLETE 422 Gate B: missing insurer policy number/dates/document
  PREMIUM_VARIANCE_APPROVAL 422 Variance exceeds threshold; approval required

### Concurrency
  OPTIMISTIC_LOCK_CONFLICT 409  Resource version mismatch; refresh required
  IDEMPOTENCY_CONFLICT     409  Duplicate request with same idempotency key in flight
  DUPLICATE_TASK           409  Renewal/inspection task already exists for this entity

### Validation
  VALIDATION_ERROR         400  DTO validation failed (details array of field errors)
  MISSING_REQUIRED_FIELD   400  Business-required field not provided

### Infrastructure
  INTERNAL_ERROR           500  Unhandled exception (never expose stack traces to client)
  SERVICE_UNAVAILABLE      503  Upstream dependency (Redis, S3, etc.) unavailable

---

## FRONTEND BEHAVIOR CONTRACT

On 401 AUTH_REQUIRED / AUTH_EXPIRED:
  → Attempt token refresh once
  → If refresh fails → redirect to /login
  → Never show raw error to user

On 403 FORBIDDEN / NOT_FOUND_OR_FORBIDDEN:
  → Show appropriate empty state or /unauthorized page
  → Never show "you don't have permission" with entity details (IDOR risk)

On 409 OPTIMISTIC_LOCK_CONFLICT:
  → Show: "This record changed while you were editing. Refresh to continue."
  → Reload the record

On 422 ELIGIBILITY_GATE_FAILED:
  → Show the details[] array as a checklist of what is blocking
  → Never show generic "something went wrong"

On 500 INTERNAL_ERROR:
  → Show: "An unexpected error occurred. Please try again or contact support."
  → Log correlationId for support reference

---

## AUDIT ON ERROR

These error types must produce an AuditLog entry:
  AUTH_INSUFFICIENT (unauthorized attempt)
  FORBIDDEN (unauthorized attempt)
  NOT_FOUND_OR_FORBIDDEN (potential IDOR probe)
  CROSS_ORG_ACCESS (security event)
  ELIGIBILITY_GATE_FAILED (business boundary probe)
  PREMIUM_VARIANCE_APPROVAL (financial event)
