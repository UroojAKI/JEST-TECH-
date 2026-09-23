import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { VehicleCategory, VehicleStatus } from '@prisma/client';

export interface RequiredDocumentRuleItem {
  code: string;
  name: string;
  description: string;
  category: 'KYC' | 'VEHICLE' | 'POLICY' | 'INSPECTION' | 'COMMERCIAL';
  isMandatory: boolean;
}

export interface RequiredDocumentsQuery {
  vehicleCategory: VehicleCategory | string;
  vehicleStatus: VehicleStatus | 'NEW' | 'EXISTING';
  policyType: 'TP' | 'SAOD' | 'PACKAGE' | string;
  inspectionRequired?: boolean;
  isHypothecated?: boolean;
  hasPreviousPolicy?: boolean;
}

export interface RequiredDocumentsResult {
  vehicleCategory: string;
  vehicleStatus: string;
  policyType: string;
  inspectionRequired: boolean;
  requiredDocuments: RequiredDocumentRuleItem[];
  mandatoryCount: number;
}

export interface DocumentCompletionAudit {
  complete: boolean;
  completionPercentage: number;
  mandatoryTotal: number;
  verifiedCount: number;
  missingDocuments: RequiredDocumentRuleItem[];
  verifiedDocuments: string[];
  pendingReviewDocuments: string[];
}

@Injectable()
export class MotorDocumentRuleService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Deterministically computes the exact list of required documents
   * based on IRDAI motor guidelines and category specifications.
   */
  getRequiredDocuments(
    params: RequiredDocumentsQuery,
  ): RequiredDocumentsResult {
    const {
      vehicleCategory,
      vehicleStatus,
      policyType,
      inspectionRequired = false,
      isHypothecated = false,
      hasPreviousPolicy = true,
    } = params;

    const docs: RequiredDocumentRuleItem[] = [];

    // 1. Mandatory KYC for all motor policies
    docs.push({
      code: 'KYC_PAN',
      name: 'PAN Card / Form 60',
      description: 'Customer PAN Card for IRDAI AML compliance',
      category: 'KYC',
      isMandatory: true,
    });
    docs.push({
      code: 'KYC_ADDRESS',
      name: 'Address Proof / Aadhaar',
      description: 'Customer identity and permanent residence proof',
      category: 'KYC',
      isMandatory: true,
    });

    // 2. Vehicle Registration / Invoice Rules
    if (vehicleStatus === 'NEW') {
      docs.push({
        code: 'VEH_INVOICE',
        name: 'Proforma / Sale Invoice',
        description: 'Manufacturer or dealer invoice for new vehicle IDV',
        category: 'VEHICLE',
        isMandatory: true,
      });
      docs.push({
        code: 'VEH_FORM_21',
        name: 'Sale Certificate (Form 21)',
        description: 'RTO Form 21 sale certificate issued by dealer',
        category: 'VEHICLE',
        isMandatory: true,
      });
    } else {
      // Existing Vehicle
      docs.push({
        code: 'VEH_RC_COPY',
        name: 'Registration Certificate (RC Copy)',
        description: 'Front and back of vehicle RC book or smart card',
        category: 'VEHICLE',
        isMandatory: true,
      });

      if (hasPreviousPolicy && policyType !== 'TP') {
        docs.push({
          code: 'PREV_POLICY_COPY',
          name: 'Previous Policy Schedule',
          description:
            'Prior policy schedule confirming NCB entitlement and OD coverage',
          category: 'POLICY',
          isMandatory: true,
        });
      }
    }

    // 3. Commercial Fleet & Passenger Carrying Requirements
    const isCommercial = [
      'GCV',
      'TAXI',
      'BUS_COACH',
      'AUTO',
      'MISC_CLASS_D',
    ].includes(vehicleCategory);

    if (isCommercial) {
      docs.push({
        code: 'COMM_FITNESS_CERT',
        name: 'Fitness Certificate (Form 38)',
        description: 'Valid RTO fitness certification for commercial vehicle',
        category: 'COMMERCIAL',
        isMandatory: true,
      });
      docs.push({
        code: 'COMM_PERMIT',
        name: 'Route / Goods Carriage Permit',
        description: 'Valid commercial transport permit',
        category: 'COMMERCIAL',
        isMandatory: true,
      });
    }

    // 4. Inspection Requirement (Break-in or SAOD without TP sync)
    if (inspectionRequired) {
      docs.push({
        code: 'INSPECTION_REPORT_7_PHOTO',
        name: 'Pre-Inspection Report (7-Photo Evidence)',
        description:
          'IRDAI break-in pre-inspection report with 360 photo proofs and engine/chassis pencil rub',
        category: 'INSPECTION',
        isMandatory: true,
      });
    }

    // 5. Hypothecation Financer
    if (isHypothecated) {
      docs.push({
        code: 'FORM_34_HYPOTHECATION',
        name: 'Form 34 / Loan Sanction Letter',
        description: 'Financier hypothecation endorsement',
        category: 'VEHICLE',
        isMandatory: false,
      });
    }

    const mandatoryCount = docs.filter((d) => d.isMandatory).length;

    return {
      vehicleCategory,
      vehicleStatus,
      policyType,
      inspectionRequired,
      requiredDocuments: docs,
      mandatoryCount,
    };
  }

  /**
   * Computes document completion status for a lead by checking against uploaded & verified documents.
   */
  async checkLeadDocumentCompletion(
    leadId: string,
    actorCompanyId?: string,
  ): Promise<DocumentCompletionAudit> {
    const [lead, uploadedDocs] = await Promise.all([
      this.prisma.lead.findUnique({
        where: { id: leadId },
        include: {
          vehicles: { where: { deletedAt: null } },
          motorQuotations: { where: { deletedAt: null, status: 'ACCEPTED' } },
        },
      }),
      this.prisma.document.findMany({
        where: {
          entityType: 'LEAD',
          entityId: leadId,
          deletedAt: null,
        },
      }),
    ]);

    if (!lead) {
      return {
        complete: false,
        completionPercentage: 0,
        mandatoryTotal: 0,
        verifiedCount: 0,
        missingDocuments: [],
        verifiedDocuments: [],
        pendingReviewDocuments: [],
      };
    }

    if (actorCompanyId && lead.companyId && lead.companyId !== actorCompanyId) {
      throw new ForbiddenException(
        'Cross-organization lead document verification is strictly prohibited',
      );
    }

    const primaryVehicle = lead.vehicles?.[0];
    const category = (primaryVehicle?.category ||
      'PRIVATE_CAR') as VehicleCategory;
    const vehicleStatus = primaryVehicle?.status || 'EXISTING';
    const policyType = lead.motorQuotations?.[0]?.policyType || 'PACKAGE';

    const rules = this.getRequiredDocuments({
      vehicleCategory: category,
      vehicleStatus,
      policyType,
      inspectionRequired: false,
    });

    const mandatoryRules = rules.requiredDocuments.filter((r) => r.isMandatory);

    const verifiedCodes = new Set<string>();
    const pendingCodes = new Set<string>();

    for (const doc of uploadedDocs) {
      const typeCode = (
        doc.name ||
        (doc.metadata as any)?.docCode ||
        ''
      ).toUpperCase();
      if (doc.verificationStatus === 'VERIFIED') {
        verifiedCodes.add(typeCode);
      } else {
        pendingCodes.add(typeCode);
      }
    }

    const missingDocs = mandatoryRules.filter(
      (rule) => !verifiedCodes.has(rule.code.toUpperCase()),
    );

    const verifiedCount = mandatoryRules.length - missingDocs.length;
    const mandatoryTotal = mandatoryRules.length;
    const completionPercentage =
      mandatoryTotal > 0
        ? Math.round((verifiedCount / mandatoryTotal) * 100)
        : 100;

    return {
      complete: missingDocs.length === 0,
      completionPercentage,
      mandatoryTotal,
      verifiedCount,
      missingDocuments: missingDocs,
      verifiedDocuments: Array.from(verifiedCodes),
      pendingReviewDocuments: Array.from(pendingCodes),
    };
  }
}
