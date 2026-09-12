import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { AuditAction, RoleType } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { IssueMotorPolicyDto } from '../dto/issue-motor-policy.dto';
import { MotorPaymentTrackingService } from './motor-payment-tracking.service';
import { ActorContext } from '../../../common/interfaces/actor-context.interface';
import { ResourceAuthorizationService } from '../../../common/services/resource-authorization.service';

@Injectable()
export class MotorPolicyIssuanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentService: MotorPaymentTrackingService,
    private readonly authzService: ResourceAuthorizationService,
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

    const gate = await this.paymentService.canProceedToPolicy(quotationId);
    if (!gate.allowed) {
      throw new ConflictException({
        message: 'Policy issuance is blocked by the Motor workflow gate',
        blockers: gate.blockers,
      });
    }

    const actorId = actor.userId || (actor as any).id;

    return this.prisma.$transaction(async (tx) => {
      const quote = await tx.quotation.findUnique({
        where: { id: quotationId },
        include: { contact: true, lead: true, policy: true },
      });

      if (!quote)
        throw new NotFoundException(`Quotation ${quotationId} not found`);
      if (quote.policy)
        throw new ConflictException(
          'A policy already exists for this quotation',
        );
      if (quote.workflowState !== 'PAYMENT_DONE')
        throw new ConflictException('Quotation is not in PAYMENT_DONE state');
      if (!quote.calculationSnapshot)
        throw new ConflictException(
          'Authoritative calculation snapshot is required before issuance',
        );

      const policyNumber =
        dto.actualPolicyNumber?.trim() ||
        `POL-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
      const actualPremium =
        dto.actualPremium !== undefined && dto.actualPremium !== null
          ? dto.actualPremium
          : Number(quote.totalPremium);

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

      // Handle vehicle details & missing information
      let vehicleId = quote.vehicleId;
      if (vehicleId) {
        if (
          dto.chassisNumber ||
          dto.engineNumber ||
          dto.registrationNumber ||
          dto.makeModel ||
          dto.manufactureYearMonth
        ) {
          await tx.vehicle.update({
            where: { id: vehicleId },
            data: {
              chassisNumber: dto.chassisNumber || undefined,
              engineNumber: dto.engineNumber || undefined,
              registrationNumber: dto.registrationNumber || undefined,
              makeModel: dto.makeModel || undefined,
              manufactureYearMonth: dto.manufactureYearMonth || undefined,
            },
          });
        }
      } else if (
        dto.chassisNumber ||
        dto.engineNumber ||
        dto.registrationNumber
      ) {
        const vehicleCode = `VEH-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const createdVehicle = await tx.vehicle.create({
          data: {
            vehicleCode,
            category: (quote.vehicleCategory as any) || 'PRIVATE_CAR',
            registrationNumber:
              dto.registrationNumber || quote.registrationNumber,
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
            registrationNumber:
              dto.registrationNumber || quote.registrationNumber,
          },
        });
      }

      // EPIC-22: Idempotency Check — if a policy with this policyNumber was already issued,
      // return it idempotently without re-executing mutations.
      const existingPolicyByNumber = await tx.policy.findFirst({
        where: { policyNumber },
      });
      if (existingPolicyByNumber) {
        return existingPolicyByNumber;
      }

      const policy = await tx.policy.create({
        data: {
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

      // Schedule renewal reminder 30 days BEFORE expiry (not on expiry day)
      const renewalDueDate = new Date(effectiveExpiry);
      renewalDueDate.setDate(renewalDueDate.getDate() - 30);

      await tx.renewalTask.create({
        data: {
          policyId: policy.id,
          agentId: quote.lead?.assignedToId || actorId,
          dueDate: renewalDueDate,
          status: 'PENDING',
          priority: 'HIGH',
        },
      });

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

      // EPIC-22: Transactional Outbox event for downstream integrations
      await tx.outboxEvent.create({
        data: {
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
      });

      return policy;
    });
  }
}
