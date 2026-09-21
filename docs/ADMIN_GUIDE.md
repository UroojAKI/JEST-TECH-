# JEST Enterprise CRM & Brokerage Platform — Administrator Manual

## Overview
This document serves as the authoritative System Administrator Guide for managing user access, role permissions, organizational hierarchies, number series, feature flags, audit trail logs, and system configuration within the multi-tenant JEST Policy CRM architecture.

## Canonical RBAC Model
The platform operates on a canonical 3-role contract enforced at database and API gateway levels:
1. **ADMIN**: Full tenant administrative oversight, user lifecycle management, audit logs inspection, feature flags, master lookup configuration, and numbering sequences.
2. **BACK_OFFICE**: Operational workflows including policy issuance, underwriting checks, inspection approvals, payment reconciliations, renewal operations, and claims management.
3. **AGENT**: Frontline distribution workflows including lead qualification, multi-insurer quotation generation, proposal submission, and personal book-of-business management.

## System Access & Provisioning
> [!IMPORTANT]
> Initial administrative credentials are never hardcoded in production repositories. Initial tenant administrators are provisioned during tenant onboarding via secure CLI commands (`pnpm --filter api seed:tenant`) or cryptographically secure environment variables (`INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD`).
> All production users must authenticate using salted argon2id hashes with enforced multi-factor authentication (MFA) and minimum entropy policies.

## Administration Core Modules
1. **User Account Provisioning (`/admin/users`)**: Create and edit employee accounts, assign canonical roles (`ADMIN`, `BACK_OFFICE`, `AGENT`), lock/unlock accounts, reset MFA, and scope organizational assignments.
2. **Interactive Role & Permission Matrix (`/admin/roles`)**: Inspect granular action-based permissions across module domains (`SYSTEM`, `USER`, `ROLE`, `CONTACT`, `ACCOUNT`, `LEAD`, `QUOTATION`, `POLICY`, `CLAIM`, `REPORT`, `WORKFLOW`, `DOCUMENT`, `DASHBOARD`).
3. **Branch & Organizational Hierarchy (`/admin/branches`)**: Configure regional branches, department mappings, and operational units.
4. **Dynamic Lookup Masters Engine (`/admin/lookups`)**: Configure master lists for policy types, vehicle models, ex-showroom prices, partner insurers, and claim loss reasons.
5. **Sequential Numbering Rules (`/admin/numbering`)**: Configure atomic sequence numbering for policies (`POL-{SEQ}`), motor quotations (`MQT-{SEQ}`), claims (`CLM-{SEQ}`), receipts (`RCT-{SEQ}`), and payments (`PAY-{SEQ}`).
6. **Feature Flags Matrix (`/admin/config`)**: Toggle real-time feature flags, target environments (`PRODUCTION`, `STAGING`), and rollout percentages.
7. **Audit Center Explorer (`/admin/audit`)**: Inspect immutable audit logs with before/after JSON diff state previews.
