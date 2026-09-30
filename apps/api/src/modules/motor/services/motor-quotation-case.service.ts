import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TenantResourceAuthorizationService } from '../../auth/services/tenant-resource-authorization.service';
import { NumberingEngineService } from '../../administration/services/numbering-engine/numbering-engine.service';
import { RequestUser } from '../../auth/decorators/current-user.decorator';
import { CreateMotorQuotationCaseDto } from '../dto/motor-quotation-case.dto';

@Injectable()
export class MotorQuotationCaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantAuthService: TenantResourceAuthorizationService,
    private readonly numberingEngine: NumberingEngineService,
  ) {}

  /**
   * Creates a new authoritative Motor Quotation Case (MQC)
   * Holds the immutable baseline snapshots: Customer, Vehicle, Previous Policy
   */
  async createCase(dto: CreateMotorQuotationCaseDto, user: RequestUser) {
    const companyId = user.companyId;

    // Validate tenant ownership
    await this.tenantAuthService.assertTenantResource('Contact', dto.contactId, user);
    if (dto.leadId) {
      await this.tenantAuthService.assertTenantResource('Lead', dto.leadId, user);
    }
    if (dto.vehicleId) {
      await this.tenantAuthService.assertTenantResource('Vehicle', dto.vehicleId, user);
    }

    const caseCode = await this.numberingEngine.generateNext('MOTOR_CASE');

    return this.prisma.motorQuotationCase.create({
      data: {
        companyId,
        caseCode,
        category: dto.category,
        vehicleStatus: dto.vehicleStatus || 'EXISTING',
        registrationNumber: dto.registrationNumber || null,
        contactId: dto.contactId,
        vehicleId: dto.vehicleId || null,
        leadId: dto.leadId || null,
        journeyId: dto.journeyId || null,
        customerSnapshot: dto.customerSnapshot as any,
        vehicleSnapshot: dto.vehicleSnapshot as any,
        previousPolicySnapshot: dto.previousPolicySnapshot ? (dto.previousPolicySnapshot as any) : undefined,
      },
      include: {
        contact: true,
        vehicle: true,
        lead: true,
      },
    });
  }

  /**
   * Retrieves a Motor Quotation Case with fail-closed tenant scoping
   */
  async getCase(caseId: string, user: RequestUser) {
    const motorCase = await this.prisma.motorQuotationCase.findFirst({
      where: { id: caseId, companyId: user.companyId },
      include: {
        contact: true,
        vehicle: true,
        lead: true,
        quotations: {
          orderBy: { createdAt: 'desc' },
          include: {
            motorDocuments: {
              include: { document: true },
            },
            motorInspection: true,
            motorPaymentRecord: true,
          },
        },
        selectedQuote: true,
        documents: {
          include: { document: true },
        },
      },
    });

    if (!motorCase) {
      throw new NotFoundException(`MotorQuotationCase '${caseId}' not found or access denied`);
    }

    return motorCase;
  }

  /**
   * Lists all quotation cases associated with a lead
   */
  async getCasesForLead(leadId: string, user: RequestUser) {
    await this.tenantAuthService.assertTenantResource('Lead', leadId, user);

    return this.prisma.motorQuotationCase.findMany({
      where: { leadId, companyId: user.companyId },
      include: {
        quotations: {
          select: {
            id: true,
            quotationCode: true,
            insurerName: true,
            totalPremium: true,
            workflowState: true,
            status: true,
            createdAt: true,
          },
        },
        selectedQuote: {
          select: {
            id: true,
            quotationCode: true,
            insurerName: true,
            totalPremium: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Selects a winning quotation for a case
   */
  async selectQuotation(caseId: string, quotationId: string, user: RequestUser) {
    const motorCase = await this.prisma.motorQuotationCase.findFirst({
      where: { id: caseId, companyId: user.companyId },
    });

    if (!motorCase) {
      throw new NotFoundException(`MotorQuotationCase '${caseId}' not found or access denied`);
    }

    const quotation = await this.prisma.quotation.findFirst({
      where: { id: quotationId, companyId: user.companyId, caseId },
    });

    if (!quotation) {
      throw new BadRequestException(
        `Quotation '${quotationId}' does not belong to case '${caseId}' or access denied`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedCase = await tx.motorQuotationCase.update({
        where: { id: caseId },
        data: {
          selectedQuoteId: quotationId,
          status: 'SELECTED',
        },
        include: {
          selectedQuote: true,
        },
      });

      await tx.quotation.update({
        where: { id: quotationId },
        data: {
          status: 'ACCEPTED',
        },
      });

      return updatedCase;
    });
  }

  /**
   * Generates a side-by-side comparison matrix across all quotes in the case
   */
  async compareCaseQuotations(caseId: string, user: RequestUser) {
    const motorCase = await this.getCase(caseId, user);

    const quotes = motorCase.quotations || [];
    const comparisonRows = quotes.map((q) => {
      const calc = (q.calculationSnapshot as any) || {};
      const outputs = calc.outputs || {};

      return {
        quotationId: q.id,
        quotationCode: q.quotationCode,
        insurerName: q.insurerName,
        policyType: q.policyType,
        idv: Number(q.sumInsured || 0),
        ncbPercentage: Number(q.ncbPercentage || 0),
        baseOdPremium: Number(outputs.baseOdPremium || 0),
        totalAddonsPremium: Number(outputs.totalAddonsPremium || 0),
        netOdPremium: Number(outputs.netOdPremium || 0),
        netTpPremium: Number(outputs.netTpPremium || outputs.baseTpPremium || 0),
        paCoverPremium: Number(outputs.paCoverPremium || 0),
        totalDiscount: Number(outputs.totalDiscount || 0),
        totalGst: Number(q.gstAmount || outputs.totalGst || 0),
        finalPayable: Number(q.totalPremium || outputs.totalPremium || 0),
        workflowState: q.workflowState,
        status: q.status,
        inspectionRequired: outputs.inspectionRequired ?? (q.workflowState === 'INSPECTION_REQUIRED'),
        isSelected: q.id === motorCase.selectedQuoteId,
        createdAt: q.createdAt,
      };
    });

    return {
      caseId: motorCase.id,
      caseCode: motorCase.caseCode,
      category: motorCase.category,
      registrationNumber: motorCase.registrationNumber,
      selectedQuoteId: motorCase.selectedQuoteId,
      status: motorCase.status,
      totalQuotes: quotes.length,
      quotes: comparisonRows,
    };
  }
}