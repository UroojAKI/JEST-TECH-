# JEST TECHNOLOGIES — Authoritative API Authority Matrix
## Baseline Specification: Endpoint Inventory, Tenant Guards, Financial Authority & Lifecycle Roles

> [!IMPORTANT]
> **GOVERNING ARCHITECTURAL INVARIANT:**
> Every endpoint in the platform belongs to exactly one domain authority. Cross-cutting mutations must pass through `TenantResourceAuthorizationService`, verify actor assignment/role, enforce state machine preconditions, and prohibit bypass paths.

---

## 1. Core Motor Journey & Underwriting Endpoints

| Method | Route | Domain | Tenant Check | Allowed Roles | Precondition State | Financial Check | Idempotent | Creates Policy | Authority Handler |
|---|---|---|---|---|---|---|---|---|---|
| `POST` | `/motor/journeys` | Motor | ✓ Mandatory (`companyId`) | `AGENT`, `BACK_OFFICE`, `ADMIN` | — | None | Key-scoped | **No** | `MotorJourneyService.createJourney` |
| `GET` | `/motor/journeys/:id` | Motor | ✓ Mandatory (`companyId` + ownership) | `AGENT`, `BACK_OFFICE`, `ADMIN` | Exists & Not Expired | None | Safe (GET) | **No** | `MotorJourneyService.getJourney` |
| `POST` | `/motor/vehicles/verify-plate` | Motor | ✓ Mandatory (`companyId` + ownership) | `AGENT`, `BACK_OFFICE`, `ADMIN` | Journey `ACTIVE`, Attempts < 3 | None | Atomic Locked | **No** | `VehicleDataService.verifyPlate` |
| `POST` | `/motor/rules/evaluate` | Motor | ✓ Mandatory (`companyId` + ownership) | `AGENT`, `BACK_OFFICE`, `ADMIN` | Journey `ACTIVE` | Statutory NCB Ceiling | Safe/Stateless | **No** | `MotorRulesEvaluateController.evaluateRules` |
| `POST` | `/motor/calculate` | Motor | ✓ Mandatory (`companyId`) | `AGENT`, `BACK_OFFICE`, `ADMIN` | — | Authoritative Tariff & Ceiling | Safe/Stateless | **No** | `MotorCalculationService.calculatePremium` |
| `POST` | `/quotations/motor-capture` | Motor | ✓ Mandatory (`companyId` + ownership) | `AGENT`, `BACK_OFFICE`, `ADMIN` | Journey `ACTIVE` (1:1 quote) | Snapshot Match | ✓ Required | **No** | `CreateMotorQuotationCommand.execute` |
| `GET` | `/motor-quotations` | Motor | ✓ Mandatory (`where: { companyId }`) | `AGENT`, `BACK_OFFICE`, `ADMIN` | Authenticated | None | Safe (GET) | **No** | `MotorQuotationController.getQuotations` |

---

## 2. Proposal Lifecycle Endpoints

| Method | Route | Domain | Tenant Check | Allowed Roles | Precondition State | Financial Check | Idempotent | Creates Policy | Authority Handler |
|---|---|---|---|---|---|---|---|---|---|
| `POST` | `/proposals` | Proposal | ✓ Mandatory (`companyId`) | `AGENT`, `BACK_OFFICE`, `ADMIN` | Quotation `READY_FOR_PROPOSAL` | Matches Quote Premium | Key-scoped | **No** | `ProposalService.createProposal` |
| `GET` | `/proposals/:id` | Proposal | ✓ Mandatory (`companyId` + ownership) | `AGENT`, `BACK_OFFICE`, `ADMIN` | Authenticated | None | Safe (GET) | **No** | `ProposalService.getProposal` |
| `POST` | `/proposals/:id/submit` | Proposal | ✓ Mandatory (`companyId` + ownership) | `AGENT`, `CUSTOMER`, `ADMIN` | `PROPOSAL_IN_PROGRESS` | None | ✓ Required | **No** | `ProposalService.submitProposal` |
| `POST` | `/proposals/:id/approve` | Proposal | ✓ Mandatory (`companyId`) | `BACK_OFFICE`, `ADMIN` (SoD: != Creator) | `PROPOSAL_COMPLETED` | None | ✓ Required | **No (NEVER Motor)** | `ProposalService.approveProposal` |
| `POST` | `/proposals/:id/reject` | Proposal | ✓ Mandatory (`companyId`) | `BACK_OFFICE`, `ADMIN` | `PROPOSAL_COMPLETED` | None | ✓ Required | **No** | `ProposalService.rejectProposal` |

---

## 3. Payment & Exact Reconciliation Endpoints

| Method | Route | Domain | Tenant Check | Allowed Roles | Precondition State | Financial Check | Idempotent | Creates Policy | Authority Handler |
|---|---|---|---|---|---|---|---|---|---|
| `POST` | `/motor/quotations/:id/payment` | Payment | ✓ Mandatory (`companyId`) | `AGENT`, `BACK_OFFICE`, `ADMIN` | `PROPOSAL_APPROVED` & `PAYMENT_PENDING` | Exact Decimal Match (`paid.equals(total)`) | ✓ Required (Resource-bound) | **No** | `MotorPaymentTrackingService.recordPayment` |
| `POST` | `/motor/quotations/:id/confirm-payment` | Payment | ✓ Mandatory (`companyId`) | `ACCOUNTS`, `BACK_OFFICE`, `ADMIN` | `PAYMENT_UNDER_PROCESS` | UTR / Clearance match | ✓ Required | **No** | `MotorPaymentTrackingService.confirmPayment` |

---

## 4. Break-in Inspection & Photo Review Endpoints

| Method | Route | Domain | Tenant Check | Allowed Roles | Precondition State | Financial Check | Idempotent | Creates Policy | Authority Handler |
|---|---|---|---|---|---|---|---|---|---|
| `POST` | `/motor/inspections/:id/upload-photo` | Inspection | ✓ Mandatory (`companyId`) | `AGENT`, `CUSTOMER` | `INSPECTION_REQUIRED` / `REWORK` | None | ✓ Required | **No** | `MotorInspectionService.uploadPhoto` |
| `POST` | `/motor/inspections/:id/submit-for-review` | Inspection | ✓ Mandatory (`companyId`) | `AGENT`, `CUSTOMER` | 7 Mandatory Photos Uploaded | None | ✓ Required | **No** | `MotorInspectionService.submitForReview` |
| `POST` | `/motor/inspections/:id/approve` | Inspection | ✓ Mandatory (`companyId`) | `BACK_OFFICE`, `ADMIN` (SoD: != Creator) | `INSPECTION_SUBMITTED` | None | ✓ Required | **No** | `MotorInspectionService.approveInspection` |
| `POST` | `/motor/inspections/:id/reject` | Inspection | ✓ Mandatory (`companyId`) | `BACK_OFFICE`, `ADMIN` | `INSPECTION_SUBMITTED` | None | ✓ Required | **No** | `MotorInspectionService.rejectInspection` |

---

## 5. Policy Issuance & Conversion Endpoints

| Method | Route | Domain | Tenant Check | Allowed Roles | Precondition State | Financial Check | Idempotent | Creates Policy | Authority Handler |
|---|---|---|---|---|---|---|---|---|---|
| `POST` | `/motor/quotes/:id/issue` | Issuance | ✓ Mandatory (`companyId`) | `BACK_OFFICE`, `ADMIN` | `ISSUANCE_PENDING` (`PAYMENT_DONE` & Inspection completed) | Reconciles Snapshot | ✓ Atomic Mutex | **Yes (Motor Sole Authority)** | `MotorPolicyIssuanceService.issuePolicy` |
| `POST` | `/quotations/:id/convert` | Core | ✓ Mandatory (`companyId`) | `AGENT`, `BACK_OFFICE`, `ADMIN` | `QUOTATION_READY` | None | ✓ Required | **No (HTTP 409 if MOTOR)** | `ConvertQuotationService.convert` |

---

## 6. Document Storage & Restoration Endpoints

| Method | Route | Domain | Tenant Check | Allowed Roles | Precondition State | Financial Check | Idempotent | Creates Policy | Authority Handler |
|---|---|---|---|---|---|---|---|---|---|
| `POST` | `/documents/upload` | Document | ✓ Mandatory (`companyId`) | `AGENT`, `BACK_OFFICE`, `ADMIN` | Authenticated | None | Checksum verified | **No** | `DocumentService.uploadDocument` |
| `GET` | `/documents/:id/download` | Document | ✓ Mandatory (`companyId` + ownership) | `AGENT`, `BACK_OFFICE`, `ADMIN` | Document Active | None | Safe (GET) | **No** | `DocumentService.downloadDocument` |
| `POST` | `/documents/:id/restore` | Document | ✓ Mandatory (`companyId` + ownership) | `BACK_OFFICE`, `ADMIN` | Document Soft-Deleted | None | ✓ Required | **No** | `DocumentService.restoreDocument` |

---

## 7. Reporting & Analytics Endpoints

| Method | Route | Domain | Tenant Check | Allowed Roles | Precondition State | Financial Check | Idempotent | Creates Policy | Authority Handler |
|---|---|---|---|---|---|---|---|---|---|
| `GET` | `/reports` | Reporting | ✓ Mandatory (`where: { companyId }`) | `BACK_OFFICE`, `ADMIN`, `MANAGEMENT` | Authenticated | None | Safe (GET) | **No** | `ReportsController.getReports` |
| `POST` | `/reports/schedules` | Reporting | ✓ Mandatory (`companyId`) | `ADMIN`, `MANAGEMENT` | Valid Cron & Template | None | Key-scoped | **No** | `ReportsController.createSchedule` |
| `POST` | `/reports/:id/execute` | Reporting | ✓ Mandatory (`companyId`) | `ADMIN`, `MANAGEMENT` | Active Report Template | None | Key-scoped | **No** | `ReportExecutionService.executeReport` |
| `GET` | `/dashboard/analytics` | Analytics | ✓ Mandatory (`where: { companyId }`) | All Authenticated | Authenticated | Tenant-scoped GWP | Safe (GET) | **No** | `DashboardAnalyticsController.getMetrics` |

---

## 8. Explicitly Prohibited Alternative Paths & Security Invariants

```text
PROHIBITED ACTION                                    ENFORCEMENT MECHANISM
-------------------------------------------------------------------------------------------------------------
Generic /quotations/:id/convert on MOTOR            -> HTTP 409 Conflict (MOTOR_WORKFLOW_REQUIRES_MOTOR_ISSUANCE)
Proposal approval creating Motor policy              -> ProposalWorkflowAdapter blocked from policy.create for MOTOR
Direct payment recording creating Motor policy       -> MotorPaymentTrackingService only marks PAYMENT_DONE
Direct client manipulation of NCB                    -> Clamped to statutory ceiling; verified via hierarchy
Client overriding add-on price with manualPrice      -> Ignored; tariff resolved or validated deviation required
Direct client submission of policy effective dates   -> Server-authoritative IST dates strictly override client
Bypassing inspection for break-in vehicles           -> Gate enforced at ISSUANCE_PENDING transition
Cross-tenant resource reference in quotation capture -> HTTP 403 Forbidden by TenantResourceAuthorizationService
Replaying quotation capture on already QUOTED journey-> HTTP 409 Conflict (JOURNEY_ALREADY_QUOTED)
Concurrent double policy issuance                    -> Atomic SQL mutex (UPDATE ... WHERE status = ISSUANCE_PENDING)
```
