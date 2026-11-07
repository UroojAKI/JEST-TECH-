import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AgentExternalCodeHistoryAction,
  AgentExternalCodeStatus,
  AgentIdentifierVerificationStatus,
  AuditAction,
  Prisma,
  RoleType,
} from '@prisma/client';
import type { ActorContext } from '../../common/interfaces/actor-context.interface';
import { PaginatedResponseDto } from '../../common/pagination/paginated-response.dto';
import { PrismaService } from '../../database/prisma.service';
import {
  AgentExternalCodeHistoryQueryDto,
  AgentExternalCodeQueryDto,
  AgentIdentifierType,
  CreateAgentExternalCodeDto,
  ResolveAgentIdentifierDto,
  UpdateAgentExternalCodeDto,
} from './dto/agent-external-code.dto';

type AgentSummary = {
  id: string;
  userId: string;
  agentCode: string | null;
  companyId: string;
  isActive: boolean;
  deletedAt: Date | null;
  user?: {
    firstName: string;
    lastName: string;
    branch?: { id: string; code: string; name: string } | null;
  } | null;
};

@Injectable()
export class AgentIdentityResolverService {
  constructor(private readonly prisma: PrismaService) {}

  private companyId(actor: ActorContext): string {
    const companyId = actor.companyId || actor.organizationId;
    if (!companyId) throw new ForbiddenException('Tenant context is required');
    return companyId;
  }

  private actorId(actor: ActorContext): string {
    if (!actor.userId) throw new ForbiddenException('Authenticated user is required');
    return actor.userId;
  }

  private assertManager(actor: ActorContext): void {
    if (actor.role !== RoleType.ADMIN && actor.role !== RoleType.BACK_OFFICE) {
      throw new ForbiddenException('Only Admin or Back Office can manage Agent identifiers');
    }
  }

  private async getAgent(agentId: string, actor: ActorContext) {
    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, companyId: this.companyId(actor), deletedAt: null },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            branch: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });
    if (!agent) throw new NotFoundException('Agent not found in this organization');

    if (actor.role === RoleType.AGENT) {
      let actorAgentId = actor.agentId;
      if (!actorAgentId) {
        const actorAgent = await this.prisma.agent.findFirst({
          where: { userId: this.actorId(actor), companyId: this.companyId(actor), deletedAt: null },
          select: { id: true },
        });
        actorAgentId = actorAgent?.id;
      }
      if (agent.id !== actorAgentId) throw new ForbiddenException('Agents can only view their own identifiers');
    }
    return agent;
  }

  private async getCode(agentId: string, codeId: string, actor: ActorContext) {
    await this.getAgent(agentId, actor);
    const code = await this.prisma.agentExternalCode.findFirst({
      where: { id: codeId, agentId, companyId: this.companyId(actor) },
    });
    if (!code) throw new NotFoundException('Agent identifier not found');
    return code;
  }

  private normalizeCode(code: string): { externalCode: string; normalizedCode: string } {
    const externalCode = code.trim().normalize('NFC');
    if (!externalCode) throw new BadRequestException('External agent code cannot be blank');
    // Preserve case and punctuation until the owning code system defines otherwise.
    return { externalCode, normalizedCode: externalCode };
  }

  private normalizeCodeSystem(codeSystem: string): string {
    const value = codeSystem.trim().normalize('NFC').toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9._-]{0,49}$/.test(value)) {
      throw new BadRequestException('Code system must be a valid namespace key');
    }
    return value;
  }

  private validateEffectiveDates(effectiveFrom?: Date | null, effectiveTo?: Date | null): void {
    if (effectiveFrom && effectiveTo && effectiveTo < effectiveFrom) {
      throw new BadRequestException('effectiveTo must be on or after effectiveFrom');
    }
  }

  private snapshot(code: any): Prisma.InputJsonValue {
    return {
      externalCode: code.externalCode,
      normalizedCode: code.normalizedCode,
      codeSystem: code.codeSystem,
      sourceName: code.sourceName ?? null,
      status: code.status,
      isPrimary: code.isPrimary,
      effectiveFrom: code.effectiveFrom?.toISOString() ?? null,
      effectiveTo: code.effectiveTo?.toISOString() ?? null,
      verificationStatus: code.verificationStatus,
      verificationNotes: code.verificationNotes ?? null,
      verifiedAt: code.verifiedAt?.toISOString() ?? null,
      verifiedById: code.verifiedById ?? null,
    };
  }

  private auditAction(action: AgentExternalCodeHistoryAction): AuditAction {
    if (action === AgentExternalCodeHistoryAction.CREATED) return AuditAction.CREATE;
    if (action === AgentExternalCodeHistoryAction.VERIFIED) return AuditAction.APPROVE;
    if (action === AgentExternalCodeHistoryAction.REJECTED) return AuditAction.REJECT;
    return AuditAction.UPDATE;
  }

  private async recordCodeChange(
    tx: Prisma.TransactionClient,
    code: any,
    action: AgentExternalCodeHistoryAction,
    actorId: string,
    oldValue: Prisma.InputJsonValue | null,
    reason?: string,
    correlationId?: string,
  ) {
    const newValue = this.snapshot(code);
    await tx.agentExternalCodeHistory.create({
      data: {
        companyId: code.companyId,
        externalCodeId: code.id,
        agentId: code.agentId,
        action,
        oldValue: oldValue ?? Prisma.JsonNull,
        newValue,
        reason: reason?.trim() || null,
        correlationId: correlationId || null,
        changedById: actorId,
      },
    });
    await tx.auditLog.create({
      data: {
        action: this.auditAction(action),
        entity: 'AgentExternalCode',
        entityId: code.id,
        entityType: 'AGENT_EXTERNAL_CODE',
        userId: actorId,
        performedById: actorId,
        module: 'AGENTS',
        correlationId: correlationId || null,
        oldValue: oldValue ?? Prisma.JsonNull,
        newValue,
        metadata: { historyAction: action, reason: reason?.trim() || null },
      },
    });
  }

  private async clearOtherPrimaries(
    tx: Prisma.TransactionClient,
    companyId: string,
    agentId: string,
    codeSystem: string,
    actorId: string,
    correlationId?: string,
    excludingId?: string,
  ) {
    const primaries = await tx.agentExternalCode.findMany({
      where: {
        companyId,
        agentId,
        codeSystem,
        status: AgentExternalCodeStatus.ACTIVE,
        isPrimary: true,
        ...(excludingId ? { id: { not: excludingId } } : {}),
      },
    });
    for (const primary of primaries) {
      const oldValue = this.snapshot(primary);
      const updated = await tx.agentExternalCode.update({
        where: { id: primary.id },
        data: { isPrimary: false, updatedById: actorId },
      });
      await this.recordCodeChange(
        tx,
        updated,
        AgentExternalCodeHistoryAction.UPDATED,
        actorId,
        oldValue,
        'Replaced by another primary identifier in the same code system',
        correlationId,
      );
    }
  }

  private translateUniqueConflict(error: any): never {
    if (error?.code === 'P2002') {
      throw new ConflictException('This code is already registered in the organization and code system');
    }
    throw error;
  }

  async registerExternalCode(
    agentId: string,
    dto: CreateAgentExternalCodeDto,
    actor: ActorContext,
    correlationId?: string,
  ) {
    this.assertManager(actor);
    const actorId = this.actorId(actor);
    const companyId = this.companyId(actor);
    const agent = await this.getAgent(agentId, actor);
    if (!agent.isActive) throw new ConflictException('Cannot register identifiers for an inactive Agent');

    const { externalCode, normalizedCode } = this.normalizeCode(dto.externalCode);
    const codeSystem = this.normalizeCodeSystem(dto.codeSystem);
    const effectiveFrom = dto.effectiveFrom ? new Date(dto.effectiveFrom) : null;
    const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null;
    this.validateEffectiveDates(effectiveFrom, effectiveTo);

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (dto.isPrimary) {
          await this.clearOtherPrimaries(tx, companyId, agentId, codeSystem, actorId, correlationId);
        }
        const code = await tx.agentExternalCode.create({
          data: {
            companyId,
            agentId,
            externalCode,
            normalizedCode,
            codeSystem,
            sourceName: dto.sourceName?.trim() || null,
            isPrimary: Boolean(dto.isPrimary),
            effectiveFrom,
            effectiveTo,
            verificationNotes: dto.verificationNotes?.trim() || null,
            createdById: actorId,
          },
        });
        await this.recordCodeChange(
          tx,
          code,
          AgentExternalCodeHistoryAction.CREATED,
          actorId,
          null,
          'External Agent identifier registered',
          correlationId,
        );
        return code;
      });
    } catch (error) {
      return this.translateUniqueConflict(error);
    }
  }

  async listExternalCodes(
    agentId: string,
    query: AgentExternalCodeQueryDto,
    actor: ActorContext,
  ) {
    await this.getAgent(agentId, actor);
    const page = query.page || 1;
    const limit = query.limit || 25;
    const where: Prisma.AgentExternalCodeWhereInput = {
      companyId: this.companyId(actor),
      agentId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.verificationStatus ? { verificationStatus: query.verificationStatus } : {}),
      ...(query.codeSystem ? { codeSystem: this.normalizeCodeSystem(query.codeSystem) } : {}),
      ...(query.search
        ? {
            OR: [
              { externalCode: { contains: query.search.trim(), mode: 'insensitive' } },
              { codeSystem: { contains: query.search.trim(), mode: 'insensitive' } },
              { sourceName: { contains: query.search.trim(), mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.agentExternalCode.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.agentExternalCode.count({ where }),
    ]);
    return new PaginatedResponseDto(data, total, page, limit);
  }

  async updateExternalCode(
    agentId: string,
    codeId: string,
    dto: UpdateAgentExternalCodeDto,
    actor: ActorContext,
    correlationId?: string,
  ) {
    this.assertManager(actor);
    if (dto.verificationStatus && actor.role !== RoleType.ADMIN) {
      throw new ForbiddenException('Only Admin can verify or reject an external Agent identifier');
    }
    const actorId = this.actorId(actor);
    const existing = await this.getCode(agentId, codeId, actor);
    if (existing.status !== AgentExternalCodeStatus.ACTIVE) {
      throw new ConflictException('Reactivate an inactive identifier before editing it');
    }

    const externalCode = dto.externalCode === undefined
      ? existing.externalCode
      : this.normalizeCode(dto.externalCode).externalCode;
    const normalizedCode = this.normalizeCode(externalCode).normalizedCode;
    const codeSystem = dto.codeSystem === undefined
      ? existing.codeSystem
      : this.normalizeCodeSystem(dto.codeSystem);
    const effectiveFrom = dto.effectiveFrom === undefined
      ? existing.effectiveFrom
      : dto.effectiveFrom ? new Date(dto.effectiveFrom) : null;
    const effectiveTo = dto.effectiveTo === undefined
      ? existing.effectiveTo
      : dto.effectiveTo ? new Date(dto.effectiveTo) : null;
    this.validateEffectiveDates(effectiveFrom, effectiveTo);
    const oldValue = this.snapshot(existing);
    const nextVerification = dto.verificationStatus ?? existing.verificationStatus;
    const action = nextVerification !== existing.verificationStatus
      ? nextVerification === AgentIdentifierVerificationStatus.VERIFIED
        ? AgentExternalCodeHistoryAction.VERIFIED
        : nextVerification === AgentIdentifierVerificationStatus.REJECTED
          ? AgentExternalCodeHistoryAction.REJECTED
          : AgentExternalCodeHistoryAction.UPDATED
      : AgentExternalCodeHistoryAction.UPDATED;

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (dto.isPrimary) {
          await this.clearOtherPrimaries(
            tx,
            existing.companyId,
            agentId,
            codeSystem,
            actorId,
            correlationId,
            codeId,
          );
        }
        const code = await tx.agentExternalCode.update({
          where: { id: codeId },
          data: {
            externalCode,
            normalizedCode,
            codeSystem,
            ...(dto.sourceName !== undefined ? { sourceName: dto.sourceName.trim() || null } : {}),
            ...(dto.isPrimary !== undefined ? { isPrimary: dto.isPrimary } : {}),
            effectiveFrom,
            effectiveTo,
            verificationStatus: nextVerification,
            ...(dto.verificationNotes !== undefined
              ? { verificationNotes: dto.verificationNotes.trim() || null }
              : {}),
            verifiedAt: nextVerification === AgentIdentifierVerificationStatus.VERIFIED ? new Date() : null,
            verifiedById: nextVerification === AgentIdentifierVerificationStatus.VERIFIED ? actorId : null,
            updatedById: actorId,
          },
        });
        await this.recordCodeChange(tx, code, action, actorId, oldValue, dto.reason, correlationId);
        return code;
      });
    } catch (error) {
      return this.translateUniqueConflict(error);
    }
  }

  async deactivateExternalCode(
    agentId: string,
    codeId: string,
    reason: string | undefined,
    actor: ActorContext,
    correlationId?: string,
  ) {
    this.assertManager(actor);
    const actorId = this.actorId(actor);
    const existing = await this.getCode(agentId, codeId, actor);
    if (existing.status === AgentExternalCodeStatus.INACTIVE) return existing;
    const oldValue = this.snapshot(existing);
    return this.prisma.$transaction(async (tx) => {
      const code = await tx.agentExternalCode.update({
        where: { id: codeId },
        data: { status: AgentExternalCodeStatus.INACTIVE, isPrimary: false, updatedById: actorId },
      });
      await this.recordCodeChange(tx, code, AgentExternalCodeHistoryAction.DEACTIVATED, actorId, oldValue, reason, correlationId);
      return code;
    });
  }

  async reactivateExternalCode(
    agentId: string,
    codeId: string,
    reason: string | undefined,
    actor: ActorContext,
    correlationId?: string,
  ) {
    this.assertManager(actor);
    const actorId = this.actorId(actor);
    const existing = await this.getCode(agentId, codeId, actor);
    if (existing.status === AgentExternalCodeStatus.ACTIVE) return existing;
    const oldValue = this.snapshot(existing);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const code = await tx.agentExternalCode.update({
          where: { id: codeId },
          data: { status: AgentExternalCodeStatus.ACTIVE, updatedById: actorId },
        });
        await this.recordCodeChange(tx, code, AgentExternalCodeHistoryAction.REACTIVATED, actorId, oldValue, reason, correlationId);
        return code;
      });
    } catch (error) {
      return this.translateUniqueConflict(error);
    }
  }

  async listExternalCodeHistory(
    agentId: string,
    codeId: string,
    query: AgentExternalCodeHistoryQueryDto,
    actor: ActorContext,
  ) {
    await this.getCode(agentId, codeId, actor);
    const page = query.page || 1;
    const limit = query.limit || 25;
    const where: Prisma.AgentExternalCodeHistoryWhereInput = {
      companyId: this.companyId(actor),
      externalCodeId: codeId,
      ...(query.search
        ? { reason: { contains: query.search.trim(), mode: 'insensitive' } }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.agentExternalCodeHistory.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { changedBy: { select: { id: true, firstName: true, lastName: true } } },
      }),
      this.prisma.agentExternalCodeHistory.count({ where }),
    ]);
    return new PaginatedResponseDto(data, total, page, limit);
  }

  async resolveAgentIdentifier(
    query: ResolveAgentIdentifierDto,
    actor: ActorContext,
  ) {
    const companyId = this.companyId(actor);
    const identifier = query.identifier.trim().normalize('NFC');
    if (!identifier) throw new BadRequestException('Agent identifier is required');

    let agent: AgentSummary | null = null;
    let externalCode: any = null;
    if (query.identifierType === AgentIdentifierType.EXTERNAL_CODE) {
      if (!query.codeSystem) throw new BadRequestException('codeSystem is required for external identifiers');
      const codeSystem = this.normalizeCodeSystem(query.codeSystem);
      externalCode = await this.prisma.agentExternalCode.findUnique({
        where: {
          companyId_codeSystem_normalizedCode: {
            companyId,
            codeSystem,
            normalizedCode: identifier,
          },
        },
        include: {
          agent: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  branch: { select: { id: true, code: true, name: true } },
                },
              },
            },
          },
        },
      });
      if (!externalCode) throw new NotFoundException('External Agent identifier was not found');
      if (externalCode.status !== AgentExternalCodeStatus.ACTIVE) {
        throw new ConflictException('External Agent identifier is inactive');
      }
      if (externalCode.verificationStatus !== AgentIdentifierVerificationStatus.VERIFIED) {
        throw new ConflictException(`External Agent identifier is ${externalCode.verificationStatus.toLowerCase()} and cannot be used`);
      }
      const now = new Date();
      if ((externalCode.effectiveFrom && externalCode.effectiveFrom > now) ||
          (externalCode.effectiveTo && externalCode.effectiveTo < now)) {
        throw new ConflictException('External Agent identifier is outside its effective dates');
      }
      agent = externalCode.agent;
    } else if (query.identifierType === AgentIdentifierType.AGENT_CODE) {
      agent = await this.prisma.agent.findFirst({
        where: { companyId, agentCode: { equals: identifier, mode: 'insensitive' }, deletedAt: null },
        include: { user: { select: { firstName: true, lastName: true, branch: { select: { id: true, code: true, name: true } } } } },
      });
    } else if (query.identifierType === AgentIdentifierType.AGENT_ID) {
      agent = await this.prisma.agent.findFirst({
        where: { companyId, id: identifier, deletedAt: null },
        include: { user: { select: { firstName: true, lastName: true, branch: { select: { id: true, code: true, name: true } } } } },
      });
    } else {
      const user = await this.prisma.user.findFirst({
        where: {
          companyId,
          ...(query.identifierType === AgentIdentifierType.USER_ID
            ? { id: identifier }
            : { employeeCode: { equals: identifier, mode: 'insensitive' } }),
        },
        include: {
          agentProfile: {
            include: {
              user: { select: { firstName: true, lastName: true, branch: { select: { id: true, code: true, name: true } } } },
            },
          },
        },
      });
      agent = user?.agentProfile || null;
    }

    if (!agent || agent.companyId !== companyId || agent.deletedAt || !agent.isActive) {
      throw new NotFoundException('No active Agent matches this identifier in the organization');
    }
    if (actor.role === RoleType.AGENT) {
      const ownAgentId = actor.agentId || (await this.prisma.agent.findFirst({
        where: { userId: this.actorId(actor), companyId, deletedAt: null },
        select: { id: true },
      }))?.id;
      if (agent.id !== ownAgentId) throw new ForbiddenException('Agents can only resolve their own identity');
    }

    return {
      agent: {
        id: agent.id,
        agentCode: externalCode?.externalCode || null,
        clientCode: externalCode?.externalCode || null,
        codeSystem: externalCode?.codeSystem || null,
        name: `${agent.user?.firstName || ''} ${agent.user?.lastName || ''}`.trim(),
        branch: agent.user?.branch || null,
        isActive: agent.isActive,
      },
      identifier: {
        type: query.identifierType,
        value: identifier,
        codeSystem: externalCode?.codeSystem || null,
        externalCodeId: externalCode?.id || null,
        verificationStatus: externalCode?.verificationStatus || null,
      },
    };
  }

  async resolveLegacyAgentCode(code: string, actor: ActorContext) {
    const companyId = this.companyId(actor);
    const identifier = code.trim().normalize('NFC');
    if (!identifier) throw new BadRequestException('Agent code cannot be blank');
    const [byAgentCode, byEmployeeCode, byUserId] = await Promise.all([
      this.prisma.agent.findFirst({
        where: { companyId, agentCode: { equals: identifier, mode: 'insensitive' }, isActive: true, deletedAt: null },
        select: { id: true, userId: true, agentCode: true, companyId: true, isActive: true },
      }),
      this.prisma.user.findFirst({
        where: { companyId, employeeCode: { equals: identifier, mode: 'insensitive' } },
        include: { agentProfile: true },
      }),
      this.prisma.user.findFirst({
        where: { id: identifier, companyId },
        include: { agentProfile: true },
      }),
    ]);
    const candidates = [byAgentCode, byEmployeeCode?.agentProfile, byUserId?.agentProfile]
      .filter((candidate: any) => candidate && candidate.companyId === companyId && candidate.isActive && !candidate.deletedAt);
    const unique = [...new Map(candidates.map((candidate: any) => [candidate.id, candidate])).values()];
    if (unique.length === 0) throw new NotFoundException(`No active Agent matches '${identifier}' in this organization`);
    if (unique.length > 1) {
      throw new ConflictException('This legacy agentCode is ambiguous; supply an explicit codeSystem or identifier type');
    }
    const agent: any = unique[0];
    if (actor.role === RoleType.AGENT) {
      const ownAgentId = actor.agentId || (await this.prisma.agent.findFirst({
        where: { userId: this.actorId(actor), companyId, deletedAt: null },
        select: { id: true },
      }))?.id;
      if (agent.id !== ownAgentId) throw new ForbiddenException('Agents can only assign themselves');
    }
    return {
      agentId: agent.id,
      agentCode: null,
      userId: agent.userId,
      externalCodeId: null as string | null,
      originalIdentifier: identifier,
    };
  }

  async resolveExternalCodeForAssignment(code: string, codeSystem: string, actor: ActorContext) {
    const result = await this.resolveAgentIdentifier(
      { identifier: code, codeSystem, identifierType: AgentIdentifierType.EXTERNAL_CODE },
      actor,
    );
    const canonical = await this.validateAgentOwnership(result.agent.id, this.companyId(actor));
    return {
      agentId: canonical.id,
      agentCode: result.identifier.value,
      userId: canonical.userId,
      externalCodeId: result.identifier.externalCodeId,
      originalIdentifier: result.identifier.value,
      codeSystem: result.identifier.codeSystem,
    };
  }

  async validateAgentOwnership(agentId: string, companyId: string) {
    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, companyId, isActive: true, deletedAt: null },
      select: { id: true, userId: true, agentCode: true, companyId: true, isActive: true },
    });
    if (!agent) throw new NotFoundException('Agent is inactive or outside this organization');
    return agent;
  }
}
