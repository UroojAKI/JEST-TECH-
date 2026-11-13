import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import { ClaimStatus, Prisma } from '@prisma/client';
import { ClaimStateMachine } from '../../domain/claim-state-machine';

export interface SettleClaimDto {
  settlementAmount: number;
  paymentReference: string;
  paymentMethod: string;
  bankName?: string;
  settledAt?: string;
  comments?: string;
}

@Injectable()
export class SettleClaimService {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    claimId: string,
    dto: SettleClaimDto,
    actorId: string,
    actorCompanyId?: string,
  ) {
    const claim = await this.prisma.claim.findUnique({
      where: { id: claimId },
    });

    if (!claim || (claim as any).deletedAt) {
      throw new NotFoundException(`Claim with ID ${claimId} not found`);
    }

    if (
      actorCompanyId &&
      claim.companyId &&
      claim.companyId !== actorCompanyId
    ) {
      throw new ForbiddenException(
        'Cross-organization access is strictly prohibited',
      );
    }

    if (claim.createdById === actorId) {
      throw new ForbiddenException(
        'Segregation of duties violation: The user who reported the claim cannot settle it. An independent finance officer must process settlement.',
      );
    }

    if (!dto.paymentReference?.trim()) {
      throw new BadRequestException(
        'A valid payment reference / UTR is mandatory to request settlement',
      );
    }

    if (!dto.settlementAmount || dto.settlementAmount <= 0) {
      throw new BadRequestException(
        'Settlement amount must be greater than zero',
      );
    }

    if (!claim.approvedAmount) {
      throw new BadRequestException(
        'Claim must have an approved amount before settlement can be requested',
      );
    }

    const settlementAmount = new Prisma.Decimal(dto.settlementAmount);
    if (settlementAmount.gt(claim.approvedAmount)) {
      throw new BadRequestException(
        'Settlement amount cannot exceed the approved claim amount',
      );
    }

    if (claim.status === ClaimStatus.PAYMENT_PENDING) {
      throw new ConflictException(
        'A settlement request is already pending for this claim. It cannot be overwritten.',
      );
    }

    // A payment reference supplied by the client is not proof of payment.
    // The first action creates a pending finance settlement; only the explicit
    // verification command below can move the claim to SETTLED.
    ClaimStateMachine.validateTransition(
      claim.status,
      ClaimStatus.PAYMENT_PENDING,
    );

    return this.prisma.$transaction(async (tx) => {
      // Compare-and-set prevents two concurrent requests from replacing the
      // same pending settlement amount. Only APPROVED claims can be advanced.
      const transition = await tx.claim.updateMany({
        where: {
          id: claimId,
          status: ClaimStatus.APPROVED,
          ...(actorCompanyId ? { companyId: actorCompanyId } : {}),
        },
        data: {
          status: ClaimStatus.PAYMENT_PENDING,
          updatedById: actorId,
        },
      });

      if (transition.count !== 1) {
        throw new ConflictException(
          'Claim settlement was already requested or the claim status changed. Refresh and retry.',
        );
      }

      const settlement = await tx.settlement.create({
        data: {
          batchNumber: `CLAIM-${claimId}`,
          totalAmount: settlementAmount,
          status: 'PENDING',
          ...(actorCompanyId ? { companyId: actorCompanyId } : {}),
        },
      });

      await tx.claimHistory.create({
        data: {
          claimId,
          status: ClaimStatus.PAYMENT_PENDING,
          action: 'SETTLEMENT_REQUESTED',
          comments:
            dto.comments ||
            `Settlement requested for ₹${dto.settlementAmount.toLocaleString('en-IN')} via ${dto.paymentMethod}${dto.bankName ? ` through ${dto.bankName}` : ''} (Ref: ${dto.paymentReference.trim()})${dto.settledAt ? `. Payment date: ${dto.settledAt}` : ''}. Finance verification is required before the claim can be marked SETTLED. Settlement batch: ${settlement.batchNumber}`,
          createdById: actorId,
        },
      });

      return { ...claim, status: ClaimStatus.PAYMENT_PENDING, updatedById: actorId };
    });
  }

  async verifySettlement(
    claimId: string,
    verificationReference: string,
    actorId: string,
    actorCompanyId?: string,
  ) {
    const claim = await this.prisma.claim.findUnique({
      where: { id: claimId },
    });

    if (!claim || (claim as any).deletedAt) {
      throw new NotFoundException(`Claim with ID ${claimId} not found`);
    }

    if (
      actorCompanyId &&
      claim.companyId &&
      claim.companyId !== actorCompanyId
    ) {
      throw new ForbiddenException(
        'Cross-organization access is strictly prohibited',
      );
    }

    if (claim.createdById === actorId) {
      throw new ForbiddenException(
        'Segregation of duties violation: the claim reporter cannot verify settlement',
      );
    }

    if (claim.status !== ClaimStatus.PAYMENT_PENDING) {
      throw new BadRequestException(
        'Claim does not have a pending settlement requiring finance verification',
      );
    }

    if (!verificationReference?.trim()) {
      throw new BadRequestException(
        'Finance verification reference is mandatory',
      );
    }

    const settlement = await this.prisma.settlement.findUnique({
      where: { batchNumber: `CLAIM-${claimId}` },
    });

    if (!settlement || settlement.status !== 'PENDING') {
      throw new BadRequestException(
        'No pending settlement exists for this claim',
      );
    }

    ClaimStateMachine.validateTransition(claim.status, ClaimStatus.SETTLED);

    return this.prisma.$transaction(async (tx) => {
      const settlementTransition = await tx.settlement.updateMany({
        where: { id: settlement.id, status: 'PENDING' },
        data: { status: 'PROCESSED' },
      });
      if (settlementTransition.count !== 1) {
        throw new ConflictException(
          'Settlement has already been verified or processed.',
        );
      }

      const claimTransition = await tx.claim.updateMany({
        where: {
          id: claimId,
          status: ClaimStatus.PAYMENT_PENDING,
          ...(actorCompanyId ? { companyId: actorCompanyId } : {}),
        },
        data: {
          status: ClaimStatus.SETTLED,
          updatedById: actorId,
        },
      });
      if (claimTransition.count !== 1) {
        throw new ConflictException(
          'Claim status changed before settlement verification completed.',
        );
      }

      await tx.claimHistory.create({
        data: {
          claimId,
          status: ClaimStatus.SETTLED,
          action: 'SETTLEMENT_VERIFIED',
          comments: `Finance settlement verification reference: ${verificationReference.trim()}`,
          createdById: actorId,
        },
      });

      return { ...claim, status: ClaimStatus.SETTLED, updatedById: actorId };
    });
  }
}
