# ARCHITECTURE FREEZE — JEST POLICY CRM
# Version: 1.0.0 | Date: 2026-08-27 | Branch: production-remediation
# This document records what is locked and what is changing.

---

## WHAT IS NOW LOCKED (do not redesign)

### Domain Entities
Defined in DATA_OWNERSHIP_MODEL.md. The following 18 entities are canonical:
Lead, Contact, Customer, Vehicle, QuotationGroup, QuotationVersion, Proposal,
Document, Inspection, PaymentRecord, PaymentReconciliation, Policy,
InsurerPolicyDetail, RenewalTask, Claim, Task, Communication, AuditLog

No new entity may be introduced without updating DATA_OWNERSHIP_MODEL.md.

### State Machines
Defined in STATE_MACHINES.md. All 11 state machines are canonical.
No state or transition may be added or removed without updating STATE_MACHINES.md
and creating a migration for any enum changes.

### Role List
Defined in ROLE_SCOPE_MATRIX.md. 16 canonical roles.
No new role without ROLE_SCOPE_MATRIX.md update + security review.

### Single-Authority Services
The following services are THE ONLY authority for their domain:
  - MotorPricingService       → premium calculation
  - IssuanceEligibilityService → issuance gate
  - PolicyIssuanceService     → policy status transitions
  - PaymentReconciliationService → payment reconciliation
  - ResourceAuthorizationService → access decisions
  - RenewalEngine             → renewal task creation

---

## WHAT IS CHANGING (release-by-release)

### R0 (current — Architecture Freeze)
  - All 10 binding contract documents ✓
  - UAT persona reference ✓
  - Architecture freeze marker (this document) ✓

### R1 (next — Identity & Authorization)
  - Fix login → dashboard routing
  - Workspace switcher (permission-driven)
  - Role-based dashboard landing
  - BOLA permanent test suite
  - R1 exit gate verified

### R2 (Lead → Customer → Vehicle)
  - Lead as context carrier
  - Progressive data capture (5 stages)
  - Completion checklist (0–100%)
  - Motor form prefill from lead
  - Duplicate detection

### R3 (Quotation & Motor Pricing)
  - QuotationGroup + QuotationVersion model
  - Immutable snapshot per version
  - All addons return premium (no silent zero)
  - TP never disappears from package calculation

### R4 (Proposal + Documents + Inspection)
  - Document state machine enforced
  - Inspection auto-trigger (server-side)
  - Inspection 7-photo validation
  - Issuance bypass blocked if inspection required

### R5 (Payment + Finance + Issuance)
  - Payment state machine (RECORDED → RECONCILED)
  - Finance workspace with real queue
  - Underpayment/duplicate blocked
  - Single issuance authority (PolicyIssuanceService)
  - Back Office workbench queue

### R6 (Policy + Renewal)
  - InsurerPolicyDetail with all date fields
  - Policy expiry from insurer data (not quotation)
  - Renewal task creation at policy activation
  - Idempotent distributed scheduler
  - Renewal executive queue with buckets

### R7 (Claims)
  - Eligibility gate (active policy + incident date)
  - Claims state machine enforced
  - Claims executive queue

### R8 (Customer 360 + Dashboards)
  - Customer 360: all tabs from database
  - All KPIs clickable (navigate to filtered data)
  - Dashboard metrics: SQL aggregation (not Node)

### R9 (Reliability + Audit + Infrastructure)
  - Audit log: immutable, append-only
  - Concurrency tests for critical mutations
  - Performance: p95 < 300ms CRUD, < 2s dashboard
  - No production default secrets
  - CI/CD with real gates

### R10 (Production Certification)
  - All 20 production gates verified
  - Golden-path E2E automated test
  - Role UAT with 25 personas
  - Real staging deployment + smoke test
  - Backup/restore drill

---

## FROZEN: WHAT MUST NOT BE DONE

Until R1 gate passes:
  ✗ No new dashboard widgets
  ✗ No new modal or form screens
  ✗ No new API endpoints for unrelated features
  ✗ No mock-data additions to any component
  ✗ No "demo mode" or "quick login" shortcuts
  ✗ No hardcoded operational data

These are frozen on the `production-remediation` branch.
