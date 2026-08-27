# WORKFLOW HANDOFFS — JEST POLICY CRM
# Version: 1.0.0 | Status: BINDING | Branch: production-remediation
# This document defines every cross-department handoff in the lifecycle.
# A handoff is not complete until the receiving department's queue is updated.

---

## LIFECYCLE HANDOFF MAP

SALES → CUSTOMER (on lead qualification)
  Trigger:    Lead.status transitions to QUALIFIED
  Evidence:   Contact verified, Vehicle data captured
  Receiving:  Lead detail page with completion checklist

SALES → QUOTATION (on motor data completion)
  Trigger:    Lead.completionScore >= quotation_threshold
  Evidence:   QuotationGroup created with V1
  Receiving:  Quote management view on Lead page

SALES → CUSTOMER_ACCEPTED (on quote acceptance)
  Trigger:    QuotationVersion.status = ACCEPTED
  Evidence:   acceptedAt timestamp, acceptedById
  Receiving:  Proposal creation triggered; document checklist shown

SALES → INSPECTION (if required)
  Trigger:    Risk engine sets inspectionRequired = true during quotation
  Evidence:   Inspection record created atomically; Task created
  Receiving:  Inspector's task queue (NOT in Sales workspace)

SALES → FINANCE (after customer acceptance)
  Trigger:    QuotationVersion.status = ACCEPTED
  Evidence:   PaymentRecord.status = PAYMENT_RECORDED
  Receiving:  Finance reconciliation queue

FINANCE → BACK_OFFICE (after reconciliation)
  Trigger:    PaymentRecord.status = RECONCILED
  Evidence:   reconciledAmount = payableAmount; reconciledAt; reconciledById
  Receiving:  Back Office issuance queue (if all other gates also pass)

INSPECTION → BACK_OFFICE (after inspection approval)
  Trigger:    Inspection.status = APPROVED
  Evidence:   Reviewed by authorized actor; reviewedById; approvedAt
  Receiving:  Updates issuance gate; Back Office queue refreshed

DOCUMENTS → BACK_OFFICE (after all documents verified)
  Trigger:    ALL required documents → status = VERIFIED
  Evidence:   Each document: verifiedById, verifiedAt, checksum
  Receiving:  Back Office case becomes READY for SUBMITTED_TO_INSURER

BACK_OFFICE → POLICY (after insurer issues)
  Trigger:    Back Office enters insurer policy number + uploads policy document
  Evidence:   InsurerPolicyDetail populated; document verified; Policy status = ISSUED
  Receiving:  Policy becomes ACTIVE when startDate <= today

POLICY_ACTIVE → RENEWAL (automated)
  Trigger:    Policy.status transitions to ACTIVE
  Evidence:   RenewalTask created with dueDate = MIN(odEndDate, tpEndDate) - 45 days
  Receiving:  Renewal Executive queue (initially UNASSIGNED bucket)

RENEWAL → CLAIMS (if claim filed on renewed policy)
  Trigger:    Claim FNOL filed against Policy.id
  Evidence:   Eligibility gate passed; Claim.status = SUBMITTED
  Receiving:  Claims Executive queue

---

## HANDOFF INVARIANTS

1. A handoff is NOT complete if the receiving queue is not updated.
   Example: Payment reconciled but Back Office queue not refreshed = broken handoff.

2. Every handoff produces an AuditLog entry with:
   fromDepartment, toDepartment, entityType, entityId, actor, timestamp

3. SLA starts when a record enters a new department's queue.
   SLA breach = system escalation to department manager.

4. A record in transition cannot be simultaneously modified by both departments.
   Optimistic locking on entity version prevents conflicts.

---

## HANDOFF FAILURE RECOVERY

Payment reconciled, browser closes:
  On next visit: "Payment reconciled. Case is ready for Back Office."

Inspection rejected:
  Inspection.status = REJECTED
  → notify Sales Agent
  → create re-inspection request
  → Back Office gate remains BLOCKED

Document rejected:
  Document.status = REJECTED
  → notify Sales Agent with reason
  → Back Office gate remains BLOCKED until new VERIFIED document received

Insurer changes premium:
  InsurerPolicyDetail.premiumVariance > threshold
  → Finance/Operations Manager approval workflow triggered
  → Policy remains in SUBMITTED_TO_INSURER state

Employee leaves mid-workflow:
  All in-progress records in their name → Transfer Wizard
  New owner = mandatory before account deactivated

---

## CROSS-MODULE DATA FLOW (No context loss)

From any Lead page → Customer 360
From any Policy page → Customer 360
From any Claim page → Policy page → Customer 360
From any Renewal Task → Policy → Customer 360

Customer 360 always reflects real-time database state.
Never: redirect to 404 or empty state for in-progress records.
