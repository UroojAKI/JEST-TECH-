# WORKFLOW STATE MACHINES — JEST POLICY CRM

**Version:** 4.0  
**Baseline Git HEAD:** `ef337f39e286dbb11452ee0273d2ca3845903321`  
**Status:** Canonical Business State Specification

---

## 1. Primary Commercial Entities State Machines

```
LEAD:
  [NEW] -> [CONTACTED] -> [QUALIFIED] -> [PROPOSAL] -> [CONVERTED] (Terminal Success)
                                                      -> [LOST]      (Terminal Failure)

QUOTATION:
  [DRAFT] -> [SUBMITTED] -> [UNDER_REVIEW] -> [INSPECTION_REQUIRED] -> [APPROVED] -> [ACCEPTED] -> [CONVERTED_TO_POLICY]
                                            -> [REJECTED] (Terminal)
                                            -> [EXPIRED]  (Terminal)

INSPECTION:
  [REQUESTED] -> [ASSIGNED] -> [IN_PROGRESS] -> [COMPLETED] -> [APPROVED] (Unblocks Issuance)
                                                            -> [REJECTED] (Blocks Issuance)

PAYMENT:
  [PENDING] -> [PROCESSING] -> [SUCCESS] -> [RECONCILED]
                            -> [FAILED]

POLICY:
  [DRAFT] -> [ISSUED] -> [ACTIVE] -> [PENDING_RENEWAL] -> [RENEWED]
                                  -> [LAPSED]
                                  -> [CANCELLED]

RENEWAL:
  [SCHEDULED] -> [REMINDER_DUE] -> [CONTACTED] -> [REQUOTED] -> [RENEWED] (Terminal Success)
                                                              -> [LOST]    (Terminal Failure)

CLAIM:
  [REPORTED] -> [REGISTERED] -> [SURVEYOR_ASSIGNED] -> [UNDER_ASSESSMENT] -> [APPROVED] -> [SETTLED] -> [CLOSED]
                                                                          -> [REJECTED] -> [CLOSED]
```

---

## 2. Invariants & Guard Conditions

1. **Policy Issuance**:
   - Status must be `ACCEPTED`.
   - Inspection must be `APPROVED` (if inspection required).
   - Financial payment must be `RECONCILED` with zero variance ($|\text{Paid} - \text{Payable}| \le 0.01$).
   - KYC documents must be present and verified.
   - Lead must transition to `CONVERTED`.
2. **Claim Submission**:
   - Policy must be `ACTIVE` or `RENEWED`.
   - Incident date must satisfy: $\text{effectiveDate} \le \text{incidentDate} \le \text{expiryDate}$.
3. **Segregation of Duties**:
   - Sales agent cannot approve own quotation or inspection report.
