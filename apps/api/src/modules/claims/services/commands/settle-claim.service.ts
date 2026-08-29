import {
  Injectable,
  NotFoundException,
  BadRequestException,
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

  async execute(claimId: string, dto: SettleClaimDto, actorId: string) {
    const claim = await this.prisma.claim.findUnique({
      where: { id: claimId },
    });

    if (!claim) {
      throw new NotFoundException(`Claim with ID ${claimId} not found`);
    }

    if (!dto.paymentReference || !dto.paymentReference.trim()) {
      throw new BadRequestException(
        'A valid payment reference / UTR is mandatory to settle a claim',
      );
    }

    if (!dto.settlementAmount || dto.settlementAmount <= 0) {
      throw new BadRequestException(
        'Settlement amount must be greater than zero',
      );
    }

    // Validate state transition
    ClaimStateMachine.validateTransition(claim.status, ClaimStatus.SETTLED);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.claim.update({
        where: { id: claimId },
        data: {
          status: ClaimStatus.SETTLED,
          approvedAmount: new Prisma.Decimal(dto.settlementAmount),
          updatedById: actorId,
        },
      });

      await tx.claimHistory.create({
        data: {
          claimId,
          status: ClaimStatus.SETTLED,
          action: 'SETTLE',
          comments:
            dto.comments ||
            `Claim settled for ₹${dto.settlementAmount.toLocaleString('en-IN')} via ${dto.paymentMethod} (Ref: ${dto.paymentReference})`,
          createdById: actorId,
        },
      });

      return updated;
    });
  }
}
