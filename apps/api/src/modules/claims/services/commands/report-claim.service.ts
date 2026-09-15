import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ClaimStatus,
  CommunicationChannel,
  PolicyStatus,
  Prisma,
  RoleType,
} from '@prisma/client';
import { ClaimRepository } from '../../repositories/claim.repository';
import { PolicyRepository } from '../../../policies/repositories/policy.repository';
import { ReportClaimDto } from '../../dto/report-claim.dto';
import { ClaimMapper } from '../../mappers/claim.mapper';
import { PrismaService } from '../../../../database/prisma.service';
import { CACHE_PROVIDER_TOKEN } from '../../../platform/cache/cache.provider';
import { RedisCacheService } from '../../../platform/cache/redis-cache.service';
import { Inject } from '@nestjs/common';
import { ActorContext } from '../../../../common/interfaces/actor-context.interface';
import { RequestUser } from '../../../auth/decorators/current-user.decorator';

@Injectable()
export class ReportClaimService {
  constructor(
    private readonly claimRepository: ClaimRepository,
    private readonly policyRepository: PolicyRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly prisma: PrismaService,
    @Inject(CACHE_PROVIDER_TOKEN) private readonly cache: RedisCacheService,
  ) {}

  async execute(
    dto: ReportClaimDto,
    actor: RequestUser | ActorContext | string,
  ) {
    const createdById =
      typeof actor === 'string'
        ? actor
        : (actor as any).id || (actor as any).userId;
    const actorContext = typeof actor === 'object' ? actor : undefined;

    // 1. Validate Policy exists (lookup by policyId or policyNumber)
    let policy: any = null;
    const policyInclude = {
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
    };

    if (dto.policyId) {
      if (this.prisma?.policy?.findFirst) {
        policy = await this.prisma.policy.findFirst({
          where: { id: dto.policyId, deletedAt: null },
          include: policyInclude,
        });
      }
      if (!policy && this.policyRepository?.findById) {
        policy = await this.policyRepository.findById(dto.policyId);
      }
    } else if (dto.policyNumber) {
      if (this.prisma?.policy?.findFirst) {
        policy = await this.prisma.policy.findFirst({
          where: { policyNumber: dto.policyNumber, deletedAt: null },
          include: policyInclude,
        });
      }
    }

    if (!policy || policy.deletedAt) {
      throw new NotFoundException(
        `Policy ${dto.policyId || dto.policyNumber || ''} not found`,
      );
    }

    // 1.1 Multi-Tenant & Object-Level Access Validation (IDOR prevention)
    if (actorContext) {
      const isAdmin =
        actorContext.roles?.includes(RoleType.ADMIN) ||
        actorContext.role === RoleType.ADMIN;

      if (!isAdmin) {
        const policyOrgId =
          policy.contact?.companyId ||
          policy.createdBy?.companyId ||
          policy.createdBy?.branch?.zone?.region?.company?.id ||
          policy.quotation?.createdBy?.branch?.zone?.region?.company?.id;

        const actorCompanyId = actorContext.companyId || actorContext.organizationId;
        if (
          policyOrgId &&
          actorCompanyId &&
          policyOrgId !== actorCompanyId
        ) {
          throw new ForbiddenException(
            'You do not have permission to file claims for a policy in another organization',
          );
        }

        const isAgent =
          actorContext.role === RoleType.AGENT ||
          actorContext.roles?.includes(RoleType.AGENT);

        if (isAgent) {
          const userCtx = actorContext as any;
          const isOwner =
            policy.agentId === userCtx.userId ||
            policy.agentId === userCtx.id ||
            policy.createdById === userCtx.userId ||
            policy.createdById === userCtx.id ||
            (userCtx.email && policy.contact?.email === userCtx.email) ||
            (userCtx.phone && policy.contact?.phone === userCtx.phone);
          if (!isOwner) {
            throw new ForbiddenException(
              'Agents are only permitted to file claims on their own assigned policies',
            );
          }
        }
      }
    }

    const resolvedPolicyId = policy.id;
    const resolvedClaimAmount = dto.claimAmount ?? dto.estimatedAmount;
    if (!resolvedClaimAmount || resolvedClaimAmount <= 0) {
      throw new BadRequestException(
        'A positive claim loss amount is required.',
      );
    }

    // 2. Policy Status Gate: Only ACTIVE or PENDING_RENEWAL policies can have claims registered
    if (
      policy.status !== PolicyStatus.ACTIVE &&
      policy.status !== PolicyStatus.PENDING_RENEWAL
    ) {
      throw new BadRequestException(
        `Claims cannot be filed against policy ${policy.policyNumber} with status ${policy.status}`,
      );
    }

    // 3. Coverage Period Invariant: incidentDate must fall strictly between effectiveDate and expiryDate
    const incidentDate = dto.incidentDate
      ? new Date(dto.incidentDate)
      : new Date();
    if (
      incidentDate < policy.effectiveDate ||
      incidentDate > policy.expiryDate
    ) {
      throw new BadRequestException(
        `Claim incident date ${incidentDate.toISOString()} falls outside policy coverage dates (${policy.effectiveDate.toISOString()} to ${policy.expiryDate.toISOString()})`,
      );
    }

    // 4. Duplicate Active Claim Invariant
    const existingClaim = await this.prisma.claim.findFirst({
      where: {
        policyId: resolvedPolicyId,
        incidentDate,
        status: { not: ClaimStatus.CLOSED },
        deletedAt: null,
      },
    });

    if (existingClaim) {
      throw new BadRequestException(
        `A claim has already been registered for policy ${policy.policyNumber} on the incident date ${incidentDate.toISOString()}`,
      );
    }

    // 5. Generate Claim Number
    const claimNumber = await this.claimRepository.generateClaimNumber();

    // 6. Map create payload
    const claimData: Prisma.ClaimCreateInput = {
      claimNumber,
      status: ClaimStatus.REPORTED,
      policy: { connect: { id: resolvedPolicyId } },
      contact: { connect: { id: policy.contactId } },
      incidentDate,
      description: dto.description,
      claimAmount: new Prisma.Decimal(resolvedClaimAmount),
      createdBy: { connect: { id: createdById } },
      updatedBy: { connect: { id: createdById } },
    };

    if (policy.accountId) {
      claimData.account = { connect: { id: policy.accountId } };
    }

    // 7. Save to database in a single atomic transaction
    const claim = await this.prisma.$transaction(async (tx) => {
      // 7.1 Create the Claim
      const createdClaim = await this.claimRepository.create(claimData, tx);

      // 7.2 Add history entry for registration
      await this.claimRepository.addHistoryEntry(
        createdClaim.id,
        ClaimStatus.REGISTERED,
        'REGISTER_CLAIM',
        `Claim ${claimNumber} reported and registered. Incident date: ${incidentDate.toISOString()}`,
        createdById,
        tx,
      );

      // 7.3 Update Status to REGISTERED
      const updatedClaim = await this.claimRepository.update(
        createdClaim.id,
        {
          status: ClaimStatus.REGISTERED,
        },
        tx,
      );

      // 7.4 Log Customer Communication (Authoritative without fake production data)
      const contact = await tx.contact.findUnique({
        where: { id: policy.contactId },
      });

      if (
        contact?.email &&
        contact.email.trim() &&
        !contact.email.toLowerCase().includes('example.com')
      ) {
        await this.claimRepository.addCommunication(
          {
            claim: { connect: { id: createdClaim.id } },
            recipient: contact.email.trim(),
            channel: CommunicationChannel.EMAIL,
            subject: `Claim Registered - ${claimNumber}`,
            body: `Hello, your claim ${claimNumber} for policy ${policy.policyNumber} has been successfully registered. We are reviewing the details and will assign an assessor shortly.`,
          },
          tx,
        );
      } else if (contact?.phone && contact.phone.trim()) {
        await this.claimRepository.addCommunication(
          {
            claim: { connect: { id: createdClaim.id } },
            recipient: contact.phone.trim(),
            channel: CommunicationChannel.SMS,
            subject: `Claim Registered - ${claimNumber}`,
            body: `Hello, your claim ${claimNumber} for policy ${policy.policyNumber} has been successfully registered. We are reviewing the details and will assign an assessor shortly.`,
          },
          tx,
        );
      }

      return updatedClaim;
    });

    // 8. Emit Event after transaction commits
    await this.eventEmitter.emitAsync('claim.registered', {
      claim,
      createdById,
    });

    return ClaimMapper.toResponse(claim);
  }
}
