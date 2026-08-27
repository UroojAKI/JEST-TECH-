# MOTOR DATA MODEL — JEST POLICY CRM
# Version: 1.0.0 | Status: BINDING | Branch: production-remediation
# Canonical motor insurance data model. No module may define its own parallel model.

---

## VEHICLE CATEGORIES (Canonical)
  TWO_WHEELER
  PRIVATE_CAR
  GOODS_CARRYING_VEHICLE (GCV)
  PASSENGER_CARRYING_VEHICLE (PCV)
  TRACTOR
  AUTO_RICKSHAW (AUTO)
  TAXI
  MISC_AND_SPECIAL

---

## VEHICLE DATA (Required per stage)

Stage 2 — Qualification:
  registrationNumber (blank for new vehicles)
  vehicleCategory
  vehicleSubType
  isNewVehicle (boolean)
  usageType

Stage 3 — Quotation:
  makeModelVariant (text or structured make/model/variant)
  fuelType: PETROL | DIESEL | CNG | ELECTRIC | HYBRID
  engineCapacityCC (numeric)
  seatingCapacity (PCV/TAXI)
  grossVehicleWeight (GCV, in kg)
  manufactureYearMonth
  dateOfRegistration
  engineNumber
  chassisNumber
  rtoLocation
  hypothecationFinancer (if financed)
  idv (Insured Declared Value, numeric INR)

---

## POLICY TYPES
  COMPREHENSIVE   (OD + TP + Addons)
  THIRD_PARTY     (TP only)
  SAOD            (Standalone OD — for vehicles with valid TP)

---

## PREVIOUS POLICY DATA (Required for existing vehicles)
  previousPolicyType: COMPREHENSIVE | TP | SAOD | NOT_AVAILABLE
  previousInsurerName
  previousPolicyNumber
  previousPolicyExpiryDate
  claimInPreviousPolicy (boolean)
  eligibleNcbPercentage: 0 | 20 | 25 | 35 | 45 | 50
  isBreakInCase (boolean — derived: expiryDate < today)

---

## NCB RULES
  claimInPreviousPolicy = true   → NCB = 0% (reset)
  claimInPreviousPolicy = false  → NCB = as declared
  BreakIn case                   → NCB = 0% (unless special insurer rule)
  New vehicle                    → NCB = 0%

---

## ADDONS (All must return premium; silent zero not permitted)
  ZERO_DEP         (Zero Depreciation)
  ENGINE_PROTECT   (Engine Protection)
  RSA              (Roadside Assistance)
  RTI              (Return to Invoice)
  KEY_REPLACEMENT
  CONSUMABLES
  TYRE_SECURE
  NCB_PROTECT      (NCB Protection)
  PERSONAL_ACCIDENT_COVER (mandatory for owner-driver)
  PAID_DRIVER_COVER

Addon eligibility:
  ZERO_DEP:       vehicle age <= 5 years
  ENGINE_PROTECT: vehicle age <= 7 years; flood/inundation zone
  RTI:            vehicle age <= 3 years
  All others:     check insurer tariff for eligibility rules

---

## QUOTATION SNAPSHOT (Immutable per version)
  version fields:
    idv
    odPremium
    odAfterNcb
    ncbPercentage
    ncbAmount
    tpPremium
    addonBreakdown: [{ code, name, premium, eligible, ineligibilityReason }]
    totalAddonPremium
    grossPremium (odAfterNcb + tpPremium + totalAddonPremium)
    gst (grossPremium × 18%)
    totalPayable (grossPremium + gst)
    insurerCode
    insurerProductCode
    calculationRulesetVersion
    calculatedAt

---

## INSURER POLICY DETAIL (Captured AFTER insurer issues the policy)
  insurerName
  insurerPolicyNumber  (mandatory; must be unique)
  actualOdPremium
  actualTpPremium
  actualTotalPremium
  actualGst
  premiumVariance (= actualTotalPremium - quotedTotalPayable)
  odStartDate
  odEndDate
  tpStartDate
  tpEndDate
  policyStartDate
  policyEndDate
  actualIdv
  policyDocumentStorageKey  (MinIO / local filesystem key)
  policyDocumentHash        (SHA-256 of document)
  policyDocumentVerified    (boolean; must be true before ACTIVE)
  issuedAt
  issuedByUserId

Renewal date derivation:
  renewalDueDate = MIN(odEndDate, tpEndDate)
  This is the authoritative field for all renewal scheduling.
  NEVER use quotation.validTill or any other derived field.

---

## INSPECTION TRIGGER RULES

inspectionRequired = true when ANY of:
  isBreakInCase = true (policy expired before renewal)
  vehicleAge > 5 years (for COMPREHENSIVE)
  claimInPreviousPolicy = true AND vehicleAge > 3 years
  Vehicle category = GCV with value > INR 10,00,000
  RTO zone flagged as high-risk
  Insurer-specific override rule

inspectionRequired = false when:
  isNewVehicle = true
  Policy type = THIRD_PARTY (no OD component)
  Fresh registration within 90 days

The backend rule engine is the SOLE authority for inspectionRequired.
Frontend must never hardcode this logic.
