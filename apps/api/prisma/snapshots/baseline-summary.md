# JEST Policy CRM — Phase 0 Baseline Data Snapshot

**Captured At:** 2026-09-18T06:09:11.830Z
**Branch:** `feature/motor-crm-rearchitecture`
**Database:** PostgreSQL (Production / Development instance)

---

## Entity Counts Summary

| Domain Entity | Baseline Count | Migration Target | Notes |
| :--- | :---: | :--- | :--- |
| **Total Users** | **17** | System Users | All roles included |
| **Agents** | **3** | First-class `Agent` model | Will link to `User` via `userId` with unique `agentCode` |
| **Back Office Users** | **11** | Operational Queue | Tasks will be assigned to these users |
| **Admin Users** | **3** | System Administrators | Unrestricted governance |
| **Contacts** | **21** | `Customer` permanent model | Deduplication shifted to signals, identity to Customer ID |
| **Leads** | **24** | `Lead` opportunity model | Linked to `customerId` & `agentId` with strict state transitions |
| **Vehicles** | **4** | `Vehicle` 8-category domain | Normalized registration numbers (uppercase, trimmed) |
| **Quotations** | **35** | `MotorQuotation` engine | Multiple quotes per vehicle, snapshot of agent code |
| **Policies** | **4** | `Policy` lifecycle | Derived from post-payment completed quotation |
| **Claims** | **0** | Enforceable Claim FSM | Full state transition audit logging |
| **Renewals** | **3** | `RenewalSchedule` & Tasks | Policy → Renewal Schedule → Task → Quote |
| **Inspections** | **3** | `Inspection` domain | 7-photo evidence, break-in/SAOD triggers |
| **Workflow Assignments** | **1** | `BackOfficeTask` | Queue-oriented operational tasks |

---

## Agent Registry at Snapshot

- **Rajesh Sharma** (agent@jest.com): Employee Code `EMP-1786251264`, Branch: Global Guru Chickodi
- **Rahul Dravid** (rahul.test1789556684561@jest.com): Employee Code `EMP-684636`, Branch: Unassigned
- **Agent Chickodi** (Test@gmail.com): Employee Code `EMP-965629`, Branch: Global Guru Chickodi

---

## Next Steps

1. Review and approve the detailed 20-Epic Implementation Plan.
2. Proceed to **EPIC 01 — Domain/Data Rearchitecture** (Prisma Schema expansion for `Agent`, `Customer`, `Vehicle`, `MotorQuotation`, etc.).
