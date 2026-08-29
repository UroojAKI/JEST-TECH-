import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import { ClaimStatus } from '@prisma/client';
import { ClaimStateMachine } from '../../domain/claim-state-machine';

export interface RejectClaimDto {
  reason: string;
  comments?: string;
}

@Injectable()
export class RejectClaimService {
  constructor(private readonly prisma: PrismaService) {}

  async execute(claimId: string, dto: RejectClaimDto, actorId: string) {
    const claim = await this.prisma.claim.findUnique({
      where: { id: claimId },
    });

    if (!claim) {
      throw new NotFoundException(`Claim with ID ${claimId} not found`);
    }

    if (!dto.reason || !dto.reason.trim()) {
      throw new BadRequestException(
        'A non-empty rejection reason is mandatory when rejecting a claim',
      );
    }

    // Segregation of duties: The person who reported the claim cannot reject it
    if (claim.createdById === actorId) {
      throw new ForbiddenException(
        'Segregation of duties violation: The user who reported the claim cannot reject it.',
      );
    }

    // Validate state transition
    ClaimStateMachine.validateTransition(claim.status, ClaimStatus.REJECTED);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.claim.update({
        where: { id: claimId },
        data: {
          status: ClaimStatus.REJECTED,
          updatedById: actorId,
        },
      });

      await tx.claimHistory.create({
        data: {
          claimId,
          status: ClaimStatus.REJECTED,
          action: 'REJECT',
          comments: `Claim rejected. Reason: ${dto.reason}${dto.comments ? ` | Details: ${dto.comments}` : ''}`,
          createdById: actorId,
        },
      });

      return updated;
    });
  }
}
