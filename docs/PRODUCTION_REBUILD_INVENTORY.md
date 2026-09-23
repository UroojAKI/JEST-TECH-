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

---

## 3. Active vs Legacy Route Inventory (F-050)

### Canonical Active Routes
- **Authentication**: `/login` (Session bootstrap, cookie token exchange, role redirect)
- **Role Portals**:
  - `/portal` (Agent dashboard, live metrics, quick actions)
  - `/portal/leads` (Lead pipeline, creation, assignment)
  - `/portal/quotations` (Quotation comparison engine, proposal handoff)
  - `/portal/policies` (Active book-of-business, policy detail)
  - `/portal/renewals` (Upcoming renewals queue: 45/30/15/7-day buckets)
  - `/portal/commissions` (Authoritative commission ledger)
  - `/portal/branch-manager` (Branch manager aggregate metrics)
- **Operational & CRM Workspaces**:
  - `/crm/leads`, `/crm/contacts`, `/crm/customers`, `/crm/accounts`
  - `/policies`, `/policies/[id]` (Policy lifecycle, endorsements, documents)
  - `/claims` (FNOL, inspection assignment, survey, settlement)
  - `/finance/payments`, `/finance/commissions`, `/finance/ledger`
- **Administration Cockpit**:
  - `/admin/health` (Live microservice, PostgreSQL, Redis, outbox monitors)
  - `/admin/production-readiness` (Automated quality gates, certification status)
  - `/admin/users`, `/admin/roles`, `/admin/branches`, `/admin/config`
  - `/admin/vehicle-master`, `/admin/workflows`, `/admin/audit`

### Legacy & Transition Routes
- `/workspace/sales` → Maintained as workspace redirect to canonical `/portal` or `/crm/leads`
- `/workspace/operations` → Maintained as operations redirect to `/policies/back-office/queue`
- `/workspace/admin` → Maintained as administrative redirect to `/admin`

---

## 4. Architecture Alignment & Deployment Topology (F-049)

- **Containerization**: Dual Dockerfiles (`apps/api/Dockerfile`, `apps/web/Dockerfile`) utilizing Node 20/22 alpine, non-root system users (`nestjs`, `nextjs`), and strictly enforced `--frozen-lockfile`.
- **Orchestration**: Kubernetes manifests in `k8s/` (`api-deployment.yaml`, `api-service.yaml`, `api-secret.yaml`, `api-configmap.yaml`, `api-hpa.yaml`, `api-ingress.yaml`).
- **Health Probes**:
  - Liveness: `GET /api/v1/health/live`
  - Readiness: `GET /api/v1/health/ready` (Verifies DB ping, cache readiness, and disk storage)
  - Metrics: `GET /api/v1/metrics` (Secured by `MetricsAuthGuard` requiring ADMIN role or valid scrape token)
- **Data Protection**:
  - PII Encryption at rest via AES-256-GCM with dynamic 16-byte random salt.
  - Fail-closed multi-tenancy enforced at controller, service, and database migration layers.

---

## 5. Canonical Role Model & Persona Mapping (F-048)

The system enforces a 3-tier canonical database role model (`RoleType`):
1. **ADMIN**: Full administrative and organizational authority within the tenant company.
2. **BACK_OFFICE**: Operational authority over underwriting, policy issuance, inspections, claims, and finance reconciliation.
3. **AGENT**: Sales and POSP operations scoped strictly to own assigned leads, quotations, and produced policies.

Functional job titles (e.g. Sales Executive, Renewal Manager, Underwriter, Cashier) map dynamically to granular permissions via `JobRole` and `Department` records without fragmenting the database enum.

