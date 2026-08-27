# STATE MACHINES — JEST POLICY CRM
# Version: 1.0.0 | Status: BINDING | Branch: production-remediation
# Every state transition requires: actor, timestamp, reason, and produces an AuditLog entry.
# No module may invent its own states. These are canonical.

---

## 1. LEAD STATE MACHINE

States:
  NEW            → Lead captured, not yet contacted
  CONTACTED      → At least one outbound contact attempt logged
  QUALIFIED      → Vehicle/insurance requirement confirmed
  NEGOTIATING    → Quote shared, customer evaluating
  CONVERTED      → Lead linked to an ACCEPTED QuotationVersion
  LOST           → Terminal: customer declined or unresponsive
  DUPLICATE      → Terminal: merged into existing Customer

Transitions:
  NEW          → CONTACTED      Actor: Sales Agent | Guard: contactAttemptLogged
  CONTACTED    → QUALIFIED      Actor: Sales Agent | Guard: vehicleAndRequirementCaptured
  QUALIFIED    → NEGOTIATING    Actor: Sales Agent | Guard: quotationGroupExists
  NEGOTIATING  → CONVERTED      Actor: System      | Guard: quotationVersionAccepted
  NEGOTIATING  → LOST           Actor: Sales Agent | Guard: lostReasonProvided
  CONTACTED    → LOST           Actor: Sales Agent | Guard: lostReasonProvided
  NEW          → DUPLICATE      Actor: System      | Guard: deduplicationMatchConfirmed

Rules:
  - A CONVERTED lead's QuotationGroup must have exactly one ACCEPTED version.
  - A LOST lead cannot be reopened; a new lead must be created.
  - A DUPLICATE lead must reference the surviving Customer.

---

## 2. QUOTATION GROUP STATE MACHINE

States:
  OPEN       → Contains one or more versions, none accepted
  ACCEPTED   → Exactly one version is in ACCEPTED state
  EXPIRED    → No version accepted within validity window
  CANCELLED  → Manually cancelled by Sales Manager

Transitions:
  OPEN      → ACCEPTED   Actor: System     | Guard: oneVersionTransitionedToAccepted
  OPEN      → EXPIRED    Actor: Scheduler  | Guard: allVersionsExpired
  OPEN      → CANCELLED  Actor: SalesMgr   | Guard: noPaymentRecorded

---

## 3. QUOTATION VERSION STATE MACHINE

States:
  DRAFT         → Being built, not yet calculated
  CALCULATED    → Premium computed, not yet shared
  SHARED        → Sent to customer
  NEGOTIATING   → Customer requested revision
  ACCEPTED      → Customer confirmed this version (only ONE per group)
  REJECTED      → Customer declined this specific version
  EXPIRED       → Validity window passed
  SUPERSEDED    → Another version in the group was ACCEPTED

Transitions:
  DRAFT       → CALCULATED   Actor: System       | Guard: allRequiredFieldsPresent
  CALCULATED  → SHARED       Actor: SalesAgent   | Guard: none
  SHARED      → NEGOTIATING  Actor: SalesAgent   | Guard: customerRequestedChange
  SHARED      → ACCEPTED     Actor: SalesAgent   | Guard: customerAccepted
  NEGOTIATING → CALCULATED   Actor: System       | Guard: newVersionCreated (this version → SUPERSEDED)
  SHARED      → REJECTED     Actor: SalesAgent   | Guard: rejectionReasonProvided
  CALCULATED  → EXPIRED      Actor: Scheduler    | Guard: validityWindowPassed
  SHARED      → EXPIRED      Actor: Scheduler    | Guard: validityWindowPassed
  *           → SUPERSEDED   Actor: System       | Guard: siblingVersionAccepted

Invariant:
  At most ONE version per QuotationGroup may be in state ACCEPTED.
  Accepting V3 automatically transitions V1, V2 → SUPERSEDED.

---

## 4. PROPOSAL STATE MACHINE

States:
  DRAFT              → Being assembled
  KYC_VERIFIED       → Customer identity documents verified
  VEHICLE_VERIFIED   → RC and vehicle data confirmed
  COMPLETE           → All required information verified
  SUBMITTED          → Sent to insurer
  APPROVED           → Insurer accepted
  REJECTED           → Insurer declined (reason captured)

Transitions:
  DRAFT           → KYC_VERIFIED      Actor: BackOffice | Guard: kycDocsVerified
  KYC_VERIFIED    → VEHICLE_VERIFIED  Actor: BackOffice | Guard: rcAndVehicleVerified
  VEHICLE_VERIFIED→ COMPLETE          Actor: System     | Guard: allGatesPassed
  COMPLETE        → SUBMITTED         Actor: BackOffice | Guard: issuanceEligible
  SUBMITTED       → APPROVED          Actor: BackOffice | Guard: insurerPolicyReceived
  SUBMITTED       → REJECTED          Actor: BackOffice | Guard: rejectionReasonProvided

---

## 5. INSPECTION STATE MACHINE

States:
  NOT_REQUIRED  → Risk engine determined no inspection needed
  REQUIRED      → Risk engine flagged; task not yet created
  CREATED       → InspectionTask created in system
  ASSIGNED      → Assigned to inspector
  IN_PROGRESS   → Inspector has acknowledged and started
  SUBMITTED     → Inspector submitted all 7 photo slots
  UNDER_REVIEW  → Back office reviewing submission
  APPROVED      → Inspection passed
  REJECTED      → Inspection failed (reason captured)
  EXPIRED       → Inspection window passed without completion

Transitions:
  NOT_REQUIRED → (terminal for this entity; issuance gate bypasses inspection check)
  REQUIRED     → CREATED       Actor: System      | Guard: inspectionTaskCreatedAtomically
  CREATED      → ASSIGNED      Actor: System      | Guard: inspectorAssigned
  ASSIGNED     → IN_PROGRESS   Actor: Inspector   | Guard: acknowledgement
  IN_PROGRESS  → SUBMITTED     Actor: Inspector   | Guard: all7PhotoSlotsUploaded
  SUBMITTED    → UNDER_REVIEW  Actor: System      | Guard: autoTransition
  UNDER_REVIEW → APPROVED      Actor: BackOffice  | Guard: reviewPassed
  UNDER_REVIEW → REJECTED      Actor: BackOffice  | Guard: rejectionReasonProvided
  REJECTED     → CREATED       Actor: System      | Guard: reassignmentRequested

Photo slots (all 7 mandatory):
  FRONT | BACK | LEFT | RIGHT | WINDSHIELD | CHASSIS | ODOMETER

Invariant:
  If quotation.inspectionRequired = true, APPROVED inspection is mandatory before READY_FOR_ISSUANCE.
  No UI element may bypass this.

---

## 6. DOCUMENT STATE MACHINE

States:
  REQUIRED      → Document is needed for this stage
  UPLOADED      → File received; not yet reviewed
  UNDER_REVIEW  → Reviewer examining
  VERIFIED      → Confirmed matching entity details
  REJECTED      → Rejected with reason; re-upload required
  SUPERSEDED    → A new version replaced this document
  ARCHIVED      → Post-closure archival

Transitions:
  REQUIRED    → UPLOADED      Actor: Agent/Customer | Guard: fileStoredWithChecksum
  UPLOADED    → UNDER_REVIEW  Actor: System         | Guard: autoTransition
  UNDER_REVIEW→ VERIFIED      Actor: BackOffice     | Guard: detailsMatch
  UNDER_REVIEW→ REJECTED      Actor: BackOffice     | Guard: reasonProvided
  REJECTED    → UPLOADED      Actor: Agent/Customer | Guard: newFileWithChecksum (prior → SUPERSEDED)
  VERIFIED    → SUPERSEDED    Actor: System         | Guard: newerVersionVerified

Invariant:
  "Uploaded" is NOT "Verified". Issuance gate requires VERIFIED documents.

---

## 7. PAYMENT STATE MACHINE

States:
  PENDING_PAYMENT        → Accepted quotation; awaiting payment
  PAYMENT_RECORDED       → Payment details captured in CRM
  RECONCILIATION_PENDING → Awaiting finance verification
  RECONCILED             → Finance confirmed exact amount credited
  FAILED                 → Payment failed or reversed
  REFUNDED               → Amount returned to customer

Transitions:
  PENDING_PAYMENT       → PAYMENT_RECORDED      Actor: SalesAgent | Guard: referenceAndAmountProvided
  PAYMENT_RECORDED      → RECONCILIATION_PENDING Actor: System    | Guard: autoTransition
  RECONCILIATION_PENDING→ RECONCILED            Actor: Finance    | Guard: reconciledAmount == payableAmount
  RECONCILIATION_PENDING→ FAILED                Actor: Finance    | Guard: paymentBouncedOrReversed
  RECONCILED            → REFUNDED              Actor: Finance    | Guard: approvalGranted

Invariants:
  reconciledAmount MUST equal payableAmount exactly (no underpayment).
  Duplicate transactionReference → 409 Conflict; second payment NOT created.
  payableAmount is derived server-side from accepted QuotationVersion.totalPayable.
  Client-supplied amount is NOT authoritative.

---

## 8. ISSUANCE WORKBENCH STATE MACHINE

States:
  QUEUED               → Case appears in Back Office queue
  DOCUMENTS_REVIEW     → Back Office reviewing all documents
  SUBMITTED_TO_INSURER → Proposal sent to insurer externally
  INSURER_CLARIFICATION→ Insurer requested additional info
  POLICY_RECEIVED      → Insurer issued; policy document uploaded
  COMPLETED            → Policy linked and activated

Transitions:
  QUEUED              → DOCUMENTS_REVIEW     Actor: BackOffice | Guard: caseAssigned
  DOCUMENTS_REVIEW    → SUBMITTED_TO_INSURER Actor: BackOffice | Guard: allDocsVerified + paymentReconciled
  SUBMITTED_TO_INSURER→ INSURER_CLARIFICATION Actor: BackOffice | Guard: insurerRequestReceived
  INSURER_CLARIFICATION→SUBMITTED_TO_INSURER Actor: BackOffice | Guard: clarificationProvided
  SUBMITTED_TO_INSURER→ POLICY_RECEIVED     Actor: BackOffice | Guard: insurerPolicyNumberEntered
  POLICY_RECEIVED     → COMPLETED           Actor: System     | Guard: policyDocumentVerified + policyActivated

---

## 9. POLICY LIFECYCLE STATE MACHINE

States:
  DRAFT              → Created in system, not yet issued
  READY_FOR_ISSUANCE → All gates passed; in Back Office queue
  SUBMITTED_TO_INSURER→ Proposal sent; awaiting insurer
  ISSUED             → Insurer has underwritten; policy number exists
  ACTIVE             → startDate <= today <= expiryDate
  PENDING_RENEWAL    → 45 days before earliest expiry date
  RENEWED            → Renewal completed; new policy linked
  LAPSED             → Expired without renewal
  CANCELLED          → Cancelled before expiry (reason + approval)
  VOID               → Invalid / error issuance (auditable)

Transitions:
  DRAFT              → READY_FOR_ISSUANCE  Actor: System      | Guard: IssuanceEligibilityGate
  READY_FOR_ISSUANCE → SUBMITTED_TO_INSURER Actor: BackOffice | Guard: proposalPackageComplete
  SUBMITTED_TO_INSURER→ ISSUED             Actor: BackOffice  | Guard: insurerPolicyNumberAndDocumentCaptured
  ISSUED             → ACTIVE              Actor: System      | Guard: startDate <= today
  ACTIVE             → PENDING_RENEWAL     Actor: Scheduler   | Guard: daysToExpiry <= 45
  PENDING_RENEWAL    → RENEWED             Actor: System      | Guard: newPolicyLinked
  PENDING_RENEWAL    → LAPSED             Actor: Scheduler   | Guard: expiryDatePassed + notRenewed
  ACTIVE             → CANCELLED           Actor: Admin       | Guard: approvalGranted + reasonProvided

IssuanceEligibilityGate (server-enforced, no exceptions):
  quotationVersionId.status = ACCEPTED
  AND paymentRecord.status = RECONCILED
  AND reconciledAmount == quotationVersion.totalPayable
  AND allRequiredDocuments.every(d => d.status = VERIFIED)
  AND (inspection.status = APPROVED OR inspection.status = NOT_REQUIRED)
  AND insurerPolicyNumber IS NOT NULL
  AND policyDocumentStorageKey IS NOT NULL
  AND NOT duplicatePolicy(vehicle, period)
  AND actor.permissions.includes('POLICY_ISSUE')

---

## 10. RENEWAL STATE MACHINE

States:
  UPCOMING          → Task created (45 days before expiry)
  CONTACT_INITIATED → First contact attempted
  REQUOTED          → New quotation generated for renewal
  FOLLOW_UP         → Subsequent contact after initial
  PAYMENT_RECEIVED  → Renewal payment recorded
  RENEWED           → New policy issued; linked to original
  LOST              → Customer did not renew
  ESCALATED         → SLA breached; escalated to manager

Buckets (derived from daysToExpiry):
  0–7 days  → CRITICAL
  8–30 days → HIGH
  31–45 days→ NORMAL
  Overdue   → ESCALATED

Transitions:
  UPCOMING         → CONTACT_INITIATED Actor: RenewalExec  | Guard: contactAttemptLogged
  CONTACT_INITIATED→ REQUOTED          Actor: RenewalExec  | Guard: quotationGroupCreated
  REQUOTED         → FOLLOW_UP         Actor: RenewalExec  | Guard: followUpScheduled
  FOLLOW_UP        → PAYMENT_RECEIVED  Actor: System       | Guard: paymentRecorded
  PAYMENT_RECEIVED → RENEWED           Actor: System       | Guard: newPolicyIssued
  *               → LOST              Actor: RenewalExec  | Guard: lostReasonProvided
  UPCOMING         → ESCALATED         Actor: Scheduler   | Guard: slaBreach

Invariant:
  dueDate = MIN(policy.odExpiryDate, policy.tpExpiryDate) from InsurerPolicyDetail.
  NEVER uses quotation validity date.

---

## 11. CLAIM STATE MACHINE

States:
  SUBMITTED          → FNOL received
  UNDER_REVIEW       → Claims team reviewing
  SURVEYOR_ASSIGNED  → External surveyor dispatched
  MORE_INFO_REQUIRED → Additional documents requested
  APPROVED           → Claim approved for settlement
  REJECTED           → Claim denied (reason + appeal right)
  SETTLEMENT_PENDING → Approval done; payment processing
  SETTLED            → Payment made to claimant
  CLOSED             → Final state

Eligibility gate (before SUBMITTED):
  policy.status IN [ACTIVE, RENEWED]
  AND incidentDate BETWEEN policy.startDate AND policy.expiryDate
  AND noDuplicateClaim(policy, incidentDate, type)

Transitions:
  SUBMITTED         → UNDER_REVIEW      Actor: System      | Guard: eligibilityPassed
  UNDER_REVIEW      → SURVEYOR_ASSIGNED Actor: ClaimsMgr   | Guard: surveyorAssigned
  UNDER_REVIEW      → MORE_INFO_REQUIRED Actor: ClaimsExec | Guard: missingDocsIdentified
  MORE_INFO_REQUIRED→ UNDER_REVIEW      Actor: System      | Guard: documentsReceived
  SURVEYOR_ASSIGNED → UNDER_REVIEW      Actor: System      | Guard: reportSubmitted
  UNDER_REVIEW      → APPROVED          Actor: ClaimsMgr   | Guard: approvalAuthorized
  UNDER_REVIEW      → REJECTED          Actor: ClaimsMgr   | Guard: rejectionReasonProvided
  APPROVED          → SETTLEMENT_PENDING Actor: System     | Guard: autoTransition
  SETTLEMENT_PENDING→ SETTLED           Actor: Finance     | Guard: paymentProcessed
  SETTLED           → CLOSED            Actor: System      | Guard: closureConfirmed
