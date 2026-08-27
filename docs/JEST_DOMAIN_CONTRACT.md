# JEST POLICY CRM — DOMAIN CONTRACT & BUSINESS INVARIANTS (`JEST_DOMAIN_CONTRACT.md`)

**VERSION:** 2.0.0-PROD-AMENDED  
**STATUS:** ACTIVE & BINDING (APPROVED WITH MANDATORY AMENDMENTS)  
**SCOPE:** Entire Monorepo (`apps/api`, `apps/web`, `packages/*`)

---

# 0. NON-NEGOTIABLE ARCHITECTURE RULE: MULTI-USER WORKSPACE RULE

> ### Rule 0: Multi-User Workspace Invariant
> 1. **`Dashboard ≠ Role ≠ User ≠ Data Scope`**: A workspace (Sales, Finance, Back Office, Renewals, Claims, Management) is a shared functional workbench. It is NEVER a role or a data-access boundary.
> 2. **Universal Authorization Tuple**: Access to any resource ($R$) by an Actor ($A$) for an Action ($Act$) in a State ($S$) within an Organizational Scope ($O$) is evaluated as:
>    $$\text{Authorize}(A, \text{Permission}, R, Act, O, S) \to \text{ALLOW} \mid \text{DENY}$$
> 3. **Server-Derived Scope**: The backend derives data scope strictly from authenticated `ActorContext` and database relationships (`Organization \to Branch \to Team \to User`). Client-supplied IDs (`?userId=...`, `?branchId=...`) are NEVER trusted as authorization boundaries.
> 4. **No Alternate Authority**: Every business outcome has exactly **ONE** domain lifecycle service. Direct database writes, bypass routes, or parallel creation paths are strictly prohibited.
> 5. **Server-Owned Completion**: Completion is derived exclusively from server-side verified invariants and cryptographic/audit evidence. Frontend state or checkboxes are NEVER evidence of business completion.

---

# 1. CANONICAL DOMAIN DEFINITIONS

| Domain Concept | Authoritative Definition | Required Evidence | Non-Permitted Assumptions |
| :--- | :--- | :--- | :--- |
| **Lead** | An uncommitted prospect or sales inquiry assigned to an agent for qualification. | Inbound channel, Contact details, Assigned Agent ID, SLA timestamp. | Cannot be treated as an in-force Policy or verified Customer. |
| **Customer (Contact / Account)** | Persisted legal identity (Individual or Corporate) verified via deduplication. | Verified KYC / PAN / Phone / Email, Deduplication check. | Quote creation does not promote a raw lead without explicit contact persistence. |
| **Quotation Group & Versions** | A versioned collection of immutable commercial offers for a specific risk profile. | Snapshot (IDV, OD, TP, Addons, Discounts, GST, Total), Version Index, Insurer. | Historical quotes cannot be modified in-place; edits create new versions ($V_1, V_2, V_3$). |
| **Accepted Quotation** | The single explicit quotation version approved by the customer for proposal binding. | Customer acceptance timestamp, Proposer declaration, Version ID. | Multiple quotes cannot be accepted concurrently for a single policy issuance. |
| **Payment Recorded** | Payment transaction details captured into the CRM. | Bank/PG Reference, Payment Mode, Recorded By, Timestamp. | Does NOT mean funds are reconciled or cleared. |
| **Payment Reconciled** | Independent verification that full payable premium (100%) has been credited to escrow. | Exact amount match ($\text{ReconciledAmount} == \text{PayableAmount}$), Bank Recon Match. | $\text{Amount} < \text{Total}$ (underpayment) is strictly blocked. Overpayment requires approval. |
| **Inspection (Break-in / PDI)** | Physical or digital vehicle condition assessment for break-in policies. | Inspection Report ID, 6-point photos verified, Surveyor Approval (`APPROVED`). | Cannot be bypassed if vehicle risk engine flags `inspectionRequired = true`. |
| **Proposal Package** | Final binding declaration submitted to the insurer with verified KYC and RC details. | Proposer Form, Verified Documents, Vehicle Details, Proposal ID. | Cannot be submitted to insurer without verified document evidence. |
| **Policy Pending Issuance** | State where payment is reconciled, inspection passed, and proposal is in Back Office queue. | Reconciled Payment ID, Verified Proposal, Assigned Back Office Operator. | Not an active in-force policy. |
| **Policy Issued** | External insurer has formally underwritten, bound, and generated the legal policy schedule. | Insurer Policy Number, Policy Schedule PDF uploaded, Actual Premium, Start/End Dates. | CRM database row existence alone is NOT an issued policy without insurer schedule evidence. |
| **Active Policy** | An issued policy whose effective start date is $\le \text{today}$ and expiry date is $\ge \text{today}$. | Issued state + Valid date range ($\text{StartDate} \le \text{Now} \le \text{ExpiryDate}$). | Expired or lapsed policies cannot be marked Active. |
| **Renewal Due** | An active policy entering the renewal work window ($45/30$ days prior to earliest expiry). | System-generated `RenewalTask`, $\text{DueDate} = \min(\text{OD Expiry}, \text{TP Expiry})$. | Quotation validity date must NEVER be used as Policy Expiry date. |
| **Claim Eligible** | A policy verifying active in-force status on the exact incident date. | $\text{IncidentDate} \in [\text{StartDate}, \text{ExpiryDate}]$, Policy Status = `ACTIVE`/`RENEWED`. | Claims cannot be logged against lapsed, cancelled, or draft policies. |
| **Document Verified** | Uploaded file inspected and confirmed matching entity details. | `status = VERIFIED`, Verifier User ID, Verification Timestamp, SHA-256 Hash. | "File uploaded" $\ne$ "Document verified". |

---

# 2. THE 10 DOMAIN STATE MACHINES & CROSS-DOMAIN GATES

```text
1. LEAD STATE MACHINE:
   NEW → CONTACTED → QUALIFIED → CONVERTED (Terminal) | LOST (Terminal)

2. QUOTATION STATE MACHINE:
   DRAFT → GENERATED → SHARED → NEGOTIATING → ACCEPTED (Single V) | REJECTED | EXPIRED

3. PROPOSAL STATE MACHINE:
   DRAFT → KYC_VERIFIED → VEHICLE_VERIFIED → SUBMITTED_TO_INSURER → APPROVED | REJECTED

4. INSPECTION STATE MACHINE:
   NOT_REQUIRED → PENDING_UPLOAD → UPLOADED → UNDER_SURVEY → APPROVED | REJECTED

5. PAYMENT STATE MACHINE:
   INITIATED → RECORDED → RECONCILIATION_PENDING → RECONCILED → REFUNDED | CANCELLED

6. DOCUMENT VERIFICATION STATE MACHINE:
   UPLOADED → SCANNING → UNDER_REVIEW → VERIFIED → SUPERSEDED | REJECTED

7. ISSUANCE WORKBENCH STATE MACHINE:
   QUEUED → SUBMITTED_TO_INSURER → INSURER_CLARIFICATION → POLICY_RECEIVED → COMPLETED

8. POLICY LIFECYCLE STATE MACHINE:
   DRAFT → READY_FOR_ISSUANCE → SUBMITTED_TO_INSURER → ISSUED → ACTIVE → PENDING_RENEWAL → RENEWED | LAPSED | CANCELLED

9. RENEWAL STATE MACHINE:
   UPCOMING (45d) → CONTACTED → QUOTE_SENT → PAYMENT_RECEIVED → RENEWED | LOST_TO_COMPETITOR | EXPIRED

10. CLAIMS STATE MACHINE:
    SUBMITTED → UNDER_REVIEW → SURVEYOR_ASSIGNED → MORE_INFO_REQUIRED → APPROVED | REJECTED → SETTLED → CLOSED
```

### The Universal Cross-Domain Issuance Gate
A Policy may transition to `ISSUED` if and ONLY if `IssuanceEligibilityService` validates:
$$\text{Quote Accepted} \land (\text{ReconciledAmount} == \text{PayableAmount}) \land \text{Docs Verified} \land (\text{Inspection Approved} \lor \neg\text{Inspection Required}) \land \text{Insurer Schedule PDF Uploaded} \land \neg\text{Policy Exists}$$

---

# 3. FINANCIAL INVARIANTS & MOTOR PRICING

### 3.1 Motor Comprehensive Premium Formula
$$\text{Net OD} = (\text{Basic OD} + \text{Electrical} + \text{Non-Electrical} + \text{Bi-Fuel Kit}) - \text{Discounts} - \text{NCB Amount}$$
$$\text{Net TP} = \text{Basic TP} + \text{CPA (Owner-Driver)} + \text{LL to Paid Driver} + \text{TPPD Cover}$$
$$\text{Total Addons} = \sum (\text{Zero Dep} + \text{Engine Protect} + \text{Consumables} + \text{Roadside} + \text{RTI} + \text{Key Protect})$$
$$\text{Net Taxable Premium} = \text{Net OD} + \text{Net TP} + \text{Total Addons}$$
$$\text{GST (18\%)} = \text{Round}_{2}(\text{Net Taxable Premium} \times 0.18)$$
$$\text{Total Payable Premium} = \text{Net Taxable Premium} + \text{GST}$$

### 3.2 Financial Rules
1. **Exact Amount Match Invariant**: Payment reconciliation requires $\text{Payment.amount} == \text{Quotation.totalPremium}$. Underpayment ($\text{Amount} < \text{Payable}$) is rejected with `400 Bad Request`.
2. **Overpayment Rule**: If $\text{Amount} > \text{Payable}$, payment requires explicit manager approval with recorded excess amount and refund/credit adjustment sub-task.
3. **Decimal Precision**: All currency calculations use `Prisma.Decimal(12, 2)` or integer paise. JavaScript floating point (`number`) is forbidden for financial math.
4. **Immutable Calculation Snapshot**: Historical quotes never recalculate on re-render. All components are permanently preserved in the `calculationSnapshot` JSON.

---

# 4. ORGANIZATIONAL HIERARCHY & ACTOR CONTEXT

### 4.1 Hierarchy Tree
$$\text{Company (Organization)} \to \text{Region} \to \text{Zone} \to \text{Branch} \to \text{Department} \to \text{Team} \to \text{User}$$

### 4.2 ActorContext
```typescript
export interface ActorContext {
  userId: string;
  organizationId: string;
  branchId?: string;
  departmentId?: string;
  teamId?: string;
  roles: RoleType[];
  permissions: string[];
  workspaces: string[];
  status: UserStatus;
  delegations?: {
    delegatorUserId: string;
    validUntil: Date;
    permissions: string[];
  }[];
}
```

### 4.3 Scopes
* `OWN`: Records created by or assigned to `actor.userId`.
* `ASSIGNED`: Records assigned to `actor.userId` via operational queues.
* `TEAM`: Records belonging to `actor.teamId`.
* `BRANCH`: Records belonging to `actor.branchId`.
* `ORGANIZATION`: All records in `actor.organizationId`.
* `GLOBAL`: Platform administration (Super Admin only).

---

# 5. LEGACY AUTHORITY RETIREMENT PROTOCOL

No replacement implementation is complete until old authority paths are audited and retired:
```text
DISCOVER → MARK LEGACY → MIGRATE CALLERS → FEATURE FLAG → BLOCK WRITES → OBSERVE → DELETE
```

| Legacy Write Path | Action | Replacement Authority |
| :--- | :--- | :--- |
| `POST /policies` (Generic Direct Create) | **DELETE** | `PolicyLifecycleService.issue()` |
| `POST /quotations/:id/convert` | **DELETE** | `QuotationLifecycleService.accept()` $\to$ `PolicyLifecycleService.issue()` |
| `POST /motor/workflow/payment` (Unchecked Amount) | **REWRITE** | `PaymentLifecycleService.recordPayment()` with exact amount check |
| Direct `prisma.policy.create` in Controllers | **BLOCK** | Scoped `PolicyRepository` accessible ONLY to Domain Lifecycle Services |

---

# 6. DEFINITION OF DONE (DoD) & RELEASE GATES

Every iteration must satisfy the permanent 10-point gate:
1. **Contract Traceability**: Business rule $\to$ State Machine $\to$ DB Constraint $\to$ Domain Service $\to$ UI.
2. **ActorContext & Scoping**: User A cannot read or mutate User B's records across agents, teams, branches, or tenants.
3. **Database Invariants**: Unique constraints and transaction boundaries enforce state invariants independently of application code.
4. **Idempotency**: All retryable business mutations accept and enforce `Idempotency-Key`.
5. **No Fake Completion**: Frontend UI is a direct projection of server state. No static mock arrays or hardcoded cards.
6. **No Orphan State**: Every non-terminal record has an active `ownerId` and `nextAction`.
7. **Single Authority**: Only the designated Domain Lifecycle Service can execute mutations for that aggregate.
8. **Automated Abuse Suite**: Automated tests verify invalid transitions, underpayments, and BOLA attempts are blocked (`400`/`403`).
9. **Legacy Path Deleted**: Old controllers, routes, and services for this outcome are disabled and deleted.
10. **Audit Logged**: State transition, actor, evidence, and reason are committed within the same database transaction.
