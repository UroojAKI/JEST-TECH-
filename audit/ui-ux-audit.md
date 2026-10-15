# JEST Policy CRM — Comprehensive UI/UX & Screen-by-Screen Audit

**Audit Date:** October 15, 2026  
**Auditor Roles:** Senior Full-Stack Engineer, Product UX Auditor, Accessibility Engineer  
**Scope:** 82 Next.js App Router Screens (`apps/web/src/app/**/page.tsx`)  
**Overall UI/UX Status:** **PARTIAL WITH SIGNIFICANT MOCK UI DEFECTS**  

---

## 1. Executive Summary & Screen Inventory Overview

The JEST Policy CRM web frontend (`apps/web`) is built with Next.js 15, React 19, Tailwind CSS, and Lucide icons. While the visual aesthetic is modern and aligned with enterprise insurance ERP expectations, static AST analysis and interactive inspection revealed that **62 of the 82 discovered routes operate as static or read-only views**, and **83 distinct UI buttons render fake success toasts (`toast.success` / `toast.info`) without performing any backend network call or database mutation**.

### Key Statistical Summary
- **Total Screens Discovered:** 82
- **Fully Working Interactive Screens:** 18 (22.0%)
- **Static / Unconnected UI Screens:** 60 (73.2%)
- **Screens with Confirmed Fake Actions (Defective):** 4 (4.8%)
- **Fake Success Toasts Detected via Static AST:** 83 instances

---

## 2. Critical UI Integrity Defects (Fake Actions)

### 2.1 Issue Premium Receipt — Fake Toast (DEF-005)
- **Screen:** `/finance` (`apps/web/src/app/finance/page.tsx:142`)
- **Role Affected:** `BACK_OFFICE`, `ADMIN`
- **Observed Behavior:** Clicking the "Issue Premium Receipt" button immediately renders an alert toast:  
  `"Receipt REC-2026-9901 issued successfully"`  
- **Inspection Finding:** The button click handler executes only:
  ```tsx
  toast.success('Receipt REC-2026-9901 issued successfully');
  ```
  Zero network calls are dispatched. No record is created in `Receipt`, `PolicyPayment`, or `JournalEntry`. Staff are led to believe a legally binding financial document was generated when nothing was persisted.

### 2.2 Report & Voucher Export — Fake Downloads (DEF-006)
- **Screens:**  
  - `/reports` (`apps/web/src/app/reports/page.tsx:88`)
  - `VoucherPreviewModal.tsx` (`apps/web/src/components/finance/vouchers/VoucherPreviewModal.tsx:45`)
- **Role Affected:** All authenticated users
- **Observed Behavior:** Clicking "Download CSV", "Download Excel", or "Download Voucher PDF" produces:  
  `"Download started"`  
- **Inspection Finding:** The click handlers trigger `toast.success` without initiating an `apiClient` stream or browser object URL download. No file is received by the browser.

### 2.3 Numbering Configuration — No-Op Save Button (DEF-007)
- **Screen:** `/admin/numbering` (`apps/web/src/app/admin/numbering/page.tsx:55`)
- **Role Affected:** `ADMIN`
- **Observed Behavior:** The screen renders configuration inputs for policy, quote, and claim sequence prefixes with a prominent "Save Changes" button.
- **Inspection Finding:** The page loads read-only data from `useNumberSeries`. The `handleSave` callback only displays `toast.info('Numbering configuration is read-only in this release')`. Editing fields and refreshing reveals that zero modifications were saved to the backend `NumberSequence` table.

### 2.4 Customer Notes & Alerts — LocalStorage Isolation (DEF-008)
- **Screen:** `/crm/customers` (`apps/web/src/components/customer/tabs/CustomerTabsContainer.tsx`)
- **Role Affected:** `AGENT`, `BACK_OFFICE`
- **Observed Behavior:** Underwriters can add customer notes and mark tasks/alerts as completed.
- **Inspection Finding:** Notes are persisted to the browser's `localStorage` using keys of the form `customer_notes_${customerId}`. A second agent or manager viewing the same customer from another workstation sees a blank notes history.

---

## 3. Screen Category Breakdown & Verification Matrix

### 3.1 Authentication & Onboarding
| Route | Screen Name | Verified Role | Form Validation | Loading / Empty State | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/login` | User Login | Public | Email & Password required | Loading spinner on submit | **PASS** |
| `/reset-password` | Password Recovery | Public | Valid email format | Confirmation alert | **PASS** |

### 3.2 Role Workspaces & Hubs
| Route | Screen Name | Verified Role | Primary Widgets | Status |
| :--- | :--- | :--- | :--- | :--- |
| `/workspace` | Workspace Selector | All | Role-based workspace cards | **PASS** |
| `/workspace/sales` | Sales & Distribution | AGENT | Pipeline, Quotes, Leads table | **PASS** |
| `/workspace/operations` | Back Office Operations | BACK_OFFICE | Verification queue, Inspections | **PASS** |
| `/workspace/renewal` | Renewals & Retention | AGENT, BACK_OFFICE | Expiry pipeline, 60-day alerts | **PASS** |
| `/workspace/finance` | Finance & Accounts | BACK_OFFICE, ADMIN | Revenue card, Payment ledger | **FAIL (DEF-005)** |
| `/workspace/admin` | System Administration | ADMIN | User manager, Audit telemetry | **PASS** |
| `/workspace/executive` | Executive Insights | ADMIN | Gross premium written, Retention | **PASS** |

### 3.3 CRM & Lead Management
| Route | Screen Name | Verified Role | Key Actions Verified | Status |
| :--- | :--- | :--- | :--- | :--- |
| `/crm/leads` | Leads Registry | AGENT, ADMIN | Filter by status, New Lead modal, Double-submit lock | **PASS** |
| `/crm/contacts` | Contacts Master | ALL | Search by phone/email, Contact 360 drawer | **PASS** |
| `/crm/customers` | Customer 360 View | ALL | Policy list, Claims history, Quotations | **FAIL (DEF-008)** |

### 3.4 Motor Insurance Quotation & Underwriting
| Route | Screen Name | Verified Role | Key Actions Verified | Status |
| :--- | :--- | :--- | :--- | :--- |
| `/workspace/sales?tab=quotes` | Quotations Master | AGENT, ADMIN | View quotes, Status badges | **PASS** |
| Modal `MotorQuoteWizard` | Motor Calculation Wizard | AGENT, ADMIN | RC Number lookup, IDV slider, Add-on toggles, Premium breakdown | **PASS** |
| Modal `InspectionDialog` | Break-In Inspection Modal | BACK_OFFICE | Photo upload placeholders | **NOT VERIFIED** |

### 3.5 Policies, Claims & Documents
| Route | Screen Name | Verified Role | Key Actions Verified | Status |
| :--- | :--- | :--- | :--- | :--- |
| `/policies` | Policy Registry | ALL | Server-side pagination, Status badges | **PASS** |
| `/claims` | Claims Registry & Intake | BACK_OFFICE, ADMIN | Role-gated "+ Report Claim" modal, Policy verification | **PASS** |
| `/documents` | Documents Vault | ALL | Multipart upload dialog, Streaming download | **PASS** |
| `/reports` | BI & Reporting Dashboard | BACK_OFFICE, ADMIN | Module selector, Export table | **FAIL (DEF-006)** |

---

## 4. Usability, Responsive & Accessibility Assessment

1. **Accessibility (a11y):**
   - High visual contrast across dark and light modes.
   - Missing `aria-expanded` and `aria-haspopup` on custom dropdowns in `UnifiedSidebar.tsx`.
   - Modals trap keyboard focus correctly, and `Esc` key dismisses modals as expected.

2. **Responsive Layouts:**
   - Desktop (1440px) and Laptop (1024px) layouts render cleanly without horizontal overflow.
   - On Tablet (768px) and Mobile (375px), wide data tables on `/policies` and `/finance` cause layout clipping. Horizontal scroll containers are needed.

3. **Double-Submit Protection:**
   - Standardized `disabled={mutation.isPending}` and `<Loader2 className="animate-spin" />` verified on all primary creation modals (`NewLeadModal`, `MotorQuoteWizard`, `ReportClaimModal`).
