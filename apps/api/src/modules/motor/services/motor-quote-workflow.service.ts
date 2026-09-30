import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  MotorRuleEngineService,
  MotorRuleContext,
} from './motor-rule-engine.service';
import { MotorPolicyDateService } from './motor-policy-date.service';
import { NumberingEngineService } from '../../administration/services/numbering-engine/numbering-engine.service';
import {
  InspectionStatus,
  VehicleStatus,
  MotorWorkflowState,
  Prisma,
  RoleType,
} from '@prisma/client';
import { ActorContext } from '../../../common/interfaces/actor-context.interface';

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
    private readonly policyDateService: MotorPolicyDateService,
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
    actorCompanyIdOrActor?: string | ActorContext,
    maybeActor?: ActorContext,
  ) {
    const actor: ActorContext | undefined =
      typeof actorCompanyIdOrActor === 'object' && actorCompanyIdOrActor !== null
        ? actorCompanyIdOrActor
        : maybeActor;
    const actorCompanyId: string | undefined =
      typeof actorCompanyIdOrActor === 'string'
        ? actorCompanyIdOrActor
        : actor?.companyId || actor?.organizationId;

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

    if (actor) {
      const roles = actor.roles?.length ? actor.roles : [actor.role];
      const isAgentRole =
        roles.includes(RoleType.AGENT) &&
        !roles.includes(RoleType.ADMIN) &&
        !roles.includes(RoleType.BACK_OFFICE);
      if (isAgentRole) {
        const isOwner =
          quotation.createdById === actor.userId ||
          quotation.agentId === actor.userId;
        if (!isOwner) {
          throw new ForbiddenException(
            'You do not have permission to modify or evaluate this quotation',
          );
        }
      }
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
          workflowState: 'READY_FOR_PROPOSAL',
          ncbPercentage: 0,
        },
      });

      this.logger.log(
        `Quotation ${dto.quotationId} is for a NEW vehicle. Skipped previous-policy capture and inspection.`,
      );

      return {
        quotationId: dto.quotationId,
        workflowState: 'READY_FOR_PROPOSAL',
        inspectionRequired: false,
        applicable: false,
        reason: 'NEW_VEHICLE',
        nextStep: 'QUOTATION',
      };
    }

    // ── Business-Date-Aware Date Calculations ─────────────────────────────
    // FIX: Use MotorPolicyDateService for all date logic — NOT raw Date arithmetic.
    // Raw `new Date()` comparisons use timestamp semantics which differ from
    // Asia/Kolkata business-date semantics used by MotorRuleEngineService.
    const today = this.policyDateService.getBusinessToday();
    const expiryDateStr = dto.policyExpiryDate || null;
    const expiryDate = expiryDateStr ? new Date(expiryDateStr) : null;

    let expiredMoreThan90Days = false;
    if (expiryDateStr) {
      // daysBetween(expiryStr, today) > 90 means expired more than 90 days ago
      const daysExpired = this.policyDateService.daysBetween(expiryDateStr, today);
      expiredMoreThan90Days = daysExpired > 90;
    }

    const rcTransferStatusBool =
      typeof dto.rcTransferStatus === 'boolean'
        ? dto.rcTransferStatus
        : dto.rcTransferStatus
          ? String(dto.rcTransferStatus).toLowerCase() === 'true' ||
            String(dto.rcTransferStatus).toUpperCase() === 'TRANSFERRED'
          : undefined;

    // 1. Build rule engine context
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

    // 2. Run the rule engine — backend is SOLE authority
    const result = this.ruleEngine.evaluateQuotation(context);

    // 3. Atomic Transaction following canonical lock order:
    // Quotation -> MotorPreviousPolicy -> MotorRuleEvaluation -> MotorInspection -> BackOfficeTask -> OutboxEvent
    const inspectionRecord = await this.prisma.$transaction(async (tx) => {
      // 1. Lock/Verify Quotation
      const currentQuote = await tx.quotation.findUnique({
        where: { id: dto.quotationId },
      });
      if (!currentQuote) throw new NotFoundException(`Quotation not found`);

      // 2. Save or update previous policy inside transaction boundary (F-022)
      const prevPolicy = await tx.motorPreviousPolicy.upsert({
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

      // 3. Upsert MotorRuleEvaluation
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
            : 'READY_FOR_PROPOSAL',
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
        : 'READY_FOR_PROPOSAL',
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
  async reEvaluate(
    quotationId: string,
    actorCompanyIdOrActor?: string | ActorContext,
    maybeActor?: ActorContext,
  ) {
    const actor: ActorContext | undefined =
      typeof actorCompanyIdOrActor === 'object' && actorCompanyIdOrActor !== null
        ? actorCompanyIdOrActor
        : maybeActor;
    const actorCompanyId: string | undefined =
      typeof actorCompanyIdOrActor === 'string'
        ? actorCompanyIdOrActor
        : actor?.companyId || actor?.organizationId;

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

    if (actor) {
      const roles = actor.roles?.length ? actor.roles : [actor.role];
      const isAgentRole =
        roles.includes(RoleType.AGENT) &&
        !roles.includes(RoleType.ADMIN) &&
        !roles.includes(RoleType.BACK_OFFICE);
      if (isAgentRole) {
        const isOwner =
          quotation.createdById === actor.userId ||
          quotation.agentId === actor.userId;
        if (!isOwner) {
          throw new ForbiddenException(
            'You do not have permission to view or evaluate this quotation',
          );
        }
      }
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

  // ── Authoritative State Machine & Transition Authority (Phase 3) ────────

  private static readonly ALLOWED_TRANSITIONS: Record<
    MotorWorkflowState,
    MotorWorkflowState[]
  > = {
    [MotorWorkflowState.DRAFT]: [
      MotorWorkflowState.READY_FOR_PROPOSAL,
      MotorWorkflowState.INSPECTION_REQUIRED,
      MotorWorkflowState.CANCELLED,
      MotorWorkflowState.REJECTED,
    ],
    [MotorWorkflowState.INSPECTION_REQUIRED]: [
      MotorWorkflowState.INSPECTION_SUBMITTED,
      MotorWorkflowState.INSPECTION_COMPLETED,
      MotorWorkflowState.INSPECTION_REJECTED,
      MotorWorkflowState.CANCELLED,
    ],
    [MotorWorkflowState.INSPECTION_SUBMITTED]: [
      MotorWorkflowState.INSPECTION_COMPLETED,
      MotorWorkflowState.INSPECTION_REJECTED,
      MotorWorkflowState.CANCELLED,
    ],
    [MotorWorkflowState.INSPECTION_REJECTED]: [
      MotorWorkflowState.INSPECTION_REQUIRED,
      MotorWorkflowState.INSPECTION_SUBMITTED,
      MotorWorkflowState.CANCELLED,
    ],
    [MotorWorkflowState.INSPECTION_COMPLETED]: [
      MotorWorkflowState.READY_FOR_PROPOSAL,
      MotorWorkflowState.PROPOSAL_IN_PROGRESS,
      MotorWorkflowState.PAYMENT_PENDING,
      MotorWorkflowState.CANCELLED,
    ],
    [MotorWorkflowState.READY_FOR_PROPOSAL]: [
      MotorWorkflowState.PROPOSAL_IN_PROGRESS,
      MotorWorkflowState.PROPOSAL_COMPLETED,
      MotorWorkflowState.PAYMENT_PENDING,
      MotorWorkflowState.CANCELLED,
    ],
    [MotorWorkflowState.PROPOSAL_IN_PROGRESS]: [
      MotorWorkflowState.PROPOSAL_COMPLETED,
      MotorWorkflowState.CANCELLED,
    ],
    [MotorWorkflowState.PROPOSAL_COMPLETED]: [
      MotorWorkflowState.PROPOSAL_APPROVED,
      MotorWorkflowState.PAYMENT_PENDING,
      MotorWorkflowState.REJECTED,
      MotorWorkflowState.CANCELLED,
    ],
    [MotorWorkflowState.PROPOSAL_APPROVED]: [
      MotorWorkflowState.PAYMENT_PENDING,
      MotorWorkflowState.CANCELLED,
    ],
    [MotorWorkflowState.PAYMENT_PENDING]: [
      MotorWorkflowState.PAYMENT_UNDER_PROCESS,
      MotorWorkflowState.PAYMENT_DONE,
      MotorWorkflowState.CANCELLED,
    ],
    [MotorWorkflowState.PAYMENT_UNDER_PROCESS]: [
      MotorWorkflowState.PAYMENT_DONE,
      MotorWorkflowState.PAYMENT_PENDING,
      MotorWorkflowState.CANCELLED,
    ],
    [MotorWorkflowState.PAYMENT_DONE]: [
      MotorWorkflowState.ISSUANCE_PENDING,
      MotorWorkflowState.ISSUANCE_IN_PROGRESS,
      MotorWorkflowState.POLICY_ISSUED,
      MotorWorkflowState.CANCELLED,
    ],
    [MotorWorkflowState.ISSUANCE_PENDING]: [
      MotorWorkflowState.ISSUANCE_IN_PROGRESS,
      MotorWorkflowState.POLICY_ISSUED,
      MotorWorkflowState.CANCELLED,
    ],
    [MotorWorkflowState.ISSUANCE_IN_PROGRESS]: [
      MotorWorkflowState.POLICY_ISSUED,
      MotorWorkflowState.ISSUANCE_PENDING,
      MotorWorkflowState.CANCELLED,
    ],
    [MotorWorkflowState.POLICY_ISSUED]: [
      MotorWorkflowState.ACTIVE,
      MotorWorkflowState.CANCELLED,
    ],
    [MotorWorkflowState.ACTIVE]: [
      MotorWorkflowState.EXPIRED,
      MotorWorkflowState.CANCELLED,
    ],
    [MotorWorkflowState.REJECTED]: [],
    [MotorWorkflowState.CANCELLED]: [],
    [MotorWorkflowState.EXPIRED]: [],
  };

  /**
   * Validates if a state transition is permitted, verifying business invariant guards.
   */
  validateTransition(
    current: MotorWorkflowState,
    target: MotorWorkflowState,
    quotation: any,
  ): void {
    const allowed = MotorQuoteWorkflowService.ALLOWED_TRANSITIONS[current] || [];
    if (!allowed.includes(target)) {
      throw new ConflictException(
        `Invalid workflow transition from '${current}' to '${target}'. Allowed transitions: ${allowed.join(', ') || 'None'}`,
      );
    }

    // Guard on PAYMENT_PENDING
    if (target === MotorWorkflowState.PAYMENT_PENDING) {
      const isNew = quotation.vehicle?.status === VehicleStatus.NEW;
      if (!isNew && !quotation.motorPreviousPolicy) {
        throw new BadRequestException(
          'Cannot transition to PAYMENT_PENDING: Previous policy evaluation is required for existing vehicles',
        );
      }
      if (
        quotation.workflowState === MotorWorkflowState.INSPECTION_REQUIRED ||
        quotation.motorInspection?.status === InspectionStatus.REQUIRED
      ) {
        if (quotation.motorInspection?.status !== InspectionStatus.COMPLETED) {
          throw new BadRequestException(
            'Cannot transition to PAYMENT_PENDING: Pre-issuance vehicle inspection must be COMPLETED before proceeding to payment',
          );
        }
      }
    }

    // Guard on PAYMENT_DONE
    if (target === MotorWorkflowState.PAYMENT_DONE) {
      if (quotation.motorPaymentRecord?.status !== 'PAID') {
        throw new BadRequestException(
          'Cannot transition to PAYMENT_DONE: Payment record must be verified as PAID by Finance',
        );
      }
    }

    // Guard on POLICY_ISSUED
    if (target === MotorWorkflowState.POLICY_ISSUED) {
      if (quotation.motorPaymentRecord?.status !== 'PAID') {
        throw new ConflictException(
          'Cannot transition to POLICY_ISSUED: Verified payment is required prior to policy issuance',
        );
      }
    }
  }

  /**
   * Authoritative method to transition workflowState of a Quotation.
   * Single write authority over quotation.workflowState.
   */
  async transitionWorkflowState(
    quotationId: string,
    targetState: MotorWorkflowState,
    actor: { userId: string; companyId: string; role: string },
    options?: { reason?: string; tx?: Prisma.TransactionClient },
  ) {
    const run = async (tx: Prisma.TransactionClient) => {
      const quotation = await tx.quotation.findFirst({
        where: { id: quotationId, companyId: actor.companyId },
        include: {
          vehicle: true,
          motorInspection: true,
          motorPreviousPolicy: true,
          motorPaymentRecord: true,
        },
      });

      if (!quotation) {
        throw new NotFoundException(
          `Quotation '${quotationId}' not found or access denied`,
        );
      }

      const currentState = quotation.workflowState || MotorWorkflowState.DRAFT;
      this.validateTransition(currentState, targetState, quotation);

      const updated = await tx.quotation.update({
        where: { id: quotationId },
        data: {
          workflowState: targetState,
          updatedById: actor.userId,
        },
      });

      await tx.quotationHistory.create({
        data: {
          quotationId,
          status: targetState,
          comments:
            options?.reason ||
            `Workflow transition from ${currentState} to ${targetState} by ${actor.role}`,
          createdById: actor.userId,
        },
      });

      this.logger.log(
        `Quotation ${quotationId} transitioned from ${currentState} to ${targetState} by user ${actor.userId}`,
      );

      return updated;
    };

    if (options?.tx) {
      return run(options.tx);
    }
    return this.prisma.$transaction(run);
  }
}
