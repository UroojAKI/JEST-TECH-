import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import { ClaimStatus, Prisma } from '@prisma/client';
import { ClaimStateMachine } from '../../domain/claim-state-machine';

export interface ApproveClaimDto {
  approvedAmount: number;
  comments: string;
}

@Injectable()
export class ApproveClaimService {
  constructor(private readonly prisma: PrismaService) {}

  async execute(claimId: string, dto: ApproveClaimDto, actorId: string) {
    const claim = await this.prisma.claim.findUnique({
      where: { id: claimId },
      include: { policy: { include: { quotation: true } } },
    });

    if (!claim) {
      throw new NotFoundException(`Claim with ID ${claimId} not found`);
    }

    // Segregation of duties: The person who reported the claim cannot approve it
    if (claim.createdById === actorId) {
      throw new ForbiddenException(
        'Segregation of duties violation: The user who reported the claim cannot approve it. An independent claims officer must assess and approve.',
      );
    }

    if (!dto.approvedAmount || dto.approvedAmount <= 0) {
      throw new BadRequestException(
        'Approved claim amount must be greater than zero',
      );
    }

    const maxCover = Number(claim.policy?.quotation?.sumInsured || 0);
    if (maxCover > 0 && dto.approvedAmount > maxCover) {
      throw new BadRequestException(
        `Approved amount ₹${dto.approvedAmount.toLocaleString('en-IN')} exceeds policy sum insured ₹${maxCover.toLocaleString('en-IN')}`,
      );
    }

    // Validate state transition
    ClaimStateMachine.validateTransition(claim.status, ClaimStatus.APPROVED);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.claim.update({
        where: { id: claimId },
        data: {
          status: ClaimStatus.APPROVED,
          approvedAmount: new Prisma.Decimal(dto.approvedAmount),
          updatedById: actorId,
        },
      });

      await tx.claimHistory.create({
        data: {
          claimId,
          status: ClaimStatus.APPROVED,
          action: 'APPROVE',
          comments:
            dto.comments ||
            `Claim approved for payout amount of ₹${dto.approvedAmount.toLocaleString('en-IN')}`,
          createdById: actorId,
        },
      });

      return updated;
    });
  }
}
