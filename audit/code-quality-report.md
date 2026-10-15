# JEST Policy CRM — Code Quality, Forensics & Technical Debt Audit

**Audit Date:** October 15, 2026  
**Auditor Roles:** Senior Full-Stack Engineer, Software Quality Architect, Static Analysis Specialist  
**Tools Applied:** AST Parser, Regex Forensic Scanner, TypeScript 5.x Compiler (`tsc --noEmit`)  
**Scope:** 703 production source files across `apps/api` and `apps/web`  
**Overall Code Quality Disposition:** **TYPE-CLEAN AT COMPILE TIME; SIGNIFICANT TECHNICAL DEBT IN MOCK TOASTS & UNCALLED APIS**  

---

## 1. Static AST Scanners & Production Code Cleanliness

### 1.1 Compile-Time Type Safety
- **API (`apps/api`):** `pnpm --filter api exec tsc --noEmit` exited **0** with **0 type errors**.
- **Web (`apps/web`):** `pnpm --filter web exec tsc --noEmit` exited **0** with **0 type errors**.
- Zero broken imports, missing properties, or invalid return types were detected during static compilation.

### 1.2 Prohibited Mock Data Scan
The CI production mock scanner (`node scripts/check-production-mock-data.js`) scanned **703 source files** against prohibited mock patterns (such as `mockPolicies`, `dummyUsers`, `fakeClaims`, synthetic timers, and math-random generators) and reported **0 violations** in active production persistence code paths.

---

## 2. Forensic Static Data & Mock UI Findings

While raw mock arrays are absent from persistence repositories, static analysis across `apps/web/src` revealed **95 distinct hardcoded data and fake action findings** (`docs/audit/baseline/static-data-findings.json`):

### 2.1 Categorized Forensic Findings

| Finding Category | Detected Count | Description & Severity | Example File Location |
| :--- | :--- | :--- | :--- |
| **`FAKE_SUCCESS_TOAST`** | **83** | UI button handler renders `toast.success` without awaiting API call or persisting data (**HIGH**) | `apps/web/src/app/admin/branches/page.tsx:25` |
| **`HARDCODED_INSURER_NAME`** | **4** | Insurer names hardcoded in UI templates rather than loaded from Insurer Master (**MEDIUM**) | `apps/web/src/components/leads/motor-quote/VehicleDetailsForm.tsx` |
| **`HARDCODED_CUSTOMER_NAME`** | **4** | Default customer names embedded in UI placeholder fields (**MEDIUM**) | `apps/web/src/components/customer/customer-alerts-queue.tsx` |
| **`HARDCODED_PHONE_NUMBER`** | **3** | Placeholder phone numbers hardcoded in demo components (**LOW**) | `apps/web/src/app/workspace/agent/page.tsx` |
| **`HARDCODED_DATE`** | **1** | Hardcoded future calendar date literal in date picker default (**LOW**) | `apps/web/src/components/leads/motor-quote/PolicyForms.tsx` |

### 2.2 Forensic Analysis of the 83 Fake Success Toasts
The detection of 83 fake success toasts indicates that numerous frontend administrative and configuration pages were developed as visual prototypes. When users interact with these screens, success feedback is presented to the browser, but zero network requests reach `apps/api`.
- *Representative Examples:*
  - `apps/web/src/app/finance/page.tsx:142`: "Issue Premium Receipt" shows `toast.success('Receipt REC-2026-9901 issued successfully')` (DEF-005).
  - `apps/web/src/app/reports/page.tsx:88`: "Download CSV" triggers `toast.success('Download started')` without initiating download stream (DEF-006).
  - `apps/web/src/app/admin/numbering/page.tsx:55`: Save button triggers `toast.info` with zero persistence (DEF-007).
  - `apps/web/src/app/admin/branches/page.tsx:25`: Branch toggle triggers `toast.success` without calling Branch update API.

---

## 3. API Contract Cross-Reference & Uncalled Routes

Cross-referencing frontend network calls (`apiClient.*`) against backend NestJS controller routes (`@Get`, `@Post`, etc.) via `scripts/verify-api-contracts.ts` produced the following baseline:
- **Total Frontend Network Calls:** 304 unique calls.
- **Frontend Calls Matched to Backend:** **304 of 304 (100% matched)**. Zero 404 or dead endpoints called by the frontend.
- **Total Backend Controller Routes:** 450 routes.
- **Uncalled Backend Routes:** **206 routes (45.7% of API surface)**:
  - *Webhook routes:* 1 (intended for external HTTP callbacks)
  - *Cron / Scheduled routes:* 3 (triggered by system workers)
  - *Internal / System routes:* 8 (health probes, metrics, number sequences)
  - *Unused / Unconnected routes:* **194 routes**

### 3.1 Uncalled Route Risk Analysis
The presence of 194 uncalled backend routes indicates that significant backend functionality (e.g. advanced quotation comparisons, secondary endorsement queries, granular lookups, and specialized analytics) exists in `apps/api` but is not yet exposed or consumed by the `apps/web` user interface. These routes expand the attack surface without providing active business value.

---

## 4. Dead Code & Console Artifacts

Analysis of `docs/audit/baseline/dead-code-findings.json` identified **28 console log occurrences** in production code paths:
- 18 instances in `apps/api/src/main.ts` and background migration runners.
- 10 instances in frontend event listeners.
- *Recommendation:* Replace all `console.log` statements with structured logger invocations (`this.logger.log` / `this.logger.debug`) to ensure log aggregation tools (e.g. Datadog, ELK) capture execution context cleanly.
