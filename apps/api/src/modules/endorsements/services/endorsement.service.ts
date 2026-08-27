import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { EndorsementType, EndorsementStatus, Prisma } from '@prisma/client';
import { PaginationDto } from '../../../common/pagination/pagination.dto';
import { PaginatedResponseDto } from '../../../common/pagination/paginated-response.dto';

@Injectable()
export class EndorsementService {
  constructor(private readonly prisma: PrismaService) {}

  private generateEndNumber(): string {
    return `END-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }

  /**
   * Computes Pro-Rata Premium Differential based on remaining policy coverage days.
   * GST @ 18% is applied strictly to taxable differential.
   */
  async calculateProRataPremium(policyId: string, newAnnualPremium: number) {
    const policy = await this.prisma.policy.findUnique({
      where: { id: policyId },
    });

    if (!policy) {
      throw new NotFoundException(`Policy with ID ${policyId} not found`);
    }

    const now = new Date();
    const expiryTime = new Date(policy.expiryDate).getTime();
    const effectiveTime = new Date(policy.effectiveDate).getTime();
    const currentTime = now.getTime();

    const remainingMs = Math.max(0, expiryTime - currentTime);
    const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));

    const totalTenureMs = Math.max(1, expiryTime - effectiveTime);
    const totalDays = Math.ceil(totalTenureMs / (1000 * 60 * 60 * 24));

    const proRataFactor = Math.min(1, Math.max(0, remainingDays / totalDays));
    const currentBase = Number(policy.premiumAmount || 0);
    const annualDiff = newAnnualPremium - currentBase;

    const proRataNetDifferential = Math.round(annualDiff * proRataFactor * 100) / 100;
    const gstAmount = Math.round(proRataNetDifferential * 0.18 * 100) / 100;
    const totalPayable = Math.round((proRataNetDifferential + gstAmount) * 100) / 100;

    return {
      policyId,
      currentAnnualPremium: currentBase,
      newAnnualPremium,
      annualDifferential: annualDiff,
      remainingDays,
      totalDays,
      proRataFactor: Number(proRataFactor.toFixed(4)),
      proRataNetDifferential,
      gstAmount,
      totalPayable,
    };
  }

  // ---------------------------------------------------------------------------
  // Type-specific validator dispatcher
  // ---------------------------------------------------------------------------
  private async dispatchEndorsementValidator(
    type: EndorsementType,
    requestedChanges: Record<string, any>,
    policy: any,
    tx: any,
  ): Promise<{
    validatedChanges: Record<string, any>;
    beforeSnapshot: Record<string, any>;
    updateFn: () => Promise<void>;
  }> {
    switch (type) {
      case EndorsementType.CONTACT_CHANGE: {
        const allowed = ['firstName', 'lastName', 'email', 'phone'];
        const contact = await tx.contact.findUnique({
          where: { id: policy.contactId },
        });
        const before = Object.fromEntries(
          allowed.map((k) => [k, contact?.[k]]),
        );
        const validated = Object.fromEntries(
          allowed
            .filter((k) => requestedChanges[k] !== undefined)
            .map((k) => [k, requestedChanges[k]]),
        );
        return {
          validatedChanges: validated,
          beforeSnapshot: before,
          updateFn: async () => {
            if (Object.keys(validated).length > 0) {
              await tx.contact.update({
                where: { id: policy.contactId },
                data: validated,
              });
            }
          },
        };
      }

      case EndorsementType.ADDRESS_CHANGE: {
        const allowed = ['address', 'city', 'state', 'pincode'];
        const contact = await tx.contact.findUnique({
          where: { id: policy.contactId },
        });
        const before = Object.fromEntries(
          allowed.map((k) => [k, contact?.[k]]),
        );
        const validated = Object.fromEntries(
          allowed
            .filter((k) => requestedChanges[k] !== undefined)
            .map((k) => [k, requestedChanges[k]]),
        );
        return {
          validatedChanges: validated,
          beforeSnapshot: before,
          updateFn: async () => {
            if (Object.keys(validated).length > 0) {
              await tx.contact.update({
                where: { id: policy.contactId },
                data: validated,
              });
            }
          },
        };
      }

      case EndorsementType.VEHICLE_CHANGE: {
        const allowed = ['registrationNumber', 'engineNumber', 'chassisNumber'];
        const vehicle = policy.vehicleId
          ? await tx.vehicle.findUnique({ where: { id: policy.vehicleId } })
          : null;
        const before = vehicle
          ? Object.fromEntries(allowed.map((k) => [k, vehicle[k]]))
          : {};
        const validated = Object.fromEntries(
          allowed
            .filter((k) => requestedChanges[k] !== undefined)
            .map((k) => [k, requestedChanges[k]]),
        );
        return {
          validatedChanges: validated,
          beforeSnapshot: before,
          updateFn: async () => {
            if (policy.vehicleId && Object.keys(validated).length > 0) {
              await tx.vehicle.update({
                where: { id: policy.vehicleId },
                data: validated,
              });
            }
          },
        };
      }

      case EndorsementType.OWNER_TRANSFER: {
        // IRDAI Rule: Transfer of ownership resets NCB to 0% unless NCB retention certificate is attached
        const hasNcbRetentionCert = !!requestedChanges.ncbRetentionCertificate;
        const newNcb = hasNcbRetentionCert
          ? requestedChanges.retainedNcb || 0
          : 0;

        const before = {
          contactId: policy.contactId,
          motorMetadata: policy.motorMetadata,
        };

        const validated = {
          newContactId: requestedChanges.newContactId,
          transferDate: requestedChanges.transferDate || new Date().toISOString(),
          ncbPercentage: newNcb,
          ncbResetApplied: !hasNcbRetentionCert,
          unearnedNcbRecoveryRequired: !hasNcbRetentionCert,
        };

        return {
          validatedChanges: validated,
          beforeSnapshot: before,
          updateFn: async () => {
            const updatePayload: any = {};
            if (validated.newContactId) {
              updatePayload.contactId = validated.newContactId;
            }
            if (policy.motorMetadata) {
              const currentMeta =
                typeof policy.motorMetadata === 'string'
                  ? JSON.parse(policy.motorMetadata)
                  : policy.motorMetadata;
              updatePayload.motorMetadata = {
                ...currentMeta,
                ncbPercentage: newNcb,
                ownershipTransferredAt: validated.transferDate,
              };
            }
            await tx.policy.update({
              where: { id: policy.id },
              data: updatePayload,
            });
          },
        };
      }

      case EndorsementType.NOMINEE_CHANGE: {
        const allowed = ['firstName', 'lastName', 'relation', 'percentage'];
        const validated = Object.fromEntries(
          allowed
            .filter((k) => requestedChanges[k] !== undefined)
            .map((k) => [k, requestedChanges[k]]),
        );
        return {
          validatedChanges: validated,
          beforeSnapshot: {},
          updateFn: async () => {
            /* Nominee update recorded in history */
          },
        };
      }

      default: {
        // For IDV_CHANGE, COVERAGE_CHANGE, PREMIUM_CHANGE
        return {
          validatedChanges: requestedChanges,
          beforeSnapshot: { premiumAmount: policy.premiumAmount },
          updateFn: async () => {
            if (requestedChanges.newAnnualPremium) {
              await tx.policy.update({
                where: { id: policy.id },
                data: {
                  premiumAmount: new Prisma.Decimal(
                    requestedChanges.newAnnualPremium,
                  ),
                },
              });
            }
          },
        };
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Standard CRUD / list methods
  // ---------------------------------------------------------------------------

  async getEndorsements(pagination: PaginationDto) {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = pagination;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.endorsement.findMany({
        skip,
        take: limit,
        include: {
          policy: true,
          requestedBy: { select: { firstName: true, lastName: true } },
        },
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.endorsement.count(),
    ]);

    return new PaginatedResponseDto(data, total, page, limit);
  }

  async getEndorsementDetails(id: string) {
    const end = await this.prisma.endorsement.findUnique({
      where: { id },
      include: {
        policy: true,
        documents: { include: { document: true } },
        histories: {
          include: {
            performedBy: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });
    if (!end) {
      throw new NotFoundException('Endorsement not found');
    }
    return end;
  }

  async createEndorsement(
    policyId: string,
    type: EndorsementType,
    reason: string,
    userId: string,
    requestedChanges?: Record<string, any>,
  ) {
    const policy = await this.prisma.policy.findUnique({
      where: { id: policyId },
    });

    if (!policy) {
      throw new NotFoundException('Policy not found');
    }

    const endorsementNumber = this.generateEndNumber();

    return this.prisma.$transaction(async (tx) => {
      const end = await tx.endorsement.create({
        data: {
          endorsementNumber,
          policyId,
          type,
          status: EndorsementStatus.REQUESTED,
          requestedById: userId,
          reason,
          requestedChanges: requestedChanges || Prisma.DbNull,
        },
      });

      await tx.endorsementHistory.create({
        data: {
          endorsementId: end.id,
          status: EndorsementStatus.REQUESTED,
          comments: `Endorsement requested: ${type}`,
          performedById: userId,
        },
      });

      return end;
    });
  }

  async attachDocument(endorsementId: string, documentId: string) {
    return this.prisma.endorsementDocument.create({
      data: {
        endorsementId,
        documentId,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Approve endorsement (with transactional AuditLog + Four-Eye Principle)
  // ---------------------------------------------------------------------------

  async approveEndorsement(id: string, comments: string, reviewerId: string) {
    const end = await this.prisma.endorsement.findUnique({
      where: { id },
      include: { policy: true },
    });

    if (!end) throw new NotFoundException('Endorsement not found');

    // Four-Eye Principle: Requester cannot approve their own endorsement
    if (end.requestedById === reviewerId) {
      throw new ForbiddenException(
        'Four-Eye Violation: Endorsement requester cannot approve their own alteration request',
      );
    }

    if (
      end.status !== EndorsementStatus.REQUESTED &&
      end.status !== EndorsementStatus.UNDER_REVIEW
    ) {
      throw new BadRequestException(
        `Cannot approve endorsement with status ${end.status}`,
      );
    }

    let requestedChanges: Record<string, any> = {};
    if (end.requestedChanges) {
      requestedChanges =
        typeof end.requestedChanges === 'string'
          ? JSON.parse(end.requestedChanges as string)
          : (end.requestedChanges as Record<string, any>);
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Type-specific validation + mutation
      const { validatedChanges, beforeSnapshot, updateFn } =
        await this.dispatchEndorsementValidator(
          end.type,
          requestedChanges,
          end.policy,
          tx,
        );

      await updateFn();

      // 2. Update endorsement status to APPROVED
      await tx.endorsement.update({
        where: { id },
        data: {
          status: EndorsementStatus.APPROVED,
          approvedById: reviewerId,
          validatedChanges: validatedChanges as any,
        },
      });

      // 3. Write structured AuditLog INSIDE the same transaction
      await tx.auditLog.create({
        data: {
          action: 'APPROVE',
          entity: 'ENDORSEMENT',
          entityId: id,
          oldValue: beforeSnapshot as any,
          newValue: validatedChanges as any,
          userId: reviewerId,
          module: `ENDORSEMENT:${end.type}`,
          correlationId: end.endorsementNumber,
        },
      });

      // 4. Endorsement history
      await tx.endorsementHistory.create({
        data: {
          endorsementId: id,
          status: EndorsementStatus.APPROVED,
          comments: comments || 'Endorsement approved and changes applied.',
          performedById: reviewerId,
        },
      });

      // 5. Policy history
      await tx.policyHistory.create({
        data: {
          policyId: end.policyId,
          status: 'ENDORSED',
          comments: `Endorsement ${end.endorsementNumber} (${end.type}) applied.`,
          createdById: reviewerId,
        },
      });

      // 6. Mark COMPLETED
      const updated = await tx.endorsement.update({
        where: { id },
        data: { status: EndorsementStatus.COMPLETED },
      });

      await tx.endorsementHistory.create({
        data: {
          endorsementId: id,
          status: EndorsementStatus.COMPLETED,
          comments: 'Endorsement completed. Changes applied to policy record.',
          performedById: reviewerId,
        },
      });

      return { endorsement: updated, validatedChanges, status: 'COMPLETED' };
    });
  }

  async rejectEndorsement(id: string, reason: string, reviewerId: string) {
    const end = await this.prisma.endorsement.findUnique({
      where: { id },
    });

    if (!end) throw new NotFoundException('Endorsement not found');

    if (end.requestedById === reviewerId) {
      throw new ForbiddenException(
        'Four-Eye Violation: Endorsement requester cannot reject their own alteration request',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.endorsement.update({
        where: { id },
        data: { status: EndorsementStatus.REJECTED },
      });

      await tx.endorsementHistory.create({
        data: {
          endorsementId: id,
          status: EndorsementStatus.REJECTED,
          comments: reason || 'Endorsement rejected by reviewer.',
          performedById: reviewerId,
        },
      });

      return updated;
    });
  }
}
