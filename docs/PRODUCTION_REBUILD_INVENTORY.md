# PRODUCTION REBUILD INVENTORY — JEST POLICY CRM

**Version:** 4.0  
**Baseline Git HEAD:** `ef337f39e286dbb11452ee0273d2ca3845903321`  
**Status:** In Progress (Production Rebuild Execution)

---

## 1. Core Modules Inventory

| Module Name | Backend Module Path | Controller Path | Primary Prisma Model | Key Responsibilities |
|---|---|---|---|---|
| **Auth** | `apps/api/src/modules/auth` | `auth.controller.ts` | `User`, `RefreshToken` | JWT authentication, argon2 hashing, session tokens, tenant context |
| **Workspace** | `apps/api/src/modules/workspace` | `workspace.controller.ts` | `DashboardRegistry`, `User` | Authorized workspaces, role routing, navigation registry |
| **Contacts** | `apps/api/src/modules/contacts` | `contacts.controller.ts` | `Contact`, `Branch`, `Company` | Customer records, duplicate detection, branch assignment |
| **Customer 360** | `apps/api/src/modules/customer` | `customer-360.controller.ts` | `Contact`, `Policy`, `Lead` | Unified customer view, 11 tabs, timeline, document associations |
| **Leads** | `apps/api/src/modules/leads` | `leads.controller.ts` | `Lead`, `LeadStageHistory` | Sales pipeline, stage transitions, conversion to policy |
| **Quotation** | `apps/api/src/modules/quotation` | `quotation.controller.ts` | `Quotation`, `QuotationVersion` | Draft quotes, AUD-033 completion engine, version freezing |
| **Motor** | `apps/api/src/modules/motor` | `motor.controller.ts` | `MotorTariff`, `SaodTpVerification` | IRDAI TP tariff lookup, GST math, SAOD verification |
| **Inspections** | `apps/api/src/modules/inspections` | `inspections.controller.ts` | `MotorInspection` | Break-in inspection workflow (>90d), approval & uploads |
| **Policies** | `apps/api/src/modules/policies` | `policies.controller.ts` | `Policy`, `PolicyPayment` | Single issuance engine (`IssuePolicyService`), 9 gates, PDF |
| **Claims** | `apps/api/src/modules/claims` | `claims.controller.ts` | `Claim`, `ClaimDocument` | FNOL, active tenure check, survey, settlement |
| **Renewals** | `apps/api/src/modules/renewals` | `renewals.controller.ts` | `RenewalTask`, `RenewalJob` | Policy-derived dates, 45/30/15/7/0/-1 cadence, job durability |
| **Notifications** | `apps/api/src/modules/notifications` | `notifications.controller.ts` | `Notification`, `CommunicationLog` | Provider delivery acknowledgment, outbox dispatch |
| **Finance** | `apps/api/src/modules/finance` | `finance.controller.ts` | `Payment`, `Commission` | Payment capture, bank reconciliation, ledger entries |
| **Administration**| `apps/api/src/modules/administration` | `organization.controller.ts` | `Company`, `Branch`, `Role` | Multi-branch hierarchy, numbering sequences, system config |

---

## 2. Frontend Workspaces & Routes

| Route | Primary Component | Backing API Endpoint | Role Authorization |
|---|---|---|---|
| `/workspace/sales` | `SalesDashboard.tsx` | `GET /dashboard/sales`, `GET /leads` | `SALES_AGENT`, `SALES_MANAGER` |
| `/workspace/operations` | `MotorIssuanceQueue.tsx` | `GET /policies/back-office/queue` | `OPERATIONS`, `UNDERWRITER`, `ADMIN` |
| `/workspace/finance` | `DynamicWorkspace.tsx` | `GET /dashboard/finance`, `GET /finance` | `FINANCE`, `ADMIN` |
| `/workspace/renewal` | `DynamicWorkspace.tsx` | `GET /renewals`, `GET /renewals/tasks` | `RENEWAL_EXECUTIVE`, `SALES_AGENT` |
| `/workspace/admin` | `DynamicWorkspace.tsx` | `GET /admin/config/metrics` | `SUPER_ADMIN`, `ADMIN` |
| `/crm/contacts` | `CustomerRegisterPage` | `GET /contacts`, `POST /contacts` | All Authenticated |
| `/crm/contacts/:id`| `Customer360Master` | `GET /customer-360/:id` | All Authenticated (Scoped) |
| `/crm/leads` | `LeadCommandCenter` | `GET /leads`, `POST /leads` | Sales, Management, Admin |
| `/sales/quotations` | `MotorQuotationsWorkspace` | `GET /quotations`, `POST /quotations` | Sales, Underwriters |
| `/claims` | `ClaimsWorkspace` | `GET /claims`, `POST /claims` | Claims Officers, Support |
