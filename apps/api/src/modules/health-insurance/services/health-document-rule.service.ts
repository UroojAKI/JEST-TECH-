import { Injectable } from '@nestjs/common';
import { HealthDocumentType, HealthPlanCategory, HealthPolicyForm } from '@prisma/client';

export interface HealthDocumentRequirement {
  documentType: HealthDocumentType;
  label: string;
  /** true = mandatory; false = only when the PDF's condition applies */
  required: boolean;
  condition?: string;
}

const doc = (
  documentType: HealthDocumentType,
  label: string,
  required = true,
  condition?: string,
): HealthDocumentRequirement => ({ documentType, label, required, ...(condition ? { condition } : {}) });

/** Category-specific additions to the common checklist (Section C of each category). */
const CATEGORY_DOCUMENTS: Record<HealthPlanCategory, HealthDocumentRequirement[]> = {
  INDIVIDUAL: [],
  FAMILY_FLOATER: [
    doc('RELATIONSHIP_PROOF', 'Proof of Relationship of All Members (Marriage / Birth Certificates)'),
  ],
  SENIOR_CITIZEN: [
    doc('DETAILED_MEDICAL_REPORTS', 'Detailed Medical Reports (ECG, Blood Test, etc.)'),
    doc('ILLNESS_MEDICATION_DECLARATION', 'Existing Illness / Medication Declaration'),
  ],
  CRITICAL_ILLNESS: [],
  TOP_UP: [
    doc('BASE_POLICY_COPY', 'Copy of Base / Existing Health Policy'),
    doc('BASE_POLICY_CLAIMS_HISTORY', 'Claims History of Base Policy', false, 'If any claims on base policy'),
  ],
  GROUP_CORPORATE: [
    doc('MASTER_POLICY_RULES', 'Master Policy / Scheme Rules Document'),
    doc('EMPLOYEE_CENSUS', 'Employee Census / Enrolment Data'),
    doc('HR_AUTHORIZATION', 'HR Authorization Letter'),
  ],
  PERSONAL_ACCIDENT: [
    doc('OCCUPATION_PROOF', 'Occupation Proof'),
    doc('INCOME_PROOF', 'Income Proof', false, 'For high Sum Insured cases'),
  ],
  MISCELLANEOUS: [
    doc('TRAVEL_ITINERARY', 'Travel Itinerary / Visa Copy', false, 'Travel Health cases'),
  ],
};

/**
 * Document checklist per plan category and policy form (Health_Insurance_CRM_Forms, Section C).
 */
@Injectable()
export class HealthDocumentRuleService {
  getRequirements(category: HealthPlanCategory, policyForm: HealthPolicyForm): HealthDocumentRequirement[] {
    const isRenewalOrPort = policyForm === HealthPolicyForm.RENEWAL_PORTABILITY;

    const common: HealthDocumentRequirement[] = [
      doc('PROPOSAL_FORM', 'Proposal Form (signed)'),
      doc('KYC_DOCUMENTS', 'KYC Documents (PAN, Aadhaar / Address Proof, Photograph)'),
      doc('AGE_PROOF', 'Age Proof of all Insured Members'),
      doc('MEDICAL_TEST_REPORTS', 'Pre-Policy Medical Test Reports', false, 'If pre-policy medical check-up is required'),
      doc('PREVIOUS_POLICY', 'Previous Policy Copy', isRenewalOrPort, isRenewalOrPort ? undefined : 'Renewal / portability only'),
      doc('PORTABILITY_FORM', 'Portability Form', false, 'Port-in cases'),
      doc('GOOD_HEALTH_DECLARATION', 'Declaration of Good Health / Pre-Existing Disease Disclosure'),
    ];

    return [...common, ...CATEGORY_DOCUMENTS[category]];
  }
}
