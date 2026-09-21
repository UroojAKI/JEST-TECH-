# 01 — ROLE & SCOPE MATRIX
# JEST POLICY CRM — Engineering Contract
# Version: 3.0.0 | Status: BINDING | Architecture: 3-Role Canonical Model
# Every PR that touches authorization must reference this document.

---

## 1. CANONICAL ROLE LIST

| Code         | Display Name          | Workspaces Allowed                |
|:-------------|:----------------------|:----------------------------------|
| ADMIN        | Administrator         | Admin, Back Office, Agent / Sales |
| BACK_OFFICE  | Operations Officer    | Back Office, Agent / Sales        |
| AGENT        | Sales / POSP Agent    | Agent / Sales                     |

> [!NOTE]
> Operational personas (Underwriter, Claims Executive, Renewal Executive, Cashier) operate under the `BACK_OFFICE` role with granular permission flags. External inspectors/surveyors are coordinated via back-office workflows.

---

## 2. WORKSPACE ACCESS MATRIX

| Workspace    | ADMIN | BACK_OFFICE | AGENT |
|:-------------|:-----:|:-----------:|:-----:|
| Admin        |  ✓    |      ✗      |   ✗   |
| Back Office  |  ✓    |      ✓      |   ✗   |
| Agent / Sales|  ✓    |      ✓      |   ✓   |

---

## 3. MULTI-TENANT & SCOPE DIMENSIONS

Every access decision enforces:
- **TENANT (WHERE)**: `actor.companyId` MUST match `resource.companyId`. Cross-tenant access is blocked fail-closed for all roles.
- **IDENTITY (WHO)**: `actor.userId`, `actor.agentId`, `actor.role`.
- **AUTHORIZATION (HOW)**:
  - `ADMIN`: Tenant-wide access across all modules within `actor.companyId`.
  - `BACK_OFFICE`: Operational access across all records within `actor.companyId`.
  - `AGENT`: Scoped strictly to records where `companyId = actor.companyId AND (agentId = actor.agentId OR createdById = actor.userId)`.

---

## 4. RESOURCE ACTION PERMISSION TABLE

| Resource         | Action     | ADMIN | BACK_OFFICE | AGENT | Scoping Rule |
|:-----------------|:-----------|:-----:|:-----------:|:-----:|:-------------|
| Contact          | READ       |   ✓   |      ✓      |   ✓   | Tenant / Assigned |
| Contact          | CREATE     |   ✓   |      ✓      |   ✓   | Tenant / Own |
| Lead             | READ       |   ✓   |      ✓      |   ✓   | Tenant / Assigned |
| Lead             | CREATE     |   ✓   |      ✓      |   ✓   | Tenant / Own |
| Quotation        | CALCULATE  |   ✓   |      ✓      |   ✓   | Tenant / Own |
| Quotation        | ACCEPT     |   ✓   |      ✓      |   ✓   | Tenant / Own |
| Payment          | RECORD     |   ✓   |      ✓      |   ✓   | Tenant / Own |
| Payment          | RECONCILE  |   ✓   |      ✓      |   ✗   | Tenant Back Office |
| Inspection       | SUBMIT     |   ✓   |      ✓      |   ✗   | Tenant Back Office |
| Inspection       | APPROVE    |   ✓   |      ✓      |   ✗   | Tenant Back Office |
| Document         | UPLOAD     |   ✓   |      ✓      |   ✓   | Tenant / Assigned |
| Document         | VERIFY     |   ✓   |      ✓      |   ✗   | Tenant Back Office |
| Policy           | ISSUE      |   ✓   |      ✓      |   ✗   | Tenant Issuance Gate |
| Policy           | CANCEL     |   ✓   |      ✓      |   ✗   | Tenant Back Office |
| RenewalTask      | UPDATE     |   ✓   |      ✓      |   ✓   | Tenant / Assigned |
| Claim            | CREATE     |   ✓   |      ✓      |   ✓   | Tenant / Assigned |
| Claim            | APPROVE    |   ✓   |      ✓      |   ✗   | Tenant Back Office |
| AuditLog         | READ       |   ✓   |      ✗      |   ✗   | Tenant Admin |

