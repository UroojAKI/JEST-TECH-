import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TenantResourceAuthorizationService } from '../../auth/services/tenant-resource-authorization.service';
import { NumberingEngineService } from '../../administration/services/numbering-engine/numbering-engine.service';
import { RequestUser } from '../../auth/decorators/current-user.decorator';
import { CreateMotorQuotationCaseDto } from '../dto/motor-quotation-case.dto';
import { MotorCaseStatus, RoleType, BackOfficeTaskStatus } from '@prisma/client';
import { MotorCaseStateMachineService } from './motor-case-state-machine.service';

@Injectable()
export class MotorQuotationCaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantAuthService: TenantResourceAuthorizationService,
    private readonly numberingEngine: NumberingEngineService,
    private readonly stateMachine: MotorCaseStateMachineService,
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
   * Validates whether a case status transition is allowed per MOTOR-0010
   * Lifecycle: OPEN -> QUOTED -> SELECTED -> COMPLETED
   * Cancellations: OPEN -> CANCELLED, QUOTED -> CANCELLED
   */
  validateCaseTransition(current: MotorCaseStatus, target: MotorCaseStatus): void {
    if (current === target) return;

    const allowedTransitions: Partial<Record<MotorCaseStatus, MotorCaseStatus[]>> = {
      [MotorCaseStatus.OPEN]: [MotorCaseStatus.QUOTED, MotorCaseStatus.QUOTE_GENERATED, MotorCaseStatus.CANCELLED],
      [MotorCaseStatus.DRAFT]: [MotorCaseStatus.CUSTOMER_VERIFIED, MotorCaseStatus.QUOTE_GENERATED, MotorCaseStatus.CANCELLED],
      [MotorCaseStatus.QUOTED]: [MotorCaseStatus.QUOTED, MotorCaseStatus.SELECTED, MotorCaseStatus.PROPOSAL_READY, MotorCaseStatus.CANCELLED],
      [MotorCaseStatus.QUOTE_GENERATED]: [MotorCaseStatus.QUOTE_GENERATED, MotorCaseStatus.PROPOSAL_READY, MotorCaseStatus.SELECTED, MotorCaseStatus.CANCELLED],
      [MotorCaseStatus.SELECTED]: [MotorCaseStatus.COMPLETED],
      [MotorCaseStatus.PROPOSAL_READY]: [MotorCaseStatus.SUBMITTED_FOR_REVIEW, MotorCaseStatus.SELECTED, MotorCaseStatus.COMPLETED],
      [MotorCaseStatus.COMPLETED]: [],
      [MotorCaseStatus.CANCELLED]: [],
    };

    const allowed = allowedTransitions[current] || [];
    if (!allowed.includes(target)) {
      throw new BadRequestException(
        `Invalid MotorQuotationCase transition from '${current}' to '${target}'. Allowed transitions: ${allowed.join(', ') || 'None (Terminal state)'}`,
      );
    }
  }

  /**
   * Authoritatively transitions the case status
   */
  async transitionCaseStatus(
    caseId: string,
    targetStatus: MotorCaseStatus,
    user: RequestUser,
    reason?: string,
  ) {
    const motorCase = await this.prisma.motorQuotationCase.findFirst({
      where: { id: caseId, companyId: user.companyId },
    });

    if (!motorCase) {
      throw new NotFoundException(`MotorQuotationCase '${caseId}' not found or access denied`);
    }

    const roles = (user as any).roles?.length ? (user as any).roles : user.role ? [user.role] : [];
    const isBackOfficeOrAdmin =
      roles.includes('ADMIN') ||
      roles.includes('BACK_OFFICE') ||
      roles.includes(RoleType.ADMIN) ||
      roles.includes(RoleType.BACK_OFFICE);

    if (!isBackOfficeOrAdmin && targetStatus === MotorCaseStatus.COMPLETED) {
      throw new ForbiddenException(
        'Completing a motor quotation case is restricted to Back Office or Administrators.',
      );
    }

    this.validateCaseTransition(motorCase.status, targetStatus);

    return this.prisma.motorQuotationCase.update({
      where: { id: caseId },
      data: {
        status: targetStatus,
      },
      include: {
        contact: true,
        vehicle: true,
        lead: true,
        selectedQuote: true,
      },
    });
  }

  /**
   * Cancels a quotation case
   */
  async cancelCase(caseId: string, reason: string | undefined, user: RequestUser) {
    const motorCase = await this.prisma.motorQuotationCase.findFirst({
      where: { id: caseId, companyId: user.companyId },
      include: {
        lead: true,
        quotations: {
          select: { createdById: true, agentId: true },
        },
      },
    });

    if (!motorCase) {
      throw new NotFoundException(`MotorQuotationCase '${caseId}' not found or access denied`);
    }

    if (
      motorCase.status !== MotorCaseStatus.OPEN &&
      motorCase.status !== MotorCaseStatus.DRAFT &&
      motorCase.status !== MotorCaseStatus.QUOTED &&
      motorCase.status !== MotorCaseStatus.QUOTE_GENERATED
    ) {
      throw new BadRequestException(
        `Case cannot be cancelled from '${motorCase.status}' status. Only OPEN, DRAFT, QUOTED, or QUOTE_GENERATED cases can be cancelled.`,
      );
    }

    const roles = (user as any).roles?.length ? (user as any).roles : user.role ? [user.role] : [];
    const isBackOfficeOrAdmin =
      roles.includes('ADMIN') ||
      roles.includes('BACK_OFFICE') ||
      roles.includes(RoleType.ADMIN) ||
      roles.includes(RoleType.BACK_OFFICE);

    if (!isBackOfficeOrAdmin) {
      const isOwner =
        !motorCase.lead ||
        motorCase.lead?.assignedToId === user.id ||
        motorCase.lead?.createdById === user.id ||
        !motorCase.quotations?.length ||
        motorCase.quotations?.some(
          (q) => q.createdById === user.id || q.agentId === user.id,
        );
      if (!isOwner) {
        throw new ForbiddenException(
          'You do not have permission to cancel this quotation case.',
        );
      }
    }

    return this.transitionCaseStatus(caseId, MotorCaseStatus.CANCELLED, user, reason);
  }

  /**
   * Selects a winning quotation for a case
   */
  async selectQuotation(caseId: string, quotationId: string, user: RequestUser) {
    const motorCase = await this.prisma.motorQuotationCase.findFirst({
      where: { id: caseId, companyId: user.companyId },
      include: { lead: true },
    });

    if (!motorCase) {
      throw new NotFoundException(`MotorQuotationCase '${caseId}' not found or access denied`);
    }

    const inspectionGateStatuses: MotorCaseStatus[] = [
      MotorCaseStatus.INSPECTION_REQUIRED,
      MotorCaseStatus.INSPECTION_SUBMITTED,
      MotorCaseStatus.INSPECTION_APPROVED,
      MotorCaseStatus.INSPECTION_WAIVED,
      MotorCaseStatus.REWORK_REQUIRED,
    ];
    const keepsInspectionGate = inspectionGateStatuses.includes(motorCase.status);
    if (!keepsInspectionGate) {
      this.validateCaseTransition(motorCase.status, MotorCaseStatus.SELECTED);
    }

    const quotation = await this.prisma.quotation.findFirst({
      where: { id: quotationId, companyId: user.companyId, caseId },
    });

    if (!quotation) {
      throw new BadRequestException(
        `Quotation '${quotationId}' does not belong to case '${caseId}' or access denied`,
      );
    }

    const roles = (user as any).roles?.length ? (user as any).roles : user.role ? [user.role] : [];
    const isBackOfficeOrAdmin =
      roles.includes('ADMIN') ||
      roles.includes('BACK_OFFICE') ||
      roles.includes(RoleType.ADMIN) ||
      roles.includes(RoleType.BACK_OFFICE);

    if (!isBackOfficeOrAdmin) {
      const isOwner =
        quotation.createdById === user.id ||
        quotation.agentId === user.id ||
        !motorCase.lead ||
        motorCase.lead?.assignedToId === user.id ||
        motorCase.lead?.createdById === user.id;
      if (!isOwner) {
        throw new ForbiddenException(
          'You do not have permission to select a quotation for this case.',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedCase = await tx.motorQuotationCase.update({
        where: { id: caseId },
        data: {
          selectedQuoteId: quotationId,
          status: keepsInspectionGate
            ? motorCase.status
            : MotorCaseStatus.SELECTED,
        },
        include: {
          selectedQuote: true,
        },
      });

      await tx.quotation.update({
        where: { id: quotationId },
        data: {
          workflowState: keepsInspectionGate
            ? quotation.workflowState
            : 'READY_FOR_PROPOSAL',
          motorMetadata: {
            ...((quotation.motorMetadata as any) || {}),
            caseSelection: 'SELECTED',
            selectedAt: new Date().toISOString(),
          },
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

  /**
   * Submits a Motor Quotation Case for Back Office review (WF-006B)
   * Enforces that a proposal is selected, transitions case to SUBMITTED_FOR_REVIEW,
   * and idempotently creates a BackOfficeTask with caseId.
   */
  async submitCase(caseId: string, user: RequestUser) {
    const motorCase = await this.prisma.motorQuotationCase.findFirst({
      where: { id: caseId, companyId: user.companyId },
      include: {
        lead: true,
        selectedQuote: true,
      },
    });

    if (!motorCase) {
      throw new NotFoundException(`MotorQuotationCase '${caseId}' not found or access denied`);
    }

    const roles = (user as any).roles?.length ? (user as any).roles : user.role ? [user.role] : [];
    const isBackOfficeOrAdmin =
      roles.includes('ADMIN') ||
      roles.includes('BACK_OFFICE') ||
      roles.includes(RoleType.ADMIN) ||
      roles.includes(RoleType.BACK_OFFICE);

    if (!isBackOfficeOrAdmin) {
      const isOwner =
        motorCase.lead?.assignedToId === user.id ||
        motorCase.lead?.createdById === user.id ||
        motorCase.selectedQuote?.createdById === user.id ||
        motorCase.selectedQuote?.agentId === user.id;
      if (!isOwner) {
        throw new ForbiddenException(
          'You do not have permission to submit this quotation case for review.',
        );
      }
    }

    if (!motorCase.selectedQuoteId) {
      throw new BadRequestException(
        'Cannot submit case for review without selecting a winning quotation/proposal.',
      );
    }

    // Advance state machine to SUBMITTED_FOR_REVIEW
    const updatedCase = await this.stateMachine.transition(
      caseId,
      'SUBMIT_FOR_REVIEW',
      user,
      { reason: 'Agent submitted case for back-office review' },
    );

    // Concurrency-safe, idempotent creation of BackOfficeTask
    let task = await this.prisma.backOfficeTask.findFirst({
      where: {
        caseId,
        companyId: user.companyId,
        deletedAt: null,
        status: {
          in: [BackOfficeTaskStatus.PENDING, BackOfficeTaskStatus.IN_REVIEW],
        },
      },
      include: {
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    if (!task) {
      let taskCode: string;
      try {
        const result = await this.prisma.$queryRaw<[{ nextval: bigint }]>`
          SELECT nextval('back_office_task_code_seq')::bigint AS nextval
        `;
        taskCode = `BOT-${Number(result[0].nextval).toString().padStart(6, '0')}`;
      } catch {
        taskCode = await this.numberingEngine.generateNext('BOT');
      }

      task = await this.prisma.backOfficeTask.create({
        data: {
          companyId: user.companyId,
          taskCode,
          taskType: 'PROPOSAL_VERIFICATION',
          priority: 'HIGH',
          status: BackOfficeTaskStatus.PENDING,
          leadId: motorCase.leadId || null,
          motorQuotationId: motorCase.selectedQuoteId || null,
          caseId: motorCase.id,
          createdById: user.id,
          verificationNotes: 'Case submitted for back office review and document verification.',
        },
        include: {
          assignedTo: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      });
    }

    return {
      case: updatedCase,
      task,
    };
  }
}
