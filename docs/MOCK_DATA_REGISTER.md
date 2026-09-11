# MOCK DATA REGISTER & PURGE AUDIT — JEST POLICY CRM

**Version:** 4.0  
**Baseline Git HEAD:** `ef337f39e286dbb11452ee0273d2ca3845903321`  
**Status:** Audit & Purge Tracking

---

## 1. Purged Fallback Constants & Dummy Data

| Location | Prior Violation | Remediation Applied |
|---|---|---|
| `apps/web/src/app/crm/contacts/page.tsx` | Static `BRANCH_OPTIONS = [...]` with `bom-bkc` | Replaced with dynamic `useQuery` fetching `adminRepository.getBranches()`. |
| `apps/web/src/app/crm/contacts/page.tsx` | Fallback `'Mumbai BKC Flagship Branch'` in table cell | Replaced with true branch name or `'—'` unassigned indicator. |
| `apps/web/src/components/workspaces/DynamicWorkspace.tsx` | Dummy KPI fallbacks | Structured backend `/dashboard` API KPI integration with error & loading states. |
| `apps/web/src/components/layout/app-sidebar.tsx` | Missing operations & renewals nav; replacement wiping foundational CRM nav | Permanent navigation registry preserved and merged with dynamicNav. |

---

## 2. Prohibited Patterns (Rule 0.1)

- No hardcoded customer names, emails, or phone numbers (`9876543210`, `rahul.sharma`).
- No fake success toasts without backend API round-trip.
- No dummy `setTimeout(..., 1000)` simulating backend actions.
- No `Math.random()` generating mock metrics or identifiers.
- All identifiers must originate from `NumberingEngineService` or database sequences.
