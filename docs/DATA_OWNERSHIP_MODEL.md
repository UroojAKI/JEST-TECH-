# DATA OWNERSHIP MODEL — JEST POLICY CRM
# Version: 3.0.0 | Status: BINDING | Architecture: 3-Role Canonical Model
# Every actionable record carries explicit tenant and entity ownership fields.
# Multi-tenant and user scope resolution strictly enforce these boundaries.

---

## 1. PRIMARY TENANT BOUNDARY: `companyId`

Every tenant-scoped entity in the database carries:
- `companyId` → Required foreign key referencing `Company.id`. Enforces strict tenant data isolation.
- `createdById` → User ID of the record creator.
- `updatedById` / `deletedAt` → Audit trail and soft-delete markers.

Cross-tenant queries are blocked fail-closed at the API authorization layer (`ResourceAuthorizationService`). No role (including `ADMIN`) can transcend `companyId` boundaries.

---

## 2. SCOPED ENTITIES & OWNERSHIP FIELDS

### Lead
- `companyId`: Tenant isolation key.
- `agentId`: Assigned Agent ID (`Agent.id`).
- `contactId`: Primary contact link.
- `customerId`: Converted customer link.
- `createdById`: Creator user ID.

### MotorQuotation / Quotation
- `companyId`: Tenant isolation key.
- `leadId`: Parent lead.
- `vehicleId`: Subject vehicle.
- `customerId`: Customer recipient.
- `agentId`: Originating agent ID (`Agent.id`).
- `agentCodeSnapshot`: Snapshot of agent code at quotation creation.
- `createdById`: Creator user ID.

### Policy
- `companyId`: Tenant isolation key.
- `quotationId`: Originating quotation.
- `agentId`: Originating agent ID.
- `contactId`: Insured contact.
- `customerId`: Insured customer.
- `createdById`: Issuing user ID (`BACK_OFFICE` or `ADMIN`).

### Claim
- `companyId`: Tenant isolation key.
- `policyId`: Target policy.
- `contactId`: Claimant contact.
- `customerId`: Claimant customer.
- `createdById`: Reporting user ID.

### Document
- `companyId`: Tenant isolation key.
- `entityType`: Polymorphic discriminator (`LEAD`, `CUSTOMER`, `CONTACT`, `QUOTATION`, `POLICY`, `CLAIM`).
- `entityId`: Associated record ID.
- `uploadedById`: Uploader user ID.

### RenewalTask / BackOfficeTask
- `policyId` / `quotationId`: Linked parent record.
- `agentId`: Assigned agent or executive ID.
- `createdById`: Task creator.

---

## 3. ROLE-BASED ACCESS OWNERSHIP CONTRACT

The system enforces 3 canonical roles:
1. **AGENT**:
   - Authorized only for records where:
     `companyId = actor.companyId AND (agentId = actor.agentId OR createdById = actor.userId)`
2. **BACK_OFFICE**:
   - Authorized for all operational records where:
     `companyId = actor.companyId`
3. **ADMIN**:
   - Authorized for all tenant records where:
     `companyId = actor.companyId`

---

## 4. OWNERSHIP TRANSITION & REASSIGNMENT

1. **Lead Reassignment**:
   - Back Office or Admin reassigns `agentId`.
   - Audit trail records: `{ actor, fromAgentId, toAgentId, reason, timestamp }`.
2. **Task & Renewal Assignment**:
   - Unassigned tasks are visible in the Back Office pool.
   - Assignment updates `agentId` with audit logging.
3. **User Deactivation**:
   - When a user or agent is deactivated, open leads, quotations, and active tasks are reassigned via the Admin Reassignment flow before deactivation completes.

