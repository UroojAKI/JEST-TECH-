import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import { ClaimStatus, Prisma, RoleType } from '@prisma/client';
import { ClaimStateMachine } from '../../domain/claim-state-machine';
import { RequestUser } from '../../../auth/decorators/current-user.decorator';
import { ActorContext } from '../../../../common/interfaces/actor-context.interface';

export interface ApproveClaimDto {
  approvedAmount: number;
  comments: string;
}

@Injectable()
export class ApproveClaimService {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    claimId: string,
    dto: ApproveClaimDto,
    actor: RequestUser | ActorContext | string,
  ) {
    const actorId =
      typeof actor === 'string'
        ? actor
        : (actor as any).id || (actor as any).userId;
    const actorContext: (ActorContext | RequestUser) | null =
      typeof actor === 'string' ? null : actor;

    const claim = await this.prisma.claim.findUnique({
      where: { id: claimId },
      include: {
        policy: {
          include: {
            quotation: {
              include: {
                createdBy: {
                  include: {
                    branch: {
                      include: {
                        zone: {
                          include: {
                            region: {
                              include: { company: true },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            contact: true,
            createdBy: {
              include: {
                branch: {
                  include: {
                    zone: {
                      include: {
                        region: {
                          include: { company: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!claim) {
      throw new NotFoundException(`Claim with ID ${claimId} not found`);
    }

    // Role verification and organizational boundary enforcement
    if (actorContext) {
      const isAdmin =
        actorContext.role === RoleType.ADMIN ||
        (actorContext as any).roles?.includes(RoleType.ADMIN);

      if (!isAdmin) {
        const allowedRoles: RoleType[] = [
          RoleType.ADMIN,
          RoleType.BACK_OFFICE,
        ];
        const hasApprovalRole =
          allowedRoles.includes(actorContext.role) ||
          (actorContext as any).roles?.some((r: RoleType) =>
            allowedRoles.includes(r),
          );

        if (!hasApprovalRole) {
          throw new ForbiddenException(
            'Actor does not possess claim approval authority. Required roles: ADMIN or BACK_OFFICE.',
          );
        }

        const policyOrgId =
          claim.policy?.contact?.companyId ||
          claim.policy?.createdBy?.companyId ||
          claim.policy?.createdBy?.branch?.zone?.region?.company?.id ||
          claim.policy?.quotation?.createdBy?.branch?.zone?.region?.company?.id;

        const actorCompanyId = actorContext.companyId || actorContext.organizationId;
        if (
          policyOrgId &&
          actorCompanyId &&
          policyOrgId !== actorCompanyId
        ) {
          throw new ForbiddenException(
            'Access denied: Cannot approve claim belonging to a different organization',
          );
        }
      }
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
