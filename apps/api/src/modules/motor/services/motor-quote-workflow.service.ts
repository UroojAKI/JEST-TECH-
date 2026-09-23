import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  MotorRuleEngineService,
  MotorRuleContext,
} from './motor-rule-engine.service';
import { NumberingEngineService } from '../../administration/services/numbering-engine/numbering-engine.service';
import { InspectionStatus, VehicleStatus } from '@prisma/client';

export interface CapturePreviousPolicyDto {
  quotationId: string;
  policyExpiryDate?: string;
  previousPolicyType?: string;
  previousInsurerName?: string;
  previousPolicyNumber?: string;
  previousOdInsurerName?: string;
  previousOdPolicyNumber?: string;
  odExpiryDate?: string;
  tpExpiryDate?: string;
  claimInPreviousYear: boolean;
  ownershipTransfer: boolean;
  previousPolicyTransferred?: boolean;
  rcTransferStatus?: string;
  newOwnerName?: string;
  eligibleNcbPercentage: number;
  newPolicyType: 'TP_ONLY' | 'SAOD' | 'PACKAGE';
  newInsurerName?: string;
  previousPolicyCopyUrl?: string;
}

@Injectable()
export class MotorQuoteWorkflowService {
  private readonly logger = new Logger(MotorQuoteWorkflowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ruleEngine: MotorRuleEngineService,
    private readonly numberingEngine: NumberingEngineService,
  ) {}

  /**
   * Captures previous policy data, runs the Motor Rule Engine, and atomically creates
   * an inspection record and an idempotent operational BackOfficeTask if inspection is required.
   * For VehicleStatus.NEW, skips previous-policy capture and inspection entirely.
   * Returns the canonical API response contract.
   */
  async capturePreviousPolicyAndEvaluate(
    dto: CapturePreviousPolicyDto,
    actorCompanyId?: string,
  ) {
    const quotation = await this.prisma.quotation.findUnique({
      where: { id: dto.quotationId },
      include: { vehicle: true },
    });
    if (!quotation)
      throw new NotFoundException(`Quotation ${dto.quotationId} not found`);

    if (
      actorCompanyId &&
      quotation.companyId &&
      quotation.companyId !== actorCompanyId
    ) {
      throw new ForbiddenException(
        'Cross-organization quotation evaluation is strictly prohibited',
      );
    }

    // ─── 0. Early NEW Vehicle Guard ──────────────────────────────────────────
    // For NEW vehicles, no previous policy exists, no rule evaluation is needed,
    // and no inspection from previous policy expiry is required.
    if (
      quotation.vehicle?.status === VehicleStatus.NEW ||
      (quotation.vehicle as any)?.status === 'NEW'
    ) {
      await this.prisma.quotation.update({
        where: { id: dto.quotationId },
        data: {
          workflowState: 'RULES_EVALUATED',
          ncbPercentage: 0,
        },
      });

      this.logger.log(
        `Quotation ${dto.quotationId} is for a NEW vehicle. Skipped previous-policy capture and inspection.`,
      );

      return {
        quotationId: dto.quotationId,
        workflowState: 'RULES_EVALUATED',
        inspectionRequired: false,
        applicable: false,
        reason: 'NEW_VEHICLE',
        nextStep: 'QUOTATION',
      };
    }

    const today = new Date();
    const expiryDate = dto.policyExpiryDate
      ? new Date(dto.policyExpiryDate)
      : null;
    const ninetyDaysAgo = new Date(today);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const expiredMoreThan90Days = expiryDate
      ? expiryDate < ninetyDaysAgo
      : false;

    // 1. Save or update the previous policy record
    const rcTransferStatusBool =
      typeof dto.rcTransferStatus === 'boolean'
        ? dto.rcTransferStatus
        : dto.rcTransferStatus
          ? String(dto.rcTransferStatus).toLowerCase() === 'true' ||
            String(dto.rcTransferStatus).toUpperCase() === 'TRANSFERRED'
          : undefined;

    const prevPolicy = await this.prisma.motorPreviousPolicy.upsert({
      where: { quotationId: dto.quotationId },
      create: {
        quotationId: dto.quotationId,
        policyExpiryDate: expiryDate,
        expiredMoreThan90Days,
        ownershipTransfer: dto.ownershipTransfer,
        previousPolicyType: dto.previousPolicyType as any,
        previousInsurerName: dto.previousInsurerName,
        previousPolicyNumber: dto.previousPolicyNumber,
        previousOdInsurerName: dto.previousOdInsurerName,
        previousOdPolicyNumber: dto.previousOdPolicyNumber,
        odExpiryDate: dto.odExpiryDate ? new Date(dto.odExpiryDate) : null,
        tpExpiryDate: dto.tpExpiryDate ? new Date(dto.tpExpiryDate) : null,
        claimInPreviousYear: dto.claimInPreviousYear,
        policyTransferStatus: dto.previousPolicyTransferred,
        rcTransferStatus: rcTransferStatusBool,
        newOwnerName: dto.newOwnerName,
        previousPolicyCopyUrl: dto.previousPolicyCopyUrl,
      },
      update: {
        policyExpiryDate: expiryDate,
        expiredMoreThan90Days,
        ownershipTransfer: dto.ownershipTransfer,
        previousPolicyType: dto.previousPolicyType as any,
        previousInsurerName: dto.previousInsurerName,
        previousPolicyNumber: dto.previousPolicyNumber,
        previousOdInsurerName: dto.previousOdInsurerName,
        previousOdPolicyNumber: dto.previousOdPolicyNumber,
        odExpiryDate: dto.odExpiryDate ? new Date(dto.odExpiryDate) : null,
        tpExpiryDate: dto.tpExpiryDate ? new Date(dto.tpExpiryDate) : null,
        claimInPreviousYear: dto.claimInPreviousYear,
        policyTransferStatus: dto.previousPolicyTransferred,
        rcTransferStatus: rcTransferStatusBool,
        newOwnerName: dto.newOwnerName,
        previousPolicyCopyUrl: dto.previousPolicyCopyUrl,
      },
    });

    // 2. Build rule engine context
    const context: MotorRuleContext = {
      policyExpiryDate: expiryDate,
      expiredMoreThan90Days,
      ownershipTransfer: dto.ownershipTransfer,
      previousPolicyTransferred: dto.previousPolicyTransferred,
      claimInPreviousYear: dto.claimInPreviousYear,
      previousPolicyType: dto.previousPolicyType as any,
      newPolicyType: dto.newPolicyType,
      newInsurerName: dto.newInsurerName,
      previousInsurerName: dto.previousInsurerName,
      tpExpiryDate: dto.tpExpiryDate ? new Date(dto.tpExpiryDate) : null,
      odExpiryDate: dto.odExpiryDate ? new Date(dto.odExpiryDate) : null,
      eligibleNcbPercentage: dto.eligibleNcbPercentage,
      newOwnerName: dto.newOwnerName,
      quotationDate: today,
    };

    // 3. Run the rule engine — backend is SOLE authority
    const result = this.ruleEngine.evaluateQuotation(context);

    // 4. Atomic Transaction following canonical lock order:
    // Quotation -> MotorRuleEvaluation -> MotorInspection -> BackOfficeTask -> OutboxEvent
    const inspectionRecord = await this.prisma.$transaction(async (tx) => {
      // 1. Lock/Verify Quotation
      const currentQuote = await tx.quotation.findUnique({
        where: { id: dto.quotationId },
      });
      if (!currentQuote) throw new NotFoundException(`Quotation not found`);

      // 2. Upsert MotorRuleEvaluation
      await tx.motorRuleEvaluation.upsert({
        where: { quotationId: dto.quotationId },
        create: {
          quotationId: dto.quotationId,
          previousPolicyId: prevPolicy.id,
          inspectionRequired: result.inspectionRequired,
          inspectionReasons: result.inspectionReasons,
          ncb: result.ncb,
          ncbReason: result.ncbReason as any,
          eligibleNcb: result.eligibleNcb,
          tpVerificationRequired: result.tpVerificationRequired,
          policyTransferRequired: result.policyTransferRequired,
          saodTpValid: result.saodTpValid,
          missingDocuments: result.missingDocuments,
          nextStep: result.nextStep,
          evaluationContext: context as any,
        },
        update: {
          inspectionRequired: result.inspectionRequired,
          inspectionReasons: result.inspectionReasons,
          ncb: result.ncb,
          ncbReason: result.ncbReason as any,
          eligibleNcb: result.eligibleNcb,
          tpVerificationRequired: result.tpVerificationRequired,
          policyTransferRequired: result.policyTransferRequired,
          saodTpValid: result.saodTpValid,
          missingDocuments: result.missingDocuments,
          nextStep: result.nextStep,
          evaluationContext: context as any,
          evaluatedAt: new Date(),
        },
      });

      let createdOrExistingInspection: any = null;

      if (result.inspectionRequired) {
        // 3. Upsert MotorInspection with companyId & transaction-aware numbering
        const existingInspection = await tx.motorInspection.findUnique({
          where: { quotationId: dto.quotationId },
        });

        if (existingInspection) {
          createdOrExistingInspection = existingInspection;
        } else {
          const inspectionCode = await this.numberingEngine.generateNext(
            'INSPECTION',
            tx,
          );
          createdOrExistingInspection = await tx.motorInspection.create({
            data: {
              quotationId: dto.quotationId,
              companyId: currentQuote.companyId,
              inspectionCode,
              status: InspectionStatus.REQUIRED,
              inspectorCompany: 'JEST Inspection Network',
            },
          });

          await tx.motorInspectionHistory.create({
            data: {
              inspectionId: createdOrExistingInspection.id,
              fromStatus: InspectionStatus.NOT_REQUIRED,
              toStatus: InspectionStatus.REQUIRED,
              action: 'CREATE',
              actorId: 'RULE_ENGINE',
              actorRole: 'SYSTEM',
              reason: `Inspection required by rule engine: ${result.inspectionReasons.join(', ')}`,
            },
          });
        }

        // 4. Upsert BackOfficeTask with permanent idempotency key: INSPECTION:{quotationId}:ASSIGNMENT
        const taskKey = `INSPECTION:${dto.quotationId}:ASSIGNMENT`;
        const taskCode = await this.numberingEngine
          .generateNext('TASK', tx)
          .catch(() => `TASK-${Date.now()}`);

        await tx.backOfficeTask.upsert({
          where: {
            companyId_idempotencyKey: {
              companyId: currentQuote.companyId,
              idempotencyKey: taskKey,
            },
          },
          create: {
            taskCode,
            companyId: currentQuote.companyId,
            idempotencyKey: taskKey,
            taskType: 'MOTOR_INSPECTION_REVIEW',
            sourceType: 'MOTOR_QUOTATION',
            sourceEntityId: dto.quotationId,
            status: 'PENDING',
            priority: 'HIGH',
            verificationNotes: `Inspection required: ${result.inspectionReasons.join(', ')}`,
          },
          update: {
            status: 'PENDING',
          },
        });

        // 5. Upsert OutboxEvent for inspection.required
        const eventKey = `inspection.required:${dto.quotationId}`;
        await tx.outboxEvent.upsert({
          where: { eventKey },
          create: {
            eventKey,
            aggregateType: 'INSPECTION',
            aggregateId: createdOrExistingInspection.id,
            eventType: 'inspection.required',
            payload: {
              quotationId: dto.quotationId,
              inspectionId: createdOrExistingInspection.id,
              companyId: currentQuote.companyId,
              reasons: result.inspectionReasons,
            },
            status: 'PENDING',
          },
          update: {},
        });
      }

      // 6. Update quotation workflow state
      await tx.quotation.update({
        where: { id: dto.quotationId },
        data: {
          workflowState: result.inspectionRequired
            ? 'INSPECTION_REQUIRED'
            : 'RULES_EVALUATED',
          ncbPercentage: result.ncb,
        },
      });

      return createdOrExistingInspection;
    });

    this.logger.log(
      `Previous policy captured and rules evaluated for quotation ${dto.quotationId}`,
    );

    // 5. Return Canonical API Response Contract
    return {
      quotationId: dto.quotationId,
      workflowState: result.inspectionRequired
        ? 'INSPECTION_REQUIRED'
        : 'RULES_EVALUATED',
      inspectionRequired: result.inspectionRequired,
      inspection: inspectionRecord
        ? {
            id: inspectionRecord.id,
            inspectionCode: inspectionRecord.inspectionCode,
            status: inspectionRecord.status,
            companyId: inspectionRecord.companyId,
            missingPhotos: [
              'front',
              'back',
              'left',
              'right',
              'windshield',
              'chassis',
              'odometer',
            ],
            canSubmit: false,
          }
        : null,
      inspectionReasons: result.inspectionReasons,
      nextStep: result.nextStep,
    };
  }

  /**
   * Re-evaluate rules from stored data. Never trust the stored result as source of truth.
   * Always recalculate from the source context.
   */
  async reEvaluate(quotationId: string, actorCompanyId?: string) {
    const prevPolicy = await this.prisma.motorPreviousPolicy.findUnique({
      where: { quotationId },
      include: { ruleEvaluation: true },
    });
    if (!prevPolicy)
      throw new NotFoundException(
        `No previous policy found for quotation ${quotationId}`,
      );

    const quotation = await this.prisma.quotation.findUnique({
      where: { id: quotationId },
    });
    if (!quotation)
      throw new NotFoundException(`Quotation ${quotationId} not found`);

    if (
      actorCompanyId &&
      quotation.companyId &&
      quotation.companyId !== actorCompanyId
    ) {
      throw new ForbiddenException(
        'Cross-organization quotation evaluation is strictly prohibited',
      );
    }

    const evaluationContext = prevPolicy.ruleEvaluation
      ?.evaluationContext as any;
    if (!evaluationContext)
      throw new NotFoundException(`No evaluation context found`);

    // Rebuild context from stored snapshot and re-run
    const context: MotorRuleContext = {
      ...evaluationContext,
      policyExpiryDate: evaluationContext.policyExpiryDate
        ? new Date(evaluationContext.policyExpiryDate)
        : null,
      tpExpiryDate: evaluationContext.tpExpiryDate
        ? new Date(evaluationContext.tpExpiryDate)
        : null,
      odExpiryDate: evaluationContext.odExpiryDate
        ? new Date(evaluationContext.odExpiryDate)
        : null,
      quotationDate: new Date(),
    };

    return this.ruleEngine.evaluateQuotation(context);
  }
}
