# JEST Policy CRM — Business Logic & Domain Workflow Audit

**Audit Date:** October 15, 2026  
**Auditor Roles:** Senior Insurance Domain Business Analyst, Financial Systems Architect, Application Security Engineer  
**Status:** **AUDITED WITH IDENTIFIED DEFECTS & UNRESOLVED DECISIONS**  

---

## 1. Domain Workflow Analysis & State Machine Audits

### A. Authentication & Access Management
- **Implementation:** `AuthService`, `JwtAuthGuard`, `RolesGuard`.
- **Verified Behavior:**
  - Standard user login issues access token (15m TTL) and refresh token (7d TTL) with payload containing `userId`, `companyId`, `branchId`, and `role`.
  - Inactive/locked users rejected with 403 Forbidden.
  - Refresh token reuse invalidates the active family.
- **Audit Finding:** While authentication is sound, the frontend does not gracefully handle token expiry during multi-step forms (e.g. `MotorQuoteWizard`), leading to silent form submission failures.

### B. Customer & Contact Management
- **Implementation:** `CustomersService`, `ContactsService`, `Customer360Service`.
- **Verified Behavior:**
  - Contacts are strictly company-scoped (`companyId`). Duplicate detection runs against normalized phone and email.
  - Inverted role scoping bug remediated: ADMIN and BACK_OFFICE queries now enforce `companyId`.
- **Defect Detected (DEF-008):**
  - Customer underwriting notes and task dismissals in `CustomerTabsContainer.tsx` are written exclusively to `localStorage` (`customer_notes_${id}`). These notes are invisible to other agents, not backed up, and lost on cache clear.

### C. Lead Management
- **Implementation:** `LeadsService`, `LeadRoutingEngine`, `LeadLifecycleService`.
- **Verified Behavior:**
  - Leads advance through canonical state machine: `NEW` $\to$ `CONTACTED` $\to$ `QUALIFIED` $\to$ `CONVERTED` / `LOST`.
  - SALES_AGENT role restricted to assigned leads (`assignedToId === user.id`).
  - Conversion creates a Contact and Account transactionally.

### D. Motor Quotation & Underwriting Workflows
- **Implementation:** `MotorCalculationService`, `MotorTariffService`, `MotorRuleEngineService`, `MotorPolicyDateService`.
- **Verified Rules:**
  - **Statutory Third-Party (TP) Tariffs:** DB-driven lookup from `SystemConfig` based on vehicle category and engine CC / GVW.
  - **No Claim Bonus (NCB) Progression:** IRDAI slabs (0%, 20%, 25%, 35%, 45%, 50%) strictly enforced. Break-in >90 days resets NCB to 0%.
  - **Compulsory Personal Accident (CPA):** ₹15 Lakhs owner-driver PA cover premium (₹788 for private car) added unless customer declares an active CPA waiver.
  - **Break-in Inspection Trigger:** Automatically requires inspection when previous policy expired >90 days or policy break-in is reported.
- **Financial Defect Detected (DEF-009):**
  - `premium.service.ts:34` uses binary JavaScript floating-point arithmetic `Math.round(idv * rate * ccMultiplier)`.
  - At IDV ₹30,00,000, Zone A rate 0.03127, multiplier 1.15, JS float evaluates to `107881.49999999999` and rounds to **₹107,881**, whereas exact rational arithmetic (`107881.5`) rounds half-up to **₹107,882**. A 1-rupee discrepancy violates insurer tariff reconciliation.

### E. Motor Inspection State Machine & Photographic Evidence
- **Implementation:** `MotorInspectionService`, `MotorInspection` entity.
- **Rules:**
  - Inspection lifecycle: `REQUESTED` $\to$ `ASSIGNED` $\to$ `SUBMITTED` $\to$ `APPROVED` / `REJECTED`.
  - Inspection approval requires 7 mandatory photographic perspectives: Front, Back, Left, Right, Windshield, Chassis plate, and Odometer.
- **Persistence Defect Detected (DEF-010):**
  - `scripts/deep-system-churn-test.ts` Section 8 identified that `MotorInspectionService.approveInspection` can transition inspection state to `APPROVED` without asserting that all 7 required photo storage keys are populated.

### F. Policy Issuance & Policy Servicing
- **Implementation:** `IssuePolicyService`, `EndorsementService`, `NumberingEngineService`.
- **Verified Invariants:**
  - Policy issuance requires quotation in `APPROVED` status and payment in `PAID` status.
  - Concurrency test (100 parallel calls) demonstrated exact-once semantics (1 success, 99 HTTP 409 responses).
  - Numbering engine generates sequential, unique policy codes without collisions.
  - Endorsements for `PREMIUM_CHANGE` enforce statutory underwriting floor of ₹100 and perform authoritative server-side pro-rata differential calculation.

### G. Renewal Automation Engine
- **Implementation:** `RenewalEngineService`, `RenewalSchedulerCron`, `RenewalReminderProcessor`.
- **Verified Rules:**
  - Daily cron (`0 2 * * *`) scans active policies expiring within 60 days.
  - Enqueues BullMQ delay jobs for D-60, D-45, D-30, D-15, D-7, D-0, D+7 reminder schedule.
  - Carries forward NCB to the next IRDAI slab on renewal.
  - Synthetic actor context bypass remediated: queries strictly require `companyId`.

### H. Claims Management & State Machine Bypass
- **Implementation:** `ClaimsService`, `ReportClaimService`, `ClaimStateMachine`.
- **Rules:**
  - Claim lifecycle: `REPORTED` $\to$ `INTIMATED` $\to$ `DOCUMENTS_PENDING` $\to$ `UNDER_ASSESSMENT` $\to$ `SURVEYED` $\to$ `APPROVED` $\to$ `SETTLED` / `REJECTED` / `CLOSED`.
  - Only `BACK_OFFICE` and `ADMIN` can report or adjust claims.
- **Critical Integrity Defect Detected (DEF-003):**
  - The generic handler `PATCH /api/v1/claims/:id` directly updates `surveyorName`, `surveyorDetails`, and `approvedAmount` using `prisma.claim.update`.
  - The handler completely bypasses `ClaimStateMachine.validateTransition` and does not check if the claim status is already `SETTLED` or `CLOSED`.
  - As a result, an operator can arbitrarily overwrite the approved loss amount after financial settlement and general ledger posting.

### I. Commission Management & Financial Ledger
- **Implementation:** `CommissionEngineService`, `LedgerService`, `FinanceReconciliationService`.
- **Verified Rules:**
  - Accrues component-level commissions on policy issuance based on configured product slabs.
  - Reconciliation service prevents duplicate journal postings (concurrency test: 1 success, 99 409s).
- **UI Integrity Defect Detected (DEF-005):**
  - In `apps/web/src/app/finance/page.tsx`, the "Issue Premium Receipt" button triggers `toast.success('Receipt REC-2026-9901 issued successfully')` with zero network requests or database mutations.

### J. External Integrations & Webhooks
- **Implementation:** `WebhookGatewayController`.
- **Rules:**
  - Webhooks from payment gateways must be authenticated via cryptographic HMAC signatures.
- **Security Defect Detected (DEF-004):**
  - While Razorpay signatures are verified, `validateSignature` lacks a default-deny branch. If an attacker submits `POST /api/v1/webhooks/custom-provider`, the handler accepts the payload without checking any signature, records an idempotency key, and broadcasts internal domain events.

---

## 2. Contradictions & Unresolved Business Decisions

| Decision Topic | Current Code Behavior | Alternative Specification | Business Impact | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Customer Notes Persistence** | Stored in browser `localStorage` | Stored in database table with companyId | Notes lost across devices and on browser cache clear | **OPEN (DEF-008)** |
| **Terminal Claim Financial Edit** | Direct Prisma `PATCH` allows editing `approvedAmount` on `SETTLED` claim | Disallow edits once claim is in terminal state | Ledger and claims loss records diverge | **OPEN (DEF-003)** |
| **Money Currency Unit** | Mixed: Some APIs return decimal rupees; database models store integer paise | Strict integer minor units across all DTOs | Floating-point rounding errors and serialization ambiguity | **OPEN (DEF-009)** |
| **Webhooks Provider Allow-list** | Open string parameter `:provider` with Razorpay-only check | Strict enum of allowed providers with mandatory verification | Unauthorized event injection risk | **OPEN (DEF-004)** |
