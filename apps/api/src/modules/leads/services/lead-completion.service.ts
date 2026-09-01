import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

export interface LeadCompletionStage {
  stage: number;
  name: string;
  score: number;
  maxScore: number;
  isComplete: boolean;
  missingFields: string[];
}

export interface LeadCompletionStatus {
  leadId: string;
  leadCode: string;
  totalScore: number;
  isQualifiedForQuotation: boolean;
  stages: LeadCompletionStage[];
  blockingReasons: string[];
  recommendedNextStep: string;
}

@Injectable()
export class LeadCompletionService {
  constructor(private readonly prisma: PrismaService) {}

  async computeCompletionStatus(leadId: string): Promise<LeadCompletionStatus> {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        contact: {
          include: {
            vehicles: {
              where: { deletedAt: null },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        account: true,
        assignedTo: true,
      },
    });

    if (!lead || lead.deletedAt) {
      throw new NotFoundException(`Lead with ID ${leadId} not found`);
    }

    const stages: LeadCompletionStage[] = [];
    const blockingReasons: string[] = [];

    const stage1Missing: string[] = [];
    let stage1Score = 0;
    if (lead.contact?.firstName && lead.contact?.lastName) stage1Score += 5;
    else stage1Missing.push('Contact Full Name');
    if (lead.contact?.phone) stage1Score += 5;
    else stage1Missing.push('Contact Mobile Number');
    if (lead.contact?.email) stage1Score += 5;
    else stage1Missing.push('Contact Email Address');
    if (lead.contact?.panNumber || lead.account?.panNumber) stage1Score += 5;
    else stage1Missing.push('PAN Number (Contact or Account)');

    stages.push({
      stage: 1,
      name: 'Customer Identity & KYC',
      score: stage1Score,
      maxScore: 20,
      isComplete: stage1Score >= 15,
      missingFields: stage1Missing,
    });
    if (stage1Score < 15) {
      blockingReasons.push('Customer identity incomplete (Name, Phone, and Email required).');
    }

    const stage2Missing: string[] = [];
    let stage2Score = 0;
    if (lead.title) stage2Score += 5;
    else stage2Missing.push('Opportunity Title');
    if (lead.assignedToId) stage2Score += 10;
    else stage2Missing.push('Assigned Sales Agent / RM');
    if (lead.source) stage2Score += 5;
    else stage2Missing.push('Lead Source Channel');

    stages.push({
      stage: 2,
      name: 'Opportunity Assignment',
      score: stage2Score,
      maxScore: 20,
      isComplete: stage2Score >= 15,
      missingFields: stage2Missing,
    });
    if (!lead.assignedToId) blockingReasons.push('Lead must be assigned to an active Sales Agent.');

    const stage3Missing: string[] = [];
    let stage3Score = 0;
    const vehicle = lead.contact?.vehicles?.[0];
    if (vehicle) {
      if (vehicle.category) stage3Score += 5;
      else stage3Missing.push('Vehicle Category (IRDAI Class)');
      if (vehicle.registrationNumber || vehicle.status === 'NEW') stage3Score += 5;
      else stage3Missing.push('Registration Number (or Mark as Brand New)');
      if (vehicle.makeModel) stage3Score += 5;
      else stage3Missing.push('Vehicle Make & Model');
      if (vehicle.fuelType && vehicle.manufactureYearMonth) stage3Score += 5;
      else stage3Missing.push('Fuel Type & Manufacturing Year');
    } else {
      stage3Missing.push('No vehicle record linked to lead contact');
    }

    stages.push({
      stage: 3,
      name: 'Vehicle Specs & IRDAI Classification',
      score: stage3Score,
      maxScore: 20,
      isComplete: stage3Score >= 15,
      missingFields: stage3Missing,
    });
    if (stage3Score < 15) {
      blockingReasons.push('Incomplete vehicle details (Category, Registration/NEW, Make/Model, and Fuel required).');
    }

    // Do not treat free-text descriptions such as "previous policy" as proof.
    // A brand-new vehicle is the only authoritative exemption from prior-policy evidence here.
    const stage4Missing: string[] = [];
    let stage4Score = 0;
    if (vehicle?.status === 'NEW') {
      stage4Score = 20;
    } else {
      stage4Missing.push('Previous policy status, expiry date, or NCB declaration');
      blockingReasons.push('Previous policy/NCB evidence is required before quotation readiness.');
    }

    stages.push({
      stage: 4,
      name: 'Previous Policy & NCB Eligibility',
      score: stage4Score,
      maxScore: 20,
      isComplete: stage4Score >= 15,
      missingFields: stage4Missing,
    });

    const stage5Missing: string[] = [];
    const documentTypes = ['RC', 'KYC', 'PREVIOUS_POLICY', 'RC_COPY', 'KYC_DOCUMENT', 'PRIOR_POLICY'];
    const docCount = await this.prisma.document.count({
      where: {
        deletedAt: null,
        entityId: { in: [lead.id, lead.contactId] },
        OR: documentTypes.map((type) => ({ documentType: type } as any)),
      },
    });
    const stage5Score = docCount > 0 ? 20 : 0;
    if (docCount === 0) stage5Missing.push('RC copy, KYC document, or prior policy document');

    stages.push({
      stage: 5,
      name: 'Document Evidence & KYC',
      score: stage5Score,
      maxScore: 20,
      isComplete: stage5Score >= 15,
      missingFields: stage5Missing,
    });

    const totalScore = stages.reduce((acc, stage) => acc + stage.score, 0);
    const isQualifiedForQuotation =
      totalScore >= 60 &&
      stages.every((stage) => stage.isComplete);

    let recommendedNextStep = 'Lead is ready for motor quotation comparison';
    const firstIncomplete = stages.find((stage) => !stage.isComplete);
    if (firstIncomplete) {
      recommendedNextStep = firstIncomplete.missingFields[0] || 'Complete the next lead stage';
    }

    return {
      leadId: lead.id,
      leadCode: lead.leadCode,
      totalScore,
      isQualifiedForQuotation,
      stages,
      blockingReasons,
      recommendedNextStep,
    };
  }
}
