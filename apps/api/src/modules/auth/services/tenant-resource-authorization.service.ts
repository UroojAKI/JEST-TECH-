import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { ActorContext } from '../../../common/interfaces/actor-context.interface';
import { RequestUser } from '../decorators/current-user.decorator';

export type TenantResourceType =
  | 'Quotation'
  | 'MotorQuotation'
  | 'Customer'
  | 'Contact'
  | 'Vehicle'
  | 'Lead'
  | 'Proposal'
  | 'Payment'
  | 'Policy'
  | 'Inspection'
  | 'Document'
  | 'Report'
  | 'ReportSchedule'
  | 'Claim'
  | 'Commission'
  | 'Renewal'
  | 'MotorJourney'
  | 'Agent';

@Injectable()
export class TenantResourceAuthorizationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Asserts that a resource's companyId strictly matches the actor's companyId.
   * Throws ForbiddenException on mismatch.
   */
  assertSameTenant(
    resourceCompanyId: string | null | undefined,
    actorCompanyId: string | null | undefined,
    resourceName: string = 'Resource',
  ): void {
    if (!resourceCompanyId || !actorCompanyId || resourceCompanyId !== actorCompanyId) {
      throw new ForbiddenException({
        code: 'CROSS_TENANT_ACCESS_FORBIDDEN',
        message: `Cross-tenant access forbidden: ${resourceName} does not belong to your company tenant.`,
      });
    }
  }

  /**
   * Fetches an authoritative domain resource by ID and verifies tenant ownership.
   */
  async assertTenantResource<T = any>(
    resourceType: TenantResourceType,
    resourceId: string,
    actor: ActorContext | RequestUser,
  ): Promise<T> {
    if (!resourceId) {
      throw new BadRequestException(`${resourceType} ID must be specified.`);
    }

    const actorCompanyId = actor?.companyId;
    if (!actorCompanyId) {
      throw new ForbiddenException({
        code: 'MISSING_TENANT_CONTEXT',
        message: 'Actor context is missing valid company tenancy.',
      });
    }

    let resource: any = null;

    switch (resourceType) {
      case 'Quotation':
        resource = await this.prisma.quotation.findUnique({ where: { id: resourceId } });
        break;
      case 'MotorQuotation':
        resource = await this.prisma.motorQuotation.findUnique({ where: { id: resourceId } });
        break;
      case 'Customer':
        resource = await this.prisma.customer.findUnique({ where: { id: resourceId } });
        break;
      case 'Contact':
        resource = await this.prisma.contact.findUnique({ where: { id: resourceId } });
        break;
      case 'Vehicle':
        resource = await this.prisma.vehicle.findUnique({ where: { id: resourceId } });
        break;
      case 'Lead':
        resource = await this.prisma.lead.findUnique({ where: { id: resourceId } });
        break;
      case 'Proposal':
        resource = await this.prisma.proposal.findUnique({ where: { id: resourceId } });
        break;
      case 'Payment':
        resource = await this.prisma.motorPaymentRecord.findUnique({ where: { id: resourceId } });
        break;
      case 'Policy':
        resource = await this.prisma.policy.findUnique({ where: { id: resourceId } });
        break;
      case 'Inspection':
        resource = await this.prisma.motorInspection.findUnique({ where: { id: resourceId } });
        break;
      case 'Document':
        resource = await this.prisma.document.findUnique({ where: { id: resourceId } });
        break;
      case 'Report':
        resource = await this.prisma.report.findUnique({ where: { id: resourceId } });
        break;
      case 'ReportSchedule':
        resource = await this.prisma.reportSchedule.findUnique({ where: { id: resourceId } });
        break;
      case 'Claim':
        resource = await this.prisma.claim.findUnique({ where: { id: resourceId } });
        break;
      case 'Commission':
        resource = await this.prisma.commission.findUnique({ where: { id: resourceId } });
        break;
      case 'MotorJourney':
        resource = await this.prisma.motorJourney.findUnique({ where: { id: resourceId } });
        break;
      case 'Agent':
        resource = await this.prisma.agent.findUnique({ where: { id: resourceId } });
        break;
      default:
        throw new BadRequestException(`Unsupported resource type: ${resourceType}`);
    }

    if (!resource) {
      throw new NotFoundException(`${resourceType} with ID ${resourceId} not found.`);
    }

    this.assertSameTenant(resource.companyId, actorCompanyId, resourceType);
    return resource as T;
  }

  /**
   * Asserts that an agent exists, belongs to the same tenant, and is actively eligible for assignment.
   */
  async assertAssignableAgent(
    agentId: string,
    actor: ActorContext | RequestUser,
  ): Promise<any> {
    if (!agentId) {
      throw new BadRequestException('Agent ID must be provided.');
    }

    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      include: { user: true },
    });

    if (!agent) {
      throw new NotFoundException(`Agent with ID ${agentId} not found.`);
    }

    this.assertSameTenant(agent.companyId, actor.companyId, 'Agent');

    if (!agent.isActive) {
      throw new BadRequestException({
        code: 'AGENT_INACTIVE',
        message: `Agent ${agent.agentCode} is inactive and cannot be assigned to new quotations or policies.`,
      });
    }

    if (agent.deletedAt) {
      throw new BadRequestException({
        code: 'AGENT_DELETED',
        message: `Agent ${agent.agentCode} has been deleted.`,
      });
    }

    // Role-based assignment authority check: AGENT cannot reassign to another agent unless authorized
    const actorUserId = actor.userId || (actor as any).id;
    if (
      actor.role === 'AGENT' &&
      actorUserId !== agent.userId &&
      !(actor as any)?.canAssign
    ) {
      throw new ForbiddenException({
        code: 'AGENT_ASSIGNMENT_UNAUTHORIZED',
        message: 'Agents cannot assign quotations to other agents.',
      });
    }

    return agent;
  }

  /**
   * Asserts access rights to a MotorJourney based on tenant match and actor ownership/assignment.
   */
  async assertMotorJourneyAccess(
    journeyId: string,
    actor: ActorContext | RequestUser,
  ): Promise<any> {
    const journey = await this.prisma.motorJourney.findUnique({
      where: { id: journeyId },
      include: { quotation: true },
    });

    if (!journey) {
      throw new NotFoundException(`Motor journey ${journeyId} not found.`);
    }

    this.assertSameTenant(journey.companyId, actor.companyId, 'MotorJourney');

    // Check ownership / assignment or role elevation
    const actorId = actor.userId || (actor as any).id;
    const isOwner = journey.actorId === actorId;
    const isElevatedRole = ['BACK_OFFICE', 'ADMIN', 'SUPER_ADMIN'].includes(actor.role);

    if (!isOwner && !isElevatedRole) {
      throw new ForbiddenException({
        code: 'JOURNEY_OWNERSHIP_MISMATCH',
        message: 'You are not authorized to access or modify this motor journey.',
      });
    }

    return journey;
  }
}
