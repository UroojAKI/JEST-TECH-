# 02 — STATE MACHINES
# JEST POLICY CRM — Engineering Contract
# Version: 2.0.0 | Status: BINDING | Last updated: 2026-08-27
#
# CRITICAL CORRECTION from v1.0:
# The IssuanceEligibilityGate has been split into TWO gates:
#   Gate A: READY_FOR_ISSUANCE (no insurer data required yet)
#   Gate B: ISSUED (insurer data required)
# See §9 (Policy Lifecycle) for the corrected model.

---

## 1. LEAD

NEW → CONTACTED → QUALIFIED → NEGOTIATING → CONVERTED (terminal) | LOST (terminal) | DUPLICATE (terminal)

Transitions:
  NEW          → CONTACTED    Actor: SALES_AGENT | Guard: contactAttemptLogged
  CONTACTED    → QUALIFIED    Actor: SALES_AGENT | Guard: vehicleAndRequirementCaptured
  QUALIFIED    → NEGOTIATING  Actor: SALES_AGENT | Guard: quotationGroupExists
  NEGOTIATING  → CONVERTED    Actor: System      | Guard: quotationVersionAccepted
  *            → LOST         Actor: SALES_AGENT | Guard: lostReasonRequired
  *            → DUPLICATE    Actor: System      | Guard: deduplicationMatchConfirmed

---

## 2. QUOTATION GROUP

OPEN → ACCEPTED | EXPIRED | CANCELLED

Invariant: Exactly one QuotationVersion may be ACCEPTED per group at any time.

---

## 3. QUOTATION VERSION

DRAFT → CALCULATED → SHARED → NEGOTIATING → ACCEPTED | REJECTED | EXPIRED | SUPERSEDED

Transitions:
  DRAFT       → CALCULATED  Actor: System      | Guard: allRequiredFieldsPresent + pricingComplete
  CALCULATED  → SHARED      Actor: SALES_AGENT | Guard: none
  SHARED      → NEGOTIATING Actor: SALES_AGENT | Guard: customerRequestedChange
  SHARED      → ACCEPTED    Actor: SALES_AGENT | Guard: customerAccepted
  ACCEPTED    → (terminal — SUPERSEDED only if group cancelled)
  *           → SUPERSEDED  Actor: System      | Guard: siblingVersionAccepted (transition is atomic)

Invariant: Accepting Vn automatically transitions all other versions to SUPERSEDED in the same DB transaction.

---

## 4. INSPECTION

NOT_REQUIRED | REQUIRED → CREATED → ASSIGNED → IN_PROGRESS → SUBMITTED → UNDER_REVIEW → APPROVED | REJECTED

Notes:
  NOT_REQUIRED: terminal for this inspection; issuance Gate A bypasses inspection check.
  REQUIRED: created atomically when risk engine flags inspectionRequired = true.

Transitions:
  REQUIRED     → CREATED      Actor: System      | Guard: atomicWithQuotationStateUpdate
  CREATED      → ASSIGNED     Actor: System/OPS  | Guard: inspectorAssigned
  ASSIGNED     → IN_PROGRESS  Actor: INSPECTOR   | Guard: acknowledgement
  IN_PROGRESS  → SUBMITTED    Actor: INSPECTOR   | Guard: all7PhotoSlotsUploaded
  SUBMITTED    → UNDER_REVIEW Actor: System      | Guard: autoTransition
  UNDER_REVIEW → APPROVED     Actor: ISS_EXEC / OPS_MGR | Guard: reviewPassed
  UNDER_REVIEW → REJECTED     Actor: ISS_EXEC / OPS_MGR | Guard: rejectionReasonRequired
  REJECTED     → CREATED      Actor: System      | Guard: reassignment

Photo slots (all 7 mandatory for submission):
  FRONT | BACK | LEFT | RIGHT | WINDSHIELD | CHASSIS | ODOMETER

---

## 5. DOCUMENT

REQUIRED → UPLOADED → UNDER_REVIEW → VERIFIED | REJECTED → (UPLOADED again on resubmit)

Invariant: UPLOADED ≠ VERIFIED. Gate A requires VERIFIED documents.

---

## 6. PAYMENT

PENDING_PAYMENT → PAYMENT_RECORDED → RECONCILIATION_PENDING → RECONCILED | FAILED | REFUNDED

Financial invariants:
  reconciledAmount MUST == payableAmount (exact, no underpayment)
  payableAmount is server-derived from acceptedQuotationVersion.totalPayable
  Duplicate transactionReference → 409 Conflict; no second record created

---

## 7. PROPOSAL

DRAFT → KYC_VERIFIED → VEHICLE_VERIFIED → COMPLETE → SUBMITTED → APPROVED | REJECTED

---

## 8. ISSUANCE WORKBENCH

QUEUED → DOCUMENTS_REVIEW → SUBMITTED_TO_INSURER → INSURER_CLARIFICATION | POLICY_RECEIVED → COMPLETED

---

## 9. POLICY LIFECYCLE ★ CORRECTED FROM v1.0 ★

DRAFT → READY_FOR_ISSUANCE → SUBMITTED_TO_INSURER → ISSUED → ACTIVE → PENDING_RENEWAL → RENEWED | LAPSED | CANCELLED

### ★ GATE A: READY_FOR_ISSUANCE (no insurer data required)

  quotationVersion.status = ACCEPTED
  AND paymentRecord.status = RECONCILED
  AND reconciledAmount == quotationVersion.totalPayable
  AND allRequiredDocuments.every(d => d.status = VERIFIED)
  AND (inspection.status = APPROVED OR inspection.status = NOT_REQUIRED)
  AND NOT duplicatePolicy(vehicle, proposedPeriod)
  AND actor.permissions.includes(POLICY_SUBMIT)

  ✗ insurerPolicyNumber NOT required here
  ✗ policyDocumentStorageKey NOT required here

### SUBMITTED_TO_INSURER
  Back Office has sent proposal to insurer externally.

### INSURER_CLARIFICATION (optional intermediate)
  Insurer has requested additional information.

### ★ GATE B: ISSUED (insurer data required)

  insurerPolicyDetail.insurerPolicyNumber IS NOT NULL
  AND insurerPolicyDetail.actualTotalPremium IS NOT NULL
  AND insurerPolicyDetail.odStartDate IS NOT NULL
  AND insurerPolicyDetail.odEndDate IS NOT NULL
  AND insurerPolicyDetail.tpStartDate IS NOT NULL
  AND insurerPolicyDetail.tpEndDate IS NOT NULL
  AND insurerPolicyDetail.policyDocumentStorageKey IS NOT NULL
  AND insurerPolicyDetail.policyDocumentVerified = true
  AND premiumVarianceApproved (if variance > threshold)

### ACTIVE
  Automatic when: insurerPolicyDetail.policyStartDate <= today AND policy.status = ISSUED

### PENDING_RENEWAL
  Automatic when: daysToExpiry <= 45 (from renewalDueDate = MIN(odEndDate, tpEndDate))

---

## 10. RENEWAL

UPCOMING → CONTACT_INITIATED → REQUOTED → FOLLOW_UP → PAYMENT_RECEIVED → RENEWED | LOST | ESCALATED

renewalDueDate = MIN(insurerPolicyDetail.odEndDate, insurerPolicyDetail.tpEndDate)
NEVER from quotation validity or manual entry.

---

## 11. CLAIM

Eligibility gate (before SUBMITTED):
  policy.status IN [ACTIVE, RENEWED]
  AND incidentDate BETWEEN insurerPolicyDetail.odStartDate AND insurerPolicyDetail.odEndDate
  AND noDuplicateClaim(policyId, incidentDate, claimType)

SUBMITTED → UNDER_REVIEW → SURVEYOR_ASSIGNED → MORE_INFO_REQUIRED → APPROVED | REJECTED → SETTLEMENT_PENDING → SETTLED → CLOSED
