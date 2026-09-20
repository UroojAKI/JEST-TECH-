import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { AuditAction, RoleType, Prisma, InspectionStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { IssueMotorPolicyDto } from '../dto/issue-motor-policy.dto';
import { MotorPaymentTrackingService } from './motor-payment-tracking.service';
import { ActorContext } from '../../../common/interfaces/actor-context.interface';
import { ResourceAuthorizationService } from '../../../common/services/resource-authorization.service';
import { NumberingEngineService } from '../../administration/services/numbering-engine/numbering-engine.service';

@Injectable()
export class MotorPolicyIssuanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentService: MotorPaymentTrackingService,
    private readonly authzService: ResourceAuthorizationService,
    private readonly numberingEngine: NumberingEngineService,
  ) {}

  async issuePolicy(
    quotationId: string,
    dto: IssueMotorPolicyDto,
    actor: ActorContext,
  ) {
    // 1. Authoritative Resource Authorization Check
    this.authzService.authorize(actor, 'POLICY', 'ISSUE');

    const startDate = dto.startDate ? new Date(dto.startDate) : new Date();
    const defaultEnd = new Date(startDate);
    defaultEnd.setFullYear(defaultEnd.getFullYear() + 1);
    const endDate = dto.endDate ? new Date(dto.endDate) : defaultEnd;
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new BadRequestException(
        'Valid policy start and end dates are required',
      );
    }
    if (endDate < startDate) {
      throw new BadRequestException(
        'Policy end date cannot be before policy start date',
      );
    }

    const actorId = actor.userId || (actor as any).id;

    return this.prisma.$transaction(async (tx) => {
      const quote = await tx.quotation.findUnique({
        where: { id: quotationId },
        include: {
          contact: true,
          lead: true,
          policy: true,
          motorInspection: true,
        },
      });

      if (!quote) {
        throw new NotFoundException(`Quotation ${quotationId} not found`);
      }
      if (quote.policy) {
        throw new ConflictException(
          `Policy already issued for quotation ${quotationId} (Policy Number: ${quote.policy.policyNumber}). Duplicate issuance is blocked.`,
        );
      }
      if (quote.workflowState !== 'PAYMENT_DONE') {
        throw new ConflictException(
          `Quotation is not in PAYMENT_DONE state (Current: ${quote.workflowState})`,
        );
      }
      if (!quote.calculationSnapshot) {
        throw new ConflictException(
          'Authoritative calculation snapshot is required before issuance',
        );
      }

      // ─── Inside-Transaction Gating Checks ──────────────────────────────────
      // 1. Canonical Payment Gate: Re-verify payment record inside transaction
      const paymentRecord = await tx.motorPaymentRecord.findUnique({
        where: { quotationId },
      });
      if (!paymentRecord || paymentRecord.status !== 'PAID') {
        throw new ConflictException(
          'Policy issuance blocked: Authoritative payment must be verified as PAID before issuance',
        );
      }
      const paidAmount = new Prisma.Decimal(paymentRecord.amount || 0);
      const payableAmount = new Prisma.Decimal(quote.totalPremium);
      if (paidAmount.lt(payableAmount)) {
        throw new ConflictException(
          `Policy issuance blocked: Reconciled payment amount (${paidAmount}) is less than authoritative payable premium (${payableAmount})`,
        );
      }

      // 2. Inspection Gate: If quotation required inspection, verify COMPLETED or WAIVED
      const metadata = (quote.motorMetadata as Record<string, any>) || {};
      if (
        metadata.inspectionRequired ||
        quote.motorInspection
      ) {
        const inspectionStatus = quote.motorInspection?.status;
        if (
          inspectionStatus !== InspectionStatus.COMPLETED &&
          inspectionStatus !== InspectionStatus.WAIVED
        ) {
          throw new ConflictException(
            `Policy issuance blocked: Mandatory vehicle inspection is in '${inspectionStatus || 'PENDING'}' status. Inspection must be COMPLETED or WAIVED before policy can be issued.`,
          );
        }
      }

      // ─── Numbering & Authoritative Premium ─────────────────────────────────
      const policyNumber =
        dto.actualPolicyNumber?.trim() ||
        (await this.numberingEngine.generateNext('POLICY', tx));

      // Authoritative financial value from server calculation — client overrides strictly ignored
      const actualPremium = quote.totalPremium;

      const snapshot = (quote.calculationSnapshot as Record<string, any>) || {};
      const inputs = snapshot.inputs || {};
      const policyType = quote.policyType || inputs.policyType;
      const tenure = Number(inputs.tpTenure || quote.policyTenure || 1);

      const odStart = dto.odStartDate ? new Date(dto.odStartDate) : startDate;
      const tpStart = dto.tpStartDate ? new Date(dto.tpStartDate) : startDate;
      let odExpiry = dto.odExpiryDate ? new Date(dto.odExpiryDate) : null;
      let tpExpiry = dto.tpExpiryDate ? new Date(dto.tpExpiryDate) : null;

      if (policyType === 'THIRD_PARTY_ONLY') {
        tpExpiry = tpExpiry || endDate;
      } else if (policyType === 'STANDALONE_OD' || policyType === 'SAOD') {
        odExpiry = odExpiry || endDate;
      } else {
        odExpiry = odExpiry || endDate;
        if (!tpExpiry) {
          tpExpiry = new Date(tpStart);
          tpExpiry.setFullYear(tpExpiry.getFullYear() + tenure);
        }
      }

      const effectiveExpiry =
        [odExpiry, tpExpiry, endDate]
          .filter((date): date is Date => Boolean(date))
          .sort((a, b) => a.getTime() - b.getTime())[0] || endDate;

      const normalizedReg = dto.registrationNumber
        ? dto.registrationNumber.toUpperCase().replace(/[\s\-\.]/g, '')
        : quote.registrationNumber
          ? quote.registrationNumber.toUpperCase().replace(/[\s\-\.]/g, '')
          : undefined;

      // Handle vehicle details & vehicle code generation
      let vehicleId = quote.vehicleId;
      if (vehicleId) {
        if (
          dto.chassisNumber ||
          dto.engineNumber ||
          normalizedReg ||
          dto.makeModel ||
          dto.manufactureYearMonth
        ) {
          await tx.vehicle.update({
            where: { id: vehicleId },
            data: {
              chassisNumber: dto.chassisNumber || undefined,
              engineNumber: dto.engineNumber || undefined,
              registrationNumber: normalizedReg || undefined,
              makeModel: dto.makeModel || undefined,
              manufactureYearMonth: dto.manufactureYearMonth || undefined,
            },
          });
        }
      } else if (
        dto.chassisNumber ||
        dto.engineNumber ||
        normalizedReg
      ) {
        const vehicleCode = await this.numberingEngine.generateNext('VEHICLE', tx);
        const createdVehicle = await tx.vehicle.create({
          data: {
            vehicleCode,
            category: (quote.vehicleCategory as any) || 'PRIVATE_CAR',
            registrationNumber: normalizedReg,
            chassisNumber: dto.chassisNumber,
            engineNumber: dto.engineNumber,
            makeModel: dto.makeModel,
            manufactureYearMonth: dto.manufactureYearMonth,
            contactId: quote.contactId,
            createdById: actorId,
          },
        });
        vehicleId = createdVehicle.id;
        await tx.quotation.update({
          where: { id: quote.id },
          data: {
            vehicleId: createdVehicle.id,
            registrationNumber: normalizedReg,
          },
        });
      }

      // ─── Create Policy with Concurrency Handling (P2002 -> 409) ───────────
      let policy: any;
      try {
        policy = await tx.policy.create({
          data: {
            companyId: quote.companyId,
            policyNumber,
            actualPolicyNumber: policyNumber,
            quotationId: quote.id,
            contactId: quote.contactId,
            accountId: quote.accountId || undefined,
            status: 'ACTIVE',
            premiumAmount: quote.totalPremium,
            effectiveDate: startDate,
            expiryDate: effectiveExpiry,
            policyTenure: tenure,
            issueDate: new Date(),
            startDate,
            endDate,
            odStartDate: odStart,
            odExpiryDate: odExpiry,
            tpStartDate: tpStart,
            tpExpiryDate: tpExpiry,
            actualPremium,
            paymentStatus: 'SUCCESS',
            vehicleId: vehicleId || quote.vehicleId || undefined,
            vehicleCategory: quote.vehicleCategory || undefined,
            policyType: policyType || undefined,
            motorMetadata: quote.motorMetadata || undefined,
            activeTpInsurer: quote.activeTpInsurer || undefined,
            activeTpPolicyNumber: quote.activeTpPolicyNumber || undefined,
            activeTpExpiryDate: quote.activeTpExpiryDate || undefined,
            createdById: actorId,
            updatedById: actorId,
          },
        });
      } catch (err: any) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          throw new ConflictException(
            `Policy already issued for quotation ${quote.id} or policy number collision: ${policyNumber}`,
          );
        }
        throw err;
      }

      if (dto.nomineeName?.trim()) {
        const parts = dto.nomineeName.trim().split(' ');
        const firstName = parts[0] || 'Nominee';
        const lastName = parts.slice(1).join(' ') || 'Primary';
        await tx.policyNominee.create({
          data: {
            policyId: policy.id,
            firstName,
            lastName,
            relation: dto.nomineeRelation || 'Spouse',
            percentage: 100,
          },
        });
      }

      await tx.policyHistory.create({
        data: {
          policyId: policy.id,
          status: 'ACTIVE',
          comments: `Motor policy issued from quotation ${quote.quotationCode} by ${actor.role}.`,
          createdById: actorId,
        },
      });

      await tx.quotation.update({
        where: { id: quote.id },
        data: {
          issuanceStatus: 'ISSUED',
          status: 'CONVERTED_TO_POLICY',
          workflowState: 'ACTIVE',
          updatedById: actorId,
        },
      });

      await tx.quotationHistory.create({
        data: {
          quotationId: quote.id,
          status: 'CONVERTED_TO_POLICY',
          comments: `Motor policy ${policy.policyNumber} issued by ${actor.role}.`,
          createdById: actorId,
        },
      });

      if (quote.leadId) {
        const fromLead = quote.lead?.currentWorkflowStep || 'PAYMENT';
        await tx.lead.update({
          where: { id: quote.leadId },
          data: {
            status: 'POLICY_ISSUED',
            currentWorkflowStep: 'ISSUED',
            updatedById: actorId,
          },
        });
        await tx.leadStageHistory.create({
          data: {
            leadId: quote.leadId,
            fromStage: fromLead,
            toStage: 'ISSUED',
            performedById: actorId,
            performerRole: actor.role,
            isOverride: false,
            prerequisitesMet: { quotationId: quote.id, policyId: policy.id },
            remarks: `Lead completed automatically after Motor policy issuance ${policy.policyNumber}.`,
          },
        });
      }

      // ─── Durable Renewal Scheduling (Offsets: 45, 30, 15, 7, 0 days) ──────
      const renewalOffsets = [45, 30, 15, 7, 0];
      const renewalCycle = effectiveExpiry.getFullYear();

      for (const offset of renewalOffsets) {
        const scheduledFor = new Date(effectiveExpiry);
        scheduledFor.setDate(scheduledFor.getDate() - offset);

        await tx.renewalJob.upsert({
          where: {
            policyId_renewalCycle_offsetDays: {
              policyId: policy.id,
              renewalCycle,
              offsetDays: offset,
            },
          },
          create: {
            policyId: policy.id,
            renewalCycle,
            offsetDays: offset,
            scheduledFor,
            status: 'PENDING',
          },
          update: {
            scheduledFor,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          action: AuditAction.CREATE,
          entity: 'Policy',
          entityId: policy.id,
          entityType: 'MOTOR_POLICY_ISSUANCE',
          performedById: actorId,
          userId: actorId,
          module: 'MOTOR',
          metadata: {
            quotationId: quote.id,
            leadId: quote.leadId,
            policyNumber: policy.policyNumber,
          },
        },
      });

      // ─── Transactional Outbox event for downstream integrations ───────────
      await tx.outboxEvent.upsert({
        where: { eventKey: `policy.issued:${policy.id}` },
        create: {
          eventKey: `policy.issued:${policy.id}`,
          aggregateType: 'POLICY',
          aggregateId: policy.id,
          eventType: 'policy.issued',
          payload: {
            policyId: policy.id,
            policyNumber: policy.policyNumber,
            quotationId: quote.id,
            contactId: quote.contactId,
            premiumAmount: quote.totalPremium,
            issuedAt: new Date().toISOString(),
          },
          status: 'PENDING',
          attempts: 0,
          maxAttempts: 5,
        },
        update: {},
      });

      return policy;
    });
  }
}
