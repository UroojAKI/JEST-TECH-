# UI TRUTH RULES — JEST POLICY CRM
# Version: 1.0.0 | Status: BINDING | Branch: production-remediation
# Every UI screen must follow these rules. No exceptions for "demos" or "mockups."

---

## RULE 1: NO PRODUCTION SCREEN MAY USE HARDCODED BUSINESS DATA

Prohibited:
  const policies = [{ id: 'POL-001', customer: 'Sunita Mehta', ... }]
  const leads = mockLeads
  const stats = { pending: 14, active: 230 } // hardcoded

Required:
  const { data: policies } = useSWR('/api/v1/policies', fetcher)
  — or equivalent real API call

Exceptions (LEGITIMATE_STATIC_UI only):
  - Navigation labels and menu items (not data)
  - Error messages and empty state copy
  - Configuration UI defaults (not fetched entities)
  - Static help text and tooltips

---

## RULE 2: EVERY KPI MUST BE CLICKABLE AND NAVIGATE TO FILTERED DATA

Prohibited:
  <KpiCard value={14} label="Pending Issuance" />

Required:
  <KpiCard
    value={14}
    label="Pending Issuance"
    href="/workspace/operations?status=PENDING_ISSUANCE"
  />

Examples:
  "Renewals Due: 27"         → /renewals?bucket=0-30
  "Uncontacted Leads: 11"    → /crm/leads?filter=uncontacted
  "Pending Issuance: 14"     → /workspace/operations?status=PENDING_ISSUANCE
  "Claims Under Review: 5"   → /claims?status=UNDER_REVIEW

---

## RULE 3: EVERY STATUS SHOWN MUST BE THE ACTUAL DATABASE STATUS

Prohibited:
  const displayStatus = 'Active' // hardcoded regardless of policy state

Required:
  <StatusBadge status={policy.status} />
  — where policy.status comes from the API response

---

## RULE 4: LOADING, EMPTY, AND ERROR STATES ARE MANDATORY

Every data-driven component must handle:
  Loading:  Skeleton UI or spinner
  Empty:    Descriptive empty state with next action
  Error:    User-visible error message + retry
  No data:  "No records found" (not blank component)

---

## RULE 5: AUTHORIZATION STATE MUST BE REFLECTED

If a user lacks permission to perform an action:
  - Button is hidden (preferred) OR disabled with tooltip
  - Never: button visible but returns 403 on click

If a section is not accessible to this role:
  - Section does not appear in navigation
  - Direct URL access → /unauthorized

---

## RULE 6: FORM DATA FROM BACKEND; NOT RE-ENTERED

If a Lead contains customer data, Motor quotation form must prefill from lead.
If a QuotationVersion contains pricing, Proposal must show the same pricing.
No form may ask the user to re-enter data the system already has.

---

## RULE 7: INSPECTION, DOCUMENT, AND PAYMENT STATUS COME FROM BACKEND

Prohibited:
  if (policyType === 'COMPREHENSIVE') { showInspection(); }

Required:
  if (quotation.inspectionStatus !== 'NOT_REQUIRED') { showInspection(); }

The backend determines business requirements. The frontend renders them.

---

## RULE 8: FRONTEND TRUTH AUDIT CLASSIFICATION

When a code search finds: mock | dummy | sample | fake | hardcoded | placeholder | static | demo | TODO | coming soon

Classify as one of:
  LEGITIMATE_STATIC_UI   → Acceptable (nav labels, help text, empty state)
  DEV_FIXTURE            → Acceptable in dev seed only; must be seeded data, not inline
  REAL_DATA_BUG          → Must be replaced with real API call before release

All REAL_DATA_BUG items must be resolved before R10 gate.
