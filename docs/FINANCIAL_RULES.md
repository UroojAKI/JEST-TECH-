# FINANCIAL RULES — JEST POLICY CRM
# Version: 1.0.0 | Status: BINDING | Branch: production-remediation
# These rules are non-negotiable invariants enforced server-side.
# No UI interaction, API shortcut, or admin override may bypass them.

---

## F1. PREMIUM CALCULATION AUTHORITY

Only MotorPricingService may produce authoritative premium figures.
No other service may calculate or store a premium directly.

Formula (Motor - Comprehensive):
  Net OD Premium
    = IDV × OD Rate (from approved tariff)
    - NCB Discount (as percentage of Net OD)
    - Any other approved discounts

  Net TP Premium
    = Statutory rate from IRDAI tariff table (cc/GVW/seating based)
    (TP cannot be discounted)

  Addon Premiums
    = Sum of all selected addons, each priced from insurer-specific tariff

  Gross Premium
    = Net OD + Net TP + Addon Premiums

  GST
    = Gross Premium × 18%

  Total Payable
    = Gross Premium + GST

Every addon MUST produce a non-zero premium if selected.
Silent zero-premium addons are a bug, not a feature.

---

## F2. PAYMENT INVARIANTS

F2.1 Payable Amount Authority
  payableAmount = QuotationVersion.totalPayable (server-derived)
  Client cannot submit a different amount and have it accepted.

F2.2 Underpayment Block
  If reconciledAmount < payableAmount:
    → 422 Unprocessable Entity
    → PaymentRecord.status remains RECONCILIATION_PENDING
    → Issuance gate BLOCKED

F2.3 Overpayment Handling
  If reconciledAmount > payableAmount:
    → Finance Manager must explicitly approve or initiate refund
    → Cannot be silently accepted

F2.4 Duplicate Payment Block
  transactionReference must be globally unique.
  Second submission with same reference → 409 Conflict.
  Second PaymentRecord not created.

F2.5 Wrong Quotation Block
  payment.quotationVersionId must match lead.acceptedQuotationVersionId.
  Payment against a non-accepted version → 422 Unprocessable Entity.

F2.6 Currency
  Only INR is supported. No multi-currency at this stage.

---

## F3. RECONCILIATION AUTHORITY

Only FINANCE_EXECUTIVE or FINANCE_MANAGER may perform reconciliation.
Reconciliation requires:
  - bankReference (mandatory)
  - reconciledAmount (mandatory)
  - reconciledAt (server timestamp; client timestamp not accepted)
  - reconciliationActorId (from ActorContext)

Reconciliation is idempotent:
  Same bankReference reconciled twice → 409 Conflict.

---

## F4. PREMIUM VARIANCE RULES

When Back Office enters actual insurer premium:
  variance = actualPremium - quotedPremium

  |variance| <= 500 INR      → Auto-approved (within tolerance)
  500 < |variance| <= 2000   → Operations Manager approval required
  |variance| > 2000          → Finance Manager approval required
  variance < -500 INR        → Alert: Insurer gave significant discount (log but auto-approve)

Variance approval must be captured:
  approvedBy, approvalTimestamp, approvalReason

---

## F5. COMMISSION RULES

Commission is calculated AFTER policy activation.
Formula: policyRecord.actualPremium × agent.commissionRate
Commission cannot be manually entered; it is always derived.
POSP agents: flat POSP rate as per IRDAI regulations.

---

## F6. REFUND RULES

Refund is only permitted after:
  - Policy cancellation approval, OR
  - Payment failure confirmed by bank

Refund workflow:
  Finance Manager raises refund → Approval chain → Disbursement
  Refund must be linked to original PaymentRecord.

---

## F7. FINANCIAL AUDIT REQUIREMENT

Every financial mutation must produce an AuditLog entry:
  - Payment created
  - Payment reconciled
  - Reconciliation rejected
  - Premium variance approved
  - Refund initiated
  - Commission computed

AuditLog entries are immutable (no UPDATE or DELETE permitted).
