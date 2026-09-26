import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TenantResourceAuthorizationService } from '../../auth/services/tenant-resource-authorization.service';
import { RequestUser } from '../../auth/decorators/current-user.decorator';
import { CreateMotorJourneyDto } from '../dto/create-motor-journey.dto';

@Injectable()
export class MotorJourneyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantAuthService: TenantResourceAuthorizationService,
  ) {}

  /**
   * Initializes a new Motor insurance journey with strict 24-hour TTL and tenant binding.
   */
  async createJourney(dto: CreateMotorJourneyDto, actor: RequestUser) {
    const companyId = actor.companyId || (actor as any).organizationId;
    if (!companyId) {
      throw new ForbiddenException({
        code: 'MISSING_TENANT_CONTEXT',
        message: 'Valid company tenancy is required to start a motor journey.',
      });
    }

    if (dto.assignedAgentId) {
      await this.tenantAuthService.assertAssignableAgent(dto.assignedAgentId, actor);
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const journey = await this.prisma.motorJourney.create({
      data: {
        companyId,
        actorId: actor.id,
        vehicleCategory: dto.vehicleCategory || null,
        status: 'IN_PROGRESS',
        expiresAt,
      },
    });

    return {
      journeyId: journey.id,
      companyId: journey.companyId,
      actorId: journey.actorId,
      status: journey.status,
      vehicleCategory: journey.vehicleCategory,
      expiresAt: journey.expiresAt,
      createdAt: journey.createdAt,
    };
  }

  /**
   * Retrieves an existing Motor journey, enforcing tenant isolation, actor ownership, and TTL.
   */
  async getJourney(journeyId: string, actor: RequestUser) {
    const journey = await this.tenantAuthService.assertMotorJourneyAccess(
      journeyId,
      actor,
    );

    const isExpired = new Date() > new Date(journey.expiresAt);
    if (isExpired && journey.status === 'IN_PROGRESS') {
      await this.prisma.motorJourney.update({
        where: { id: journeyId },
        data: { status: 'EXPIRED' },
      });
      journey.status = 'EXPIRED';
    }

    return {
      journeyId: journey.id,
      companyId: journey.companyId,
      actorId: journey.actorId,
      quotationId: journey.quotationId,
      status: journey.status,
      vehicleCategory: journey.vehicleCategory,
      expiresAt: journey.expiresAt,
      isExpired,
      createdAt: journey.createdAt,
      updatedAt: journey.updatedAt,
    };
  }
}
