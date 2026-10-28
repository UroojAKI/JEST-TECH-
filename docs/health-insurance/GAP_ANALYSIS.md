# Health Insurance – Gap Analysis

Legend: Exists = already in code | Partial = exists but needs change | Missing = must be built

## Section 0 – Common Proposer / Insured Member / Nominee (20 fields)

| # | Field (from PDF) | Mandatory | Status | Where in code | Notes |
|---|---|---|---|---|---|
| 1 | Proposal / Enquiry Date | Y | Exists | createdAt on Lead / case | Auto-populated |
| 2 | Lead / Enquiry Source | Y | Exists | Lead.source (enum LeadSource) | All 6 PDF values present (WALK_IN, REFERRAL, ADVISOR, DIGITAL, RENEWAL, CROSS_SELL) |
| 3 | Proposer Name | Y | Exists | Contact.firstName / middleName / lastName | |
| 4 | Insured Member(s) Name | Y | Partial | FamilyMember.firstName/lastName (per Contact) | Reuse to pick existing family; store per-case copy in new HealthInsuredMember |
| 5 | Relationship to Proposer | Conditional | Partial | FamilyMember.relationship | Plain String (SPOUSE/CHILD/PARENT), missing SELF and OTHER; use an enum on HealthInsuredMember |
| 6 | Date of Birth (each member) | Y | Partial | FamilyMember.dateOfBirth | Optional in FamilyMember; mandatory on HealthInsuredMember |
| 7 | Gender (each member) | Y | Partial | Contact.gender (enum Gender: MALE/FEMALE/OTHER) | Enum matches PDF exactly; reuse it on the member table |
| 8 | Mobile Number | Y | Exists | Contact.phone | Validated in create-contact.dto.ts with /^[6-9]\d{9}$/ (10-digit Indian mobile). OTP not checked yet |
| 9 | Email ID | Y | Partial | Contact.email | Optional (email?) in create-contact.dto.ts; Health DTO must make it required |
| 10 | Address | Y | Partial | Customer.addressLine1/2, city, state, pincode | Contact has NO address fields; store in case snapshot or read from Customer |
| 11 | PAN Number | Y | Partial | Contact.panNumber | Stored as plain text; contact.mapper.ts only masks it on read (EncryptionUtil.maskPan). DTO only checks length 10 and is optional; Health requires it with format /^[A-Z]{5}[0-9]{4}[A-Z]$/ |
| 12 | Aadhaar Number | Y | Partial | Contact.aadhaarNumber | Stored as plain text; only masked on read (EncryptionUtil.maskAadhaar). DTO only checks length 12 and is optional; Health requires it with /^\d{12}$/ |
| 13 | Occupation | Y | Partial | Contact.occupation | Free text String, PDF wants dropdown: Salaried/Self-employed/Business/Professional/Homemaker/Student/Retired |
| 14 | Annual Income | N | Missing | - | Decimal |
| 15 | Height & Weight (each member) | Y | Missing | - | Add heightCm, weightKg; BMI calculated |
| 16 | Pre-Existing Disease Declaration | Y | Missing | - | Text per member |
| 17 | Smoker / Tobacco / Alcohol | Y | Missing | - | Boolean per member |
| 18 | Nominee Name | Y | Partial | PolicyNominee.firstName/lastName | Policy-level only; store on case snapshot, copy to PolicyNominee on issue |
| 19 | Nominee Relationship | Y | Partial | PolicyNominee.relation | Plain String; use enum SPOUSE/CHILD/PARENT/SIBLING/OTHER (PDF options) |
| 20 | Relationship Manager | Y | Exists | Lead.assignedToId | Auto-map to logged-in user when creating the case |

### Proposed design
- New HealthQuotationCase table (copy of MotorQuotationCase), linked to Contact (not Customer)
- New HealthInsuredMember table (linked to the case, optional familyMemberId link to FamilyMember): name, relation (enum SELF/SPOUSE/CHILD/PARENT/OTHER), DOB, gender (Gender enum), heightCm, weightKg, pedDeclaration, isSmoker
- Nominee, occupation, income and address stored on the case (snapshot)
- When the policy is issued, copy members into PolicyMember and the nominee into PolicyNominee
- Add relation healthQuotationCases HealthQuotationCase[] to Lead and Contact (same as motorQuotationCases)

### Issues found outside Health scope (report to team lead)
- PAN / Aadhaar are stored as plain text on both Customer (customers.service.ts lines 162-163) and Contact (contacts.service.ts). DDD section 4 requires column-level encryption; EncryptionUtil.encrypt exists but is unused - mappers only mask on read. Health writes KYC to Contact the same way and never returns it unmasked.
- "Log Call" on the lead page fails with 400: LogCallDto (apps/api/src/modules/workspace/dto/workspace.dto.ts) has no class-validator decorators and main.ts uses forbidNonWhitelisted: true.
- New Lead form offers sources (Website, Facebook Ads, Google Ads, WhatsApp, Existing Customer, Dealer) that are not in the LeadSource enum.
- Lead has no productInterest field; "HEALTH" is only stored inside the lead title / description text.
- Schema drift on main: `prisma migrate diff` shows differences unrelated to Health (rbac_migration_backup_* tables, motor_journeys columns, MotorWorkflowState enum, several FKs). `prisma migrate dev` would require a database reset. The Health migration was written additive-only to avoid this.

### Open questions for team lead
- Lead has no line-of-business field (Motor/Health). Is it needed to filter leads by product before a quotation case is created?
- Contact has no address fields. Health stores the address on the case snapshot - or should address fields be added to Contact?
- Commission formula "Sum of 8+9 x D% - 10": implemented as Commission = (Base + Rider) x D% and Net payable = Total - Commission. Rider commission = Rider premium x rider D%. Please confirm with an example.
- Conditional documents ("if applicable", "for renewal", "port-in", "if any") are optional in the checklist. Confirm.
- Back-office verify / reject of Health documents was added (from the Job Roles SOP and the Motor pattern); it is not explicit in the Health PDF. Keep or remove?
- OTP verification of the mobile number (common field 8) is not implemented anywhere in the platform. Platform-wide feature?
- Policy Form (iii) "Riders & Add-on Covers" is captured per quote (riders on a New Policy quote). Is a standalone "add riders to an existing policy" flow also needed?

## Implementation status (feature/health-insurance-crm)

| PDF area | Status | Where |
|---|---|---|
| Common fields 1-20 | Done (OTP excluded) | HealthQuotationCase, HealthInsuredMember, Contact KYC |
| Section A - 8 categories | Done, validated per category | dto/health-plan-details.dto.ts, services/health-plan-validation.service.ts |
| Form (i) New Policy | Done | POST /health/quotation-cases/:id/quotes |
| Form (ii) Renewal / Portability | Done, validated | previousPolicySnapshot (RenewalPortabilityDetailsDto) |
| Form (iii) Riders | Done: per-rider sum insured & premium, rider GST total, rider commission | services/health-premium.service.ts |
| Multiple quotes per proposal | Done | Quotation.healthCaseId |
| Upload after each quote | Done | /documents/upload + POST /health/quotation-cases/:id/documents |
| Section C document checklist | Done, per category | services/health-document-rule.service.ts |
| Frontend | Done | "Health Insurance" card in + Create Quote; "+ Generate Health Quote" on lead Quotation Engine tab; /sales/health-quotations/new and /sales/health-quotations/[id] |
