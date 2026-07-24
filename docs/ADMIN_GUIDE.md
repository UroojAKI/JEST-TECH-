# JEST Enterprise CRM & Brokerage Platform — Administrator Manual

## Overview
This document serves as the authoritative System Administrator Guide for managing user access, role permissions, organizational hierarchies, number series, feature flags, audit trail logs, and system configuration.

## System Access & Default Credentials
- **Super Admin**: `superadmin@jest.com` / `Password@123`
- **System Admin**: `admin@jest.com` / `Password@123`
- **Sales Agent**: `agent@jest.com` / `Password@123`
- **Underwriter**: `underwriter@jest.com` / `Password@123`
- **Finance Officer**: `finance@jest.com` / `Password@123`

## Administration Core Modules
1. **User Account Provisioning (`/admin/users`)**: Create and edit employee accounts, assign roles, lock/unlock accounts, reset MFA, and scope branch assignments.
2. **Interactive Role & Permission Matrix (`/admin/roles`)**: Manage granular action-based permissions (`View`, `Create`, `Update`, `Delete`, `Approve`, `Export`) across 9 module domains.
3. **Branch & Organizational Hierarchy (`/admin/branches`)**: Configure regional branches, department mappings, and sales teams (`Branch -> Department -> Team`).
4. **Dynamic Lookup Masters Engine (`/admin/lookups`)**: Configure master lists for policy types, vehicle models, ex-showroom prices, partner insurers, and claim loss reasons.
5. **Sequential Numbering Rules (`/admin/numbering`)**: Configure prefix rules for policies (`POL-{YYYY}-{SEQ}`), claims (`CLM-{YYYY}-{SEQ}`), receipts (`RCT-{YYYY}-{SEQ}`), and payments (`PAY-{YYYY}-{SEQ}`).
6. **Feature Flags Matrix (`/admin/config`)**: Toggle real-time feature flags, target environments (`PRODUCTION`, `STAGING`), and rollout percentages.
7. **Audit Center Explorer (`/admin/audit`)**: Inspect immutable audit logs with before/after JSON diff state previews.
