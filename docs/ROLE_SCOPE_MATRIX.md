# ROLE & SCOPE MATRIX — JEST POLICY CRM
# Version: 1.0.0 | Status: BINDING | Branch: production-remediation
# This document defines every role, their workspace access, and their data scope.
# No module may independently define authorization logic.

---

## ROLES (Canonical List)

| Role Code         | Display Name          | Department   |
|:------------------|:----------------------|:-------------|
| SUPER_ADMIN       | System Administrator  | IT           |
| COMPLIANCE_OFFICER| Compliance Officer    | Compliance   |
| MD                | Managing Director     | Management   |
| BRANCH_MANAGER    | Branch Manager        | Management   |
| SALES_MANAGER     | Sales Manager         | Sales        |
| SALES_AGENT       | Sales Agent           | Sales        |
| POSP_AGENT        | POSP Agent            | Sales        |
| FINANCE_MANAGER   | Finance Manager       | Finance      |
| FINANCE_EXECUTIVE | Finance Executive     | Finance      |
| OPERATIONS_MANAGER| Operations Manager    | Back Office  |
| ISSUANCE_EXECUTIVE| Issuance Executive    | Back Office  |
| RENEWAL_MANAGER   | Renewal Manager       | Renewals     |
| RENEWAL_EXECUTIVE | Renewal Executive     | Renewals     |
| CLAIMS_MANAGER    | Claims Manager        | Claims       |
| CLAIMS_EXECUTIVE  | Claims Executive      | Claims       |
| CUSTOMER_PORTAL   | Customer (Self-serve) | External     |

---

## WORKSPACE ACCESS MATRIX

| Workspace    | SUPER_ADMIN | MD | BRANCH_MGR | SALES_MGR | SALES_AGENT | POSP | FINANCE_MGR | FINANCE_EXEC | OPS_MGR | ISSUANCE_EXEC | RENEWAL_MGR | RENEWAL_EXEC | CLAIMS_MGR | CLAIMS_EXEC | COMPLIANCE |
|:------------|:-----------:|:--:|:----------:|:---------:|:-----------:|:----:|:-----------:|:------------:|:-------:|:-------------:|:-----------:|:------------:|:----------:|:-----------:|:----------:|
| Admin        | ✓           |    |            |           |             |      |             |              |         |               |             |              |            |             |            |
| Management   | ✓           | ✓  | ✓          |           |             |      |             |              |         |               |             |              |            |             |            |
| Sales        | ✓           |    | ✓          | ✓         | ✓           | ✓    |             |              |         |               |             |              |            |             |            |
| Finance      | ✓           |    | ✓          |           |             |      | ✓           | ✓            |         |               |             |              |            |             |            |
| Operations   | ✓           |    | ✓          |           |             |      |             |              | ✓       | ✓             |             |              |            |             |            |
| Renewals     | ✓           |    | ✓          |           |             |      |             |              |         |               | ✓           | ✓            |            |             |            |
| Claims       | ✓           |    | ✓          |           |             |      |             |              |         |               |             |              | ✓          | ✓           |            |
| Compliance   | ✓           |    |            |           |             |      |             |              |         |               |             |              |            |             | ✓          |
| Portal       | —           | —  | —          | —         | —           | —    | —           | —            | —       | —             | —           | —            | —          | —           | —          | (customer-only) |

---

## DATA SCOPE BY ROLE

### SALES_AGENT
- READ: Own assigned leads, own customers, own quotations, own proposals
- WRITE: Own leads, own quotations (DRAFT → SHARED)
- CANNOT: Other agent's records, finance records, back-office cases, policy issuance
- Scope: mine

### POSP_AGENT
- Same as SALES_AGENT
- Additional restriction: Cannot approve own quotes; requires Sales Manager approval
- Scope: mine

### SALES_MANAGER
- READ: All records owned by agents in own team(s)
- WRITE: Reassign leads within team, approve quotes
- Scope: team | mine

### BRANCH_MANAGER
- READ: All records in own branch
- WRITE: Reassign within branch, approve escalations
- Scope: branch | team | mine

### MD
- READ: All branches, all teams (organization-wide)
- WRITE: Configuration, approval of >threshold actions
- Scope: org | branch | team | mine

### FINANCE_EXECUTIVE
- READ: PaymentRecord, PaymentReconciliation, QuotationVersion (premium only)
- WRITE: Reconcile payments, flag exceptions
- CANNOT: Modify quotation pricing, issue policy, change lead assignment
- Scope: branch (or configured)

### FINANCE_MANAGER
- READ: All finance records in branch/org
- WRITE: Approve reconciliation exceptions, initiate refunds
- Scope: branch | org

### ISSUANCE_EXECUTIVE
- READ: Cases in READY_FOR_ISSUANCE state, linked documents, inspection, payment
- WRITE: Submit to insurer, capture insurer policy details, upload policy document
- CANNOT: Modify payment reconciliation, change quotation, alter customer data
- Scope: assigned queue | unassigned queue

### OPERATIONS_MANAGER
- READ: All issuance cases in branch
- WRITE: Reassign cases, approve escalations
- Scope: branch | team

### RENEWAL_EXECUTIVE
- READ: Own assigned RenewalTask records
- WRITE: Update task state, create renewal quotation, log contact
- CANNOT: Modify issued policy financial data, change payment
- Scope: mine

### RENEWAL_MANAGER
- READ: All renewal tasks in team/branch
- WRITE: Reassign tasks, approve lost cases
- Scope: team | branch

### CLAIMS_EXECUTIVE
- READ: Own assigned Claim records
- WRITE: Update claim state, request documents, assign surveyor
- Scope: mine

### CLAIMS_MANAGER
- READ: All claims in branch
- WRITE: Approve/reject claims, assign executives
- Scope: branch | team

### COMPLIANCE_OFFICER
- READ: AuditLog (all), PII access log, permission changes
- WRITE: Flag compliance issues
- CANNOT: Modify operational records
- Scope: org (read-only audit)

### SUPER_ADMIN
- READ: Everything
- WRITE: User management, role assignment, system config
- CANNOT (by policy): Cannot perform financial mutations, cannot issue policies directly

---

## RESOURCE ACTION PERMISSION MATRIX

| Resource         | Action     | SALES_AGENT | SALES_MGR | BRANCH_MGR | FINANCE | ISSUANCE | RENEWAL | CLAIMS | COMPLIANCE | MD |
|:-----------------|:-----------|:-----------:|:---------:|:----------:|:-------:|:--------:|:-------:|:------:|:----------:|:--:|
| Lead             | READ       | own         | team      | branch     | ✗       | ✗        | ✗       | ✗      | ✗          | org|
| Lead             | CREATE     | ✓           | ✓         | ✓          | ✗       | ✗        | ✗       | ✗      | ✗          | ✗  |
| Lead             | ASSIGN     | ✗           | team      | branch     | ✗       | ✗        | ✗       | ✗      | ✗          | org|
| QuotationVersion | READ       | own         | team      | branch     | premium | ✓        | ✗       | ✗      | audit      | org|
| QuotationVersion | CALCULATE  | ✓           | ✓         | ✓          | ✗       | ✗        | ✓       | ✗      | ✗          | ✗  |
| QuotationVersion | ACCEPT     | ✓           | ✓         | ✓          | ✗       | ✗        | ✓       | ✗      | ✗          | ✗  |
| PaymentRecord    | CREATE     | ✓           | ✓         | ✓          | ✓       | ✗        | ✓       | ✗      | ✗          | ✗  |
| PaymentRecord    | RECONCILE  | ✗           | ✗         | ✗          | ✓       | ✗        | ✗       | ✗      | ✗          | ✗  |
| Inspection       | CREATE     | System      | System    | System     | ✗       | ✗        | ✗       | ✗      | ✗          | ✗  |
| Inspection       | SUBMIT     | Inspector   |           |            | ✗       | ✗        | ✗       | ✗      | ✗          | ✗  |
| Inspection       | APPROVE    | ✗           | ✗         | ✗          | ✗       | ✓        | ✗       | ✗      | ✗          | ✗  |
| Document         | UPLOAD     | ✓           | ✓         | ✓          | ✗       | ✓        | ✗       | ✓      | ✗          | ✗  |
| Document         | VERIFY     | ✗           | ✗         | ✗          | ✗       | ✓        | ✗       | ✗      | ✗          | ✗  |
| Policy           | ISSUE      | System only | System    | System     | ✗       | ✓(gate)  | ✗       | ✗      | ✗          | ✗  |
| Policy           | CANCEL     | ✗           | ✗         | ✓          | ✗       | ✗        | ✗       | ✗      | ✗          | ✓  |
| RenewalTask      | UPDATE     | ✗           | ✗         | ✗          | ✗       | ✗        | ✓(own)  | ✗      | ✗          | ✗  |
| Claim            | APPROVE    | ✗           | ✗         | ✗          | ✗       | ✗        | ✗       | ✓(mgr) | ✗          | ✗  |
| AuditLog         | READ       | ✗           | ✗         | ✗          | ✗       | ✗        | ✗       | ✗      | ✓          | ✓  |

---

## SCOPE RESOLUTION RULES

Every list API must accept an optional `scope` parameter:
  mine | team | branch | org

The server validates:
  1. Actor has permission for the requested scope.
  2. Falls back to the most restrictive allowed scope if unspecified.
  3. Client-supplied `userId`, `agentId`, `branchId` query params are NEVER trusted as authorization.
     They may be used only as filters AFTER scope is resolved from ActorContext.

---

## MULTI-USER ISOLATION RULE

Two users with the same Role in the same Branch but different Teams:
  Agent A1 (Team Alpha) ≠ Agent A2 (Team Alpha, different assignment)

Agent A1 CANNOT:
  - Read Agent A2's leads (unless Sales Manager)
  - Read Agent A2's quotations
  - Submit or modify Agent A2's proposals
  - Access Agent A2's customer's documents

This is enforced by comparing resource.assignedToId / resource.ownerId to actor.id
at query time on every list and detail endpoint.
