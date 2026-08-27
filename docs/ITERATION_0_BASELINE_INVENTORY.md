# JEST POLICY CRM — ITERATION 0 REPOSITORY BASELINE INVENTORY

**DATE:** 2026-08-26  
**STATUS:** COMPLETE & BASELINED  
**OBJECTIVE:** Establish exact repository baseline ("WHO CAN CHANGE WHAT, THROUGH WHICH PATH?") prior to executing remediation iterations.

---

## 1. Architecture & Component Map

```text
                               ┌────────────────────────────────────────────────────────┐
                               │               NEXT.JS WEB FRONTEND (apps/web)          │
                               │        Workspaces: Sales, Back Office, Renewal, CRM     │
                               └───────────────────────────┬────────────────────────────┘
                                                           │ (Axios apiClient with JWT)
                                                           ▼
                               ┌────────────────────────────────────────────────────────┐
                               │               NESTJS API GATEWAY (apps/api)            │
                               │        43 Controllers · Global Exception Filter · CORS │
                               └───────────────────────────┬────────────────────────────┘
                                                           │
                                ┌──────────────────────────┼───────────────────────────┐
                                ▼                          ▼                           ▼
                     ┌─────────────────────┐   ┌─────────────────────┐   ┌──────────────────────┐
                     │ DOMAIN SERVICES     │   │ DIRECT PRISMA CALLS │   │ REPOSITORIES (10)    │
                     │ 78 Services         │   │ (45+ Services       │   │ Lead, Policy, Quote, │
                     │ Pricing, Issuance   │   │  bypassing repos)   │   │ Contact, Claim...    │
                     └──────────┬──────────┘   └───────────┬─────────┘   └──────────┬───────────┘
                                │                          │                        │
                                └──────────────────────────┼────────────────────────┘
                                                           ▼
                               ┌────────────────────────────────────────────────────────┐
                               │               PRISMA ORM & POSTGRESQL 16               │
                               │        100+ Models · Decimal & Float · Multi-Tenant   │
                               └────────────────────────────────────────────────────────┘
```

---

## 2. Controller & Route Inventory (43 Controllers)

| Module | Controller File | Base Path | Exposed Actions | Auth Guard Status |
| :--- | :--- | :--- | :--- | :--- |
| **Auth** | `auth.controller.ts` | `/api/v1/auth` | `POST /login`, `POST /refresh`, `POST /logout` | Public (`/login`, `/refresh`), Protected (`/logout`) |
| **Motor** | `motor.controller.ts` | `/api/v1/motor` | `POST /calculate`, `POST /quotes`, `POST /issue` | `JwtAuthGuard` (Vulnerable to default backdoor) |
| **Motor Quote**| `motor-quote.controller.ts`| `/api/v1/motor/quotes` | `GET /`, `GET /:id`, `POST /` | `JwtAuthGuard` |
| **Motor Workflow**|`motor-workflow.controller.ts`|`/api/v1/motor/workflow`| `POST /inspection`, `POST /payment` | `JwtAuthGuard` |
| **Quotation** | `quotation.controller.ts` | `/api/v1/quotations` | `GET /`, `GET /:id`, `POST /`, `POST /:id/convert` | `JwtAuthGuard`, `RolesGuard` (Hardcoded string check) |
| **Policies** | `policies.controller.ts` | `/api/v1/policies` | `GET /`, `GET /:id`, `POST /` (Direct Create) | `JwtAuthGuard` (Direct create bypasses issuance gate) |
| **Leads** | `leads.controller.ts` | `/api/v1/leads` | `GET /`, `GET /:id`, `POST /`, `PATCH /:id` | `JwtAuthGuard` |
| **Contacts** | `contacts.controller.ts` | `/api/v1/contacts` | `GET /`, `GET /:id`, `POST /`, `PATCH /:id` | `JwtAuthGuard` |
| **Accounts** | `accounts.controller.ts` | `/api/v1/accounts` | `GET /`, `GET /:id`, `POST /` | `JwtAuthGuard` |
| **Claims** | `claims.controller.ts` | `/api/v1/claims` | `GET /`, `GET /:id`, `POST /`, `POST /:id/assign`| `JwtAuthGuard` |
| **Documents**| `documents.controller.ts` | `/api/v1/documents` | `POST /upload`, `GET /:id`, `DELETE /:id` | `JwtAuthGuard` |
| **Proposals** | `proposals.controller.ts` | `/api/v1/proposals` | `GET /`, `POST /`, `POST /:id/review` | `JwtAuthGuard` |
| **Finance** | `finance.controller.ts` | `/api/v1/finance` | `GET /ledgers`, `POST /payments` | `JwtAuthGuard` |
| **Commissions**|`commission.controller.ts` | `/api/v1/finance/commissions`| `GET /`, `POST /calculate` | `JwtAuthGuard` |
| **Customer 360**|`customer-360.controller.ts`|`/api/v1/customer-360`| `GET /:id` | `JwtAuthGuard` |
| **Workspaces**| `workspace.controller.ts` | `/api/v1/workspace` | `GET /` | `JwtAuthGuard` |
| **Dashboard** | `dashboard.controller.ts` | `/api/v1/dashboard` | `GET /` | `JwtAuthGuard` |
| **Reports** | `reports.controller.ts` | `/api/v1/reports` | `GET /`, `POST /run` | `JwtAuthGuard` |
| **Workflows** | `workflows.controller.ts` | `/api/v1/workflows` | `GET /`, `POST /transition` | `JwtAuthGuard` |
| **Audit** | `audit.controller.ts` | `/api/v1/audit` | `GET /logs` | `JwtAuthGuard` |

---

## 3. Alternate & Legacy Authority Path Inventory (Must Be Retired)

| Legacy Authority Path | File & Endpoint | Problem / Vulnerability | Remediation Target |
| :--- | :--- | :--- | :--- |
| **Generic Direct Policy Create** | `policies.controller.ts` (`POST /policies`) | Bypasses quote acceptance, payment reconciliation, inspection, and back-office verification. Creates `ACTIVE` policy directly in DB. | **RETIRE / DELETE** in Iteration 5. Redirect all issuance to `PolicyLifecycleService`. |
| **Unsafe Quotation Conversion** | `convert-quotation.service.ts` (`POST /quotations/:id/convert`) | Converts quote without checking payment or owner permissions. | **RETIRE / DELETE** in Iteration 5. Replaced by `IssuanceEligibilityService`. |
| **Client-Trusted Payment Entry** | `motor-payment-tracking.service.ts` (`POST /motor/workflow/payment`) | Accepts client `status: 'PAID'` and arbitrary `amount` without checking equality to `quotation.totalPremium`. | **REWRITE** in Iteration 7 with strict `ReconciledAmount == PayableAmount`. |
| **SuperAdmin Fallback Backdoor** | `jwt-auth.guard.ts` (Lines 18–38) | If unauthenticated, silently loads SuperAdmin user and grants `permissions: ['*']`. | **DELETE IMMEDIATELY** in Iteration 1. Reject unauthenticated requests with `401`. |
| **Client-Calculated Premium Trust**| `generate-quotation.service.ts` (Lines 80–84) | Trusts `dto.totalPremium` and `dto.gstAmount` if sent by client. Ignores TP premium calculation in formula. | **REWRITE** in Iteration 6 with authoritative server-side pricing engine. |
| **Silent Document Discard** | `motor-policy-issuance.service.ts` (Line 91) | Drops uploaded policy schedule PDF key from payload upon policy creation. | **REWRITE** in Iteration 8 to link `issuedPolicyDocumentId`. |

---

## 4. Database Schema & Invariants Inventory

### Models with Strong DB Constraints (Protected)
* `Policy.policyNumber` (`@unique`)
* `Policy.quotationId` (`@unique`)
* `Quotation.quotationCode` (`@unique`)
* `User.email` (`@unique`)
* `User.employeeCode` (`@unique`)
* `Company.code` (`@unique`)
* `Branch.code` (`@unique`)
* `Department.code` (`@unique`)

### Critical Invariants Missing at Database Layer (Vulnerable)
1. **Quotation Versioning**: Missing composite unique constraint on `(quotationGroupId, versionNumber)` and `(leadId, isAccepted)`.
2. **Renewal Tasks**: Missing composite unique constraint on `(policyId, renewalCycle, reminderStage)`.
3. **Payment Idempotency**: Missing unique constraint on `(organizationId, idempotencyKey)` and `(providerReference)`.
4. **Money Precision**: Several motor metadata fields reside in unindexed JSON blobs rather than typed Decimal columns.

---

## 5. Frontend Mock & Hardcoded Data Inventory

| Frontend Component | File Path | Hardcoded / Mock Issue | Remediation Target |
| :--- | :--- | :--- | :--- |
| **Customer 360 Tabs** | `apps/web/src/components/customer/tabs/CustomerTabsContainer.tsx` | Policies, claims, vehicles, family, and documents are hardcoded static mock arrays ("Sunita Mehta", "POL-001048"). | **REPLACE** in Iteration 13 with live API queries to `/api/v1/customers/:id/360`. |
| **Management Dashboard KPIs** | `apps/web/src/components/workspaces/DynamicWorkspace.tsx` | KPI cards (`KpiCard`) render static numbers with no click handlers or drill-down query links. | **REPLACE** in Iteration 14 with interactive drill-down links. |
| **Sales Workspace Local Storage**| `apps/web/src/components/sales/MotorQuotationsWorkspace.tsx` | Quotes are merged from `localStorage.getItem('jest_motor_quotes_global')`, enabling local data drift. | **REPLACE** in Iteration 10 with pure server-queried data. |

---

## 6. Test Suite & Coverage Baseline

* **Total Spec Files**: 35 test files in `apps/api/src`.
* **Broken Tests**: `workflow-engine.service.spec.ts` currently fails due to missing `QUEUE_PROVIDER_TOKEN` mock.
* **Missing Test Suites**:
  * No BOLA / IDOR cross-agent authorization test suite (`/test/security/bola.spec.ts`).
  * No financial decimal precision & payment underpayment abuse test suite.
  * No end-to-end multi-role lifecycle test suite (Lead $\to$ Policy $\to$ Renewal $\to$ Claim).

---

## 7. Iteration 0 Sign-Off

The baseline state is fully indexed and understood. We now proceed to **Iteration 1: ActorContext & Identity Baseline** and **Iteration 2: Central Resource Authorization**.
