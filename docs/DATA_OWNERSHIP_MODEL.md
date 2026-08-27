# DATA OWNERSHIP MODEL — JEST POLICY CRM
# Version: 1.0.0 | Status: BINDING | Branch: production-remediation
# Every actionable record must have explicit ownership fields.
# Scope resolution uses these fields. Client may not override them.

---

## OWNERSHIP FIELDS (Required on all scoped entities)

Every entity in the list below MUST carry:
  organizationId  → which org (currently single-org, but designed for multi-tenancy)
  branchId        → which physical/operational branch
  ownerId         → primary responsible person (agent, executive, etc.)
  createdById     → who created the record
  updatedById     → who last updated the record

Entities and their additional ownership fields:

Lead:
  assignedToId      (Sales Agent / Renewal Exec currently holding it)
  teamId
  branchId
  originalOwnerId   (first assigned; for tracking reassignments)

QuotationGroup:
  ownerId           (Sales Agent)
  teamId
  branchId

QuotationVersion:
  calculatedById
  sharedById
  acceptedById

Proposal:
  preparedById      (typically Sales Agent)
  assignedToId      (Back Office Issuance Executive)

Document:
  uploadedById
  verifiedById
  ownedByEntityType  (Lead | Customer | Proposal | Policy | Claim)
  ownedByEntityId

Inspection:
  requestedById
  assignedToId       (Inspector)
  reviewedById

PaymentRecord:
  recordedById
  reconciledById
  quotationVersionId  (links to accepted version)

Policy:
  issuedById         (Back Office Exec)
  assignedAgentId    (originating Sales Agent)
  branchId

InsurerPolicyDetail:
  capturedById       (Back Office Exec who entered insurer data)
  approvedById       (for premium variance approval)

RenewalTask:
  assignedToId       (Renewal Executive)
  teamId
  branchId
  createdFromPolicyId

Claim:
  assignedToId       (Claims Executive)
  teamId
  branchId
  createdFromPolicyId

---

## OWNERSHIP TRANSITION RULES

1. Lead reassignment:
   - Only Sales Manager or Branch Manager may reassign.
   - Reassignment creates AuditLog: { actor, fromUserId, toUserId, reason, timestamp }
   - Previous owner retains READ access for 7 days after reassignment (configurable).

2. Case reassignment (Issuance / Renewal / Claims):
   - Only Operations/Renewal/Claims Manager may reassign.
   - Audit logged.

3. Employee departure:
   - Triggered by SUPER_ADMIN deactivating a user.
   - System shows transfer wizard for: open leads, open tasks, open renewals, open claims.
   - All must be explicitly reassigned before account is deactivated.

---

## ORPHAN PREVENTION RULES

A record MUST NOT exist without an owner:
  Lead.assignedToId IS NOT NULL (assigned at creation, or to a team pool)
  RenewalTask.assignedToId may be NULL only in UNASSIGNED bucket (queue-based)
  Document.ownedByEntityId IS NOT NULL
  Claim.assignedToId IS NOT NULL after SUBMITTED state

Unassigned pool:
  RenewalTask with assignedToId = NULL → visible in "Unassigned" bucket to Renewal Manager.
  System SLA: unassigned tasks > 24h → escalated automatically.

---

## MULTI-TENANCY PREPARATION

Although JEST is currently single-organization, every entity carries organizationId.
This ensures future multi-tenancy without schema migration.
Data isolation between organizations is enforced at every query:
  WHERE organizationId = actor.organizationId
