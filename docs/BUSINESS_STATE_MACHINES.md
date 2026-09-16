# Business State Machines

## 1. Lead
- **Allowed states**: NEW, CONTACTED, QUALIFIED, CONVERTED, LOST
- **Transitions**:
  - NEW → CONTACTED (Agent/Back Office)
  - CONTACTED → QUALIFIED (Agent/Back Office)
  - QUALIFIED → CONVERTED (Agent/Back Office - when Policy issued)
  - Any → LOST (Agent/Back Office)
- **Required fields**: contactId
- **Side effects**: Audit log, status metrics updated

## 2. Quote
- **Allowed states**: DRAFT, SUBMITTED, INSPECTION_REQUIRED, READY_FOR_PROPOSAL, PAYMENT_PENDING, PAYMENT_DONE, PENDING_ISSUANCE, ISSUED, EXPIRED, CANCELLED
- **Transitions**:
  - DRAFT → SUBMITTED (Agent/Back Office)
  - SUBMITTED → INSPECTION_REQUIRED (System/Underwriter)
  - SUBMITTED/INSPECTION_REQUIRED → READY_FOR_PROPOSAL
  - READY_FOR_PROPOSAL → PAYMENT_PENDING
  - PAYMENT_PENDING → PAYMENT_DONE
  - PAYMENT_DONE → PENDING_ISSUANCE
  - PENDING_ISSUANCE → ISSUED
- **Required fields**: contactId, vehicle details
- **Side effects**: Audit log, notification to customer on payment pending

## 3. Inspection
- **Allowed states**: NOT_REQUIRED, REQUIRED, REQUESTED, ASSIGNED, IN_PROGRESS, EVIDENCE_SUBMITTED, COMPLETED, APPROVED, FAILED
- **Transitions**:
  - REQUIRED → REQUESTED
  - REQUESTED → ASSIGNED (Back Office)
  - ASSIGNED → IN_PROGRESS (Inspector)
  - IN_PROGRESS → EVIDENCE_SUBMITTED (Inspector)
  - EVIDENCE_SUBMITTED → COMPLETED
  - COMPLETED → APPROVED / FAILED (Underwriter)
- **Side effects**: Quote state updated, notifications

## 4. Policy
- **Allowed states**: ISSUED, ACTIVE, EXPIRING, PENDING_RENEWAL, RENEWED, LAPSED, CANCELLED
- **Transitions**:
  - ISSUED → ACTIVE (System - on start date)
  - ACTIVE → EXPIRING (System - 30 days before end date)
  - EXPIRING → PENDING_RENEWAL
  - PENDING_RENEWAL → RENEWED (when renewal quote issued)
  - EXPIRING → LAPSED (System - on end date if not renewed)
  - ACTIVE → CANCELLED (Admin/Back Office)
- **Side effects**: Renewal generation

## 5. Renewal
- **Allowed states**: UPCOMING, CONTACT_INITIATED, REQUOTED, FOLLOW_UP, PAYMENT_RECEIVED, RENEWED, LOST, LAPSED
- **Transitions**:
  - UPCOMING → CONTACT_INITIATED
  - CONTACT_INITIATED → REQUOTED
  - REQUOTED → FOLLOW_UP
  - FOLLOW_UP → PAYMENT_RECEIVED
  - PAYMENT_RECEIVED → RENEWED
- **Side effects**: Reminders sent to customer

## 6. Claim
- **Allowed states**: SUBMITTED, ASSIGNED, IN_SURVEY, SURVEYED, APPROVED, SETTLED, REJECTED
- **Transitions**:
  - SUBMITTED → ASSIGNED
  - ASSIGNED → IN_SURVEY
  - IN_SURVEY → SURVEYED
  - SURVEYED → APPROVED / REJECTED
  - APPROVED → SETTLED
- **Side effects**: Claims metrics updated, notifications
