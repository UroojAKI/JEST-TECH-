# 01 — ROLE & SCOPE MATRIX
# JEST POLICY CRM — Engineering Contract
# Version: 2.0.0 | Status: BINDING | Last updated: 2026-08-27
# Every PR that touches authorization must reference this document.

---

## 1. CANONICAL ROLE LIST (16 roles — no additions without security review)

| Code                | Display Name          | Dept         |
|:--------------------|:----------------------|:-------------|
| SUPER_ADMIN         | System Administrator  | IT           |
| COMPLIANCE_OFFICER  | Compliance Officer    | Compliance   |
| MD                  | Managing Director     | Management   |
| BRANCH_MANAGER      | Branch Manager        | Management   |
| SALES_MANAGER       | Sales Manager         | Sales        |
| SALES_AGENT         | Sales Agent           | Sales        |
| POSP_AGENT          | POSP Agent            | Sales        |
| FINANCE_MANAGER     | Finance Manager       | Finance      |
| FINANCE_EXECUTIVE   | Finance Executive     | Finance      |
| OPERATIONS_MANAGER  | Operations Manager    | Back Office  |
| ISSUANCE_EXECUTIVE  | Issuance Executive    | Back Office  |
| INSPECTOR           | Vehicle Inspector     | Operations   |
| RENEWAL_MANAGER     | Renewal Manager       | Renewals     |
| RENEWAL_EXECUTIVE   | Renewal Executive     | Renewals     |
| CLAIMS_MANAGER      | Claims Manager        | Claims       |
| CLAIMS_EXECUTIVE    | Claims Executive      | Claims       |

NOTE: INSPECTOR is a separate, explicit role (see §3 below).

---

## 2. WORKSPACE ACCESS MATRIX

| Workspace    | SUPER | MD | BRANCH_MGR | SALES_MGR | SALES_AGENT | POSP | FIN_MGR | FIN_EXEC | OPS_MGR | ISS_EXEC | INSPECTOR | REN_MGR | REN_EXEC | CLM_MGR | CLM_EXEC | COMPLIANCE |
|:------------|:-----:|:--:|:----------:|:---------:|:-----------:|:----:|:-------:|:--------:|:-------:|:--------:|:---------:|:-------:|:--------:|:-------:|:--------:|:----------:|
| Admin        |  ✓    |    |            |           |             |      |         |          |         |          |           |         |          |         |          |            |
| Management   |  ✓    | ✓  |   ✓        |           |             |      |         |          |         |          |           |         |          |         |          |            |
| Sales        |  ✓    |    |   ✓        |   ✓       |   ✓         | ✓    |         |          |         |          |           |         |          |         |          |            |
| Finance      |  ✓    |    |   ✓        |           |             |      |   ✓     |   ✓      |         |          |           |         |          |         |          |            |
| Operations   |  ✓    |    |   ✓        |           |             |      |         |          |  ✓      |   ✓      |           |         |          |         |          |            |
| Inspection   |  ✓    |    |            |           |             |      |         |          |  ✓      |          |    ✓      |         |          |         |          |            |
| Renewals     |  ✓    |    |   ✓        |           |             |      |         |          |         |          |           |  ✓      |   ✓      |         |          |            |
| Claims       |  ✓    |    |   ✓        |           |             |      |         |          |         |          |           |         |          |  ✓      |   ✓      |            |
| Compliance   |  ✓    |    |            |           |             |      |         |          |         |          |           |         |          |         |          |     ✓      |

---

## 3. INSPECTOR ROLE — EXPLICIT DEFINITION

The INSPECTOR role was identified as missing from the previous contract. This is now fixed.

An inspector may be:
  (a) An internal employee with INSPECTOR role, OR
  (b) An external surveyor tracked by email/phone (no system login required for basic submission)

For internal inspectors:
  READ:   Own assigned inspection records only
  WRITE:  Acknowledge assignment, upload photos, submit inspection
  CANNOT: Approve/reject inspection (Back Office only), modify quotation, approve payment, issue policy

For external inspectors (future phase):
  Temporary upload link (signed URL, time-limited)
  No system login required
  Cannot read any other record

Inspection approval always remains with ISSUANCE_EXECUTIVE or OPERATIONS_MANAGER.

---

## 4. SCOPE DIMENSIONS (Four-dimensional authorization)

Every access decision uses ALL four dimensions simultaneously:

  WHO     = actor.userId + actor.role
  WHERE   = actor.organizationId + actor.branchId + actor.teamId
  WHAT    = resource entity type + resource.id
  HOW     = action (READ / WRITE / ASSIGN / TRANSITION / APPROVE / ISSUE)

The backend derives scope from ActorContext. Client-supplied params are filters, never authority:
  ?agentId=  → filter only (after scope resolved)
  ?branchId= → filter only (after scope resolved)
  ?teamId=   → filter only (after scope resolved)

---

## 5. SCOPE LEVELS (per role)

| Role               | Default Scope | Can Elevate To |
|:-------------------|:-------------|:---------------|
| SALES_AGENT        | mine         | —              |
| POSP_AGENT         | mine         | —              |
| INSPECTOR          | mine         | —              |
| RENEWAL_EXECUTIVE  | mine         | —              |
| CLAIMS_EXECUTIVE   | mine         | —              |
| ISSUANCE_EXECUTIVE | mine+unassigned | —           |
| FINANCE_EXECUTIVE  | team         | —              |
| SALES_MANAGER      | team         | —              |
| RENEWAL_MANAGER    | team         | branch (if permitted) |
| CLAIMS_MANAGER     | branch       | —              |
| OPERATIONS_MANAGER | branch       | —              |
| FINANCE_MANAGER    | branch       | org (if permitted) |
| BRANCH_MANAGER     | branch       | —              |
| MD                 | org          | —              |
| COMPLIANCE_OFFICER | org (read-only audit) | — |
| SUPER_ADMIN        | org          | —              |

---

## 6. RESOURCE ACTION PERMISSION TABLE

| Resource         | Action     | SALES_AGENT | SALES_MGR | FIN_EXEC | FIN_MGR | ISS_EXEC | OPS_MGR | INSPECTOR | REN_EXEC | CLM_EXEC | MD  |
|:-----------------|:-----------|:-----------:|:---------:|:--------:|:-------:|:--------:|:-------:|:---------:|:--------:|:--------:|:---:|
| Lead             | READ       | own         | team      | ✗        | ✗       | ✗        | ✗       | ✗         | ✗        | ✗        | org |
| Lead             | CREATE     | ✓           | ✓         | ✗        | ✗       | ✗        | ✗       | ✗         | ✗        | ✗        | ✗   |
| Lead             | ASSIGN     | ✗           | team      | ✗        | ✗       | ✗        | ✗       | ✗         | ✗        | ✗        | org |
| QuotationVersion | CALCULATE  | ✓           | ✓         | ✗        | ✗       | ✗        | ✗       | ✗         | ✓        | ✗        | ✗   |
| QuotationVersion | ACCEPT     | ✓           | ✓         | ✗        | ✗       | ✗        | ✗       | ✗         | ✓        | ✗        | ✗   |
| PaymentRecord    | CREATE     | ✓           | ✓         | ✓        | ✓       | ✗        | ✗       | ✗         | ✓        | ✗        | ✗   |
| PaymentRecord    | RECONCILE  | ✗           | ✗         | ✓        | ✓       | ✗        | ✗       | ✗         | ✗        | ✗        | ✗   |
| Inspection       | ACKNOWLEDGE| ✗           | ✗         | ✗        | ✗       | ✗        | ✗       | ✓         | ✗        | ✗        | ✗   |
| Inspection       | SUBMIT     | ✗           | ✗         | ✗        | ✗       | ✗        | ✗       | ✓         | ✗        | ✗        | ✗   |
| Inspection       | APPROVE    | ✗           | ✗         | ✗        | ✗       | ✓        | ✓       | ✗         | ✗        | ✗        | ✗   |
| Document         | UPLOAD     | ✓           | ✓         | ✗        | ✗       | ✓        | ✗       | ✗         | ✗        | ✓        | ✗   |
| Document         | VERIFY     | ✗           | ✗         | ✗        | ✗       | ✓        | ✓       | ✗         | ✗        | ✗        | ✗   |
| Policy           | ISSUE      | System gate | System    | ✗        | ✗       | Gate     | Gate    | ✗         | ✗        | ✗        | ✗   |
| Policy           | CANCEL     | ✗           | ✗         | ✗        | ✗       | ✗        | ✗       | ✗         | ✗        | ✗        | ✓   |
| RenewalTask      | UPDATE     | ✗           | ✗         | ✗        | ✗       | ✗        | ✗       | ✗         | own      | ✗        | ✗   |
| Claim            | CREATE     | ✗           | ✗         | ✗        | ✗       | ✗        | ✗       | ✗         | ✗        | ✓        | ✗   |
| Claim            | APPROVE    | ✗           | ✗         | ✗        | ✗       | ✗        | ✗       | ✗         | ✗        | ✗(mgr)   | ✗   |
| AuditLog         | READ       | ✗           | ✗         | ✗        | ✗       | ✗        | ✗       | ✗         | ✗        | ✗        | ✓   |
