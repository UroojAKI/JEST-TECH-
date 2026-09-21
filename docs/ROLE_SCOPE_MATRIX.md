# ROLE & SCOPE MATRIX — JEST POLICY CRM
# Version: 3.0.0 | Status: BINDING | Architecture: 3-Role Canonical Model
# This document defines the canonical role model, workspace access, and data scopes.
# Enforced by database enum RoleType { ADMIN, BACK_OFFICE, AGENT }.

---

## 1. CANONICAL ROLES

| Role Code    | Display Name    | Primary Workspaces                | Scope Default    |
|:-------------|:----------------|:----------------------------------|:-----------------|
| ADMIN        | Administrator   | Admin, Back Office, Agent / Sales | ORGANIZATION     |
| BACK_OFFICE  | Operations      | Back Office, Agent / Sales        | ORGANIZATION     |
| AGENT        | Sales / POSP    | Agent / Sales                     | OWN / ASSIGNED   |

> [!NOTE]
> Specialized operational personas (such as Underwriter, Claims Officer, Renewal Specialist, and Cashier) operate under the `BACK_OFFICE` role with appropriate granular permissions configured via the permissions engine.

---

## 2. WORKSPACE ACCESS MATRIX

| Workspace    | ADMIN | BACK_OFFICE | AGENT | Description |
|:-------------|:-----:|:-----------:|:-----:|:------------|
| Admin        | ✓     | ✗           | ✗     | System settings, user provisioning, lookups, numbering, audit logs |
| Back Office  | ✓     | ✓           | ✗     | Policy issuance, underwriting, payment reconciliation, inspections |
| Agent / Sales| ✓     | ✓           | ✓     | Lead management, quotation generation, proposal submission, book-of-business |

---

## 3. DATA SCOPE BY ROLE

### AGENT
- **READ**: Own assigned leads, own customers, own motor quotations, own proposals, and policies where agent is designated producer.
- **WRITE**: Own leads, own draft quotations (`DRAFT` → `SHARED`), proposal submissions.
- **CANNOT**: Access other agents' records, finance ledgers, administrative configurations, or issue policies directly.
- **Scope Enforced**: `companyId = actor.companyId AND (agentId = actor.agentId OR createdById = actor.userId)`.

### BACK_OFFICE
- **READ**: All operational records within the tenant company (leads, quotations, proposals, policies, claims, inspections, payments).
- **WRITE**: Issue policies, approve inspections, reconcile payments, process claims, update renewal tasks.
- **CANNOT**: Modify system administrative configurations, provision users, or access cross-tenant data.
- **Scope Enforced**: `companyId = actor.companyId`.

### ADMIN
- **READ**: All operational, financial, and administrative records within the tenant company.
- **WRITE**: User provisioning, role & permission assignments, lookup masters, numbering sequences, feature flags.
- **CANNOT**: Cross tenant boundaries (tenant isolation is fail-closed).
- **Scope Enforced**: `companyId = actor.companyId`.

---

## 4. RESOURCE ACTION PERMISSION MATRIX

| Resource    | Action    | ADMIN | BACK_OFFICE | AGENT | Scoping Rule |
|:------------|:----------|:-----:|:-----------:|:-----:|:-------------|
| CONTACT     | CREATE    | ✓     | ✓           | ✓     | Tenant / Own |
| CONTACT     | READ      | ✓     | ✓           | ✓     | Tenant / Assigned |
| CONTACT     | UPDATE    | ✓     | ✓           | ✓     | Tenant / Own |
| CONTACT     | DELETE    | ✓     | ✗           | ✗     | Tenant (Soft-delete) |
| LEAD        | CREATE    | ✓     | ✓           | ✓     | Tenant / Own |
| LEAD        | READ      | ✓     | ✓           | ✓     | Tenant / Assigned |
| LEAD        | UPDATE    | ✓     | ✓           | ✓     | Tenant / Assigned |
| LEAD        | DELETE    | ✓     | ✗           | ✗     | Tenant (Soft-delete) |
| QUOTE       | CREATE    | ✓     | ✓           | ✓     | Tenant / Own |
| QUOTE       | READ      | ✓     | ✓           | ✓     | Tenant / Assigned |
| QUOTE       | UPDATE    | ✓     | ✓           | ✓     | Tenant / Assigned |
| QUOTE       | DELETE    | ✓     | ✗           | ✗     | Tenant (Soft-delete) |
| POLICY      | CREATE    | ✓     | ✓           | ✗     | Tenant Issuance Gate |
| POLICY      | READ      | ✓     | ✓           | ✓     | Tenant / Assigned |
| POLICY      | UPDATE    | ✓     | ✓           | ✗     | Tenant Back Office |
| POLICY      | DELETE    | ✓     | ✗           | ✗     | Tenant Admin |
| RENEWAL     | READ      | ✓     | ✓           | ✓     | Tenant / Assigned |
| RENEWAL     | UPDATE    | ✓     | ✓           | ✓     | Tenant / Assigned |
| CLAIM       | CREATE    | ✓     | ✓           | ✓     | Tenant / Assigned |
| CLAIM       | READ      | ✓     | ✓           | ✓     | Tenant / Assigned |
| CLAIM       | UPDATE    | ✓     | ✓           | ✗     | Tenant Back Office |
| INSPECTION  | UPDATE    | ✓     | ✓           | ✗     | Tenant Back Office |
| USER        | MANAGE    | ✓     | ✗           | ✗     | Tenant Admin |
| REPORT      | READ      | ✓     | ✓           | ✓     | Tenant / Own |
| ADMIN       | MANAGE    | ✓     | ✗           | ✗     | Tenant Admin |

---

## 5. MULTI-TENANT ISOLATION RULES

1. **Strict Tenant Boundaries**:
   Every database query and mutation MUST include `companyId: actor.companyId`. No user role (including `ADMIN`) may transcend organizational tenant boundaries.
2. **Actor Context Integrity**:
   All controllers resolve the actor identity (`userId`, `companyId`, `agentId`, `role`) exclusively from verified JWT / session context (`@CurrentUser()`). Client-supplied IDs in query strings or request bodies are never trusted as authorization boundaries.
3. **Agent Book-of-Business Isolation**:
   Agents in the same company cannot view or modify each other's leads, quotes, or proposals unless explicitly reassigned by Back Office or Admin users.

