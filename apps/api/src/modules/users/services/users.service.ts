import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';

import {
  AuditAction,
  RoleType,
  UserStatus,
  Prisma,
  IssuanceStatus,
  QuotationStatus,
} from '@prisma/client';

import { PaginationDto } from '../../../common/pagination/pagination.dto';
import { PaginatedResponseDto } from '../../../common/pagination/paginated-response.dto';

import { UserMapper } from '../mappers/user.mapper';
import { CreateUserDto } from '../dto/create-user.dto';
import { UserRepository } from '../repositories/user.repository';
import { PrismaService } from '../../../database/prisma.service';
import { PlatformPrivilegeResolver } from '../../../common/services/platform-privilege.resolver';

@Injectable()
export class UsersService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly prisma: PrismaService,
  ) {}

  async getPrimaryOrganizationId(): Promise<string | null> {
    const company = await this.prisma.company.findFirst({
      where: { isActive: true },
      select: { id: true },
    });
    return company?.id || null;
  }

  async generateEmployeeCode(): Promise<string> {
    try {
      const result = await this.prisma.$queryRaw<[{ nextval: bigint }]>`
        SELECT nextval('employee_code_seq')`;
      return `EMP-${result[0].nextval.toString().padStart(6, '0')}`;
    } catch {
      await this.prisma
        .$executeRaw`CREATE SEQUENCE IF NOT EXISTS employee_code_seq START 1;`;
      const retry = await this.prisma.$queryRaw<[{ nextval: bigint }]>`
        SELECT nextval('employee_code_seq')`;
      return `EMP-${retry[0].nextval.toString().padStart(6, '0')}`;
    }
  }

  async create(dto: CreateUserDto, actor?: any) {
    const actorCompanyId =
      actor?.companyId || actor?.organizationId || actor?.user?.companyId;

    if (actorCompanyId && dto.companyId && dto.companyId !== actorCompanyId) {
      throw new ForbiddenException(
        'Cross-organization user creation is strictly prohibited',
      );
    }

    let canonicalRole: RoleType = RoleType.AGENT;
    const rawRole = String(dto.role || '').toUpperCase();
    if (rawRole === 'ADMIN' || rawRole === 'SUPER_ADMIN') {
      canonicalRole = RoleType.ADMIN;
    } else if (
      [
        'BACK_OFFICE',
        'UNDERWRITER',
        'FINANCE',
        'CLAIMS_OFFICER',
        'BRANCH_MANAGER',
        'OPERATIONS',
      ].includes(rawRole)
    ) {
      canonicalRole = RoleType.BACK_OFFICE;
    } else {
      canonicalRole = RoleType.AGENT;
    }

    let role = await this.userRepository.findRoleByType(canonicalRole);

    if (!role) {
      role = await this.prisma.role.findFirst({
        where: { type: canonicalRole },
      });
      if (!role) {
        role = await this.prisma.role.create({
          data: {
            name: String(canonicalRole),
            code: String(canonicalRole),
            type: canonicalRole,
          },
        });
      }
    }

    const initialPassword =
      dto.password || `${crypto.randomBytes(16).toString('hex')}A1`;
    const passwordHash = await argon2.hash(initialPassword);
    const empCode = dto.employeeCode || (await this.generateEmployeeCode());

    const targetBranchId = dto.branchId || dto.branch;
    let branchConnect: any = undefined;
    if (targetBranchId) {
      const isUUID =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          targetBranchId,
        );
      if (isUUID) {
        branchConnect = { connect: { id: targetBranchId } };
      }
    }

    const targetDepartmentId = (dto as any).departmentId || dto.department;
    let departmentConnect: any = undefined;
    if (targetDepartmentId) {
      const isUUID =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          targetDepartmentId,
        );
      if (isUUID) {
        departmentConnect = { connect: { id: targetDepartmentId } };
      }
    }

    const defaultCompanyId = await this.getPrimaryOrganizationId();
    const targetCompanyId = actorCompanyId || dto.companyId || defaultCompanyId;
    let companyConnect: any = undefined;
    if (targetCompanyId) {
      companyConnect = { connect: { id: targetCompanyId } };
    }

    const user = await this.userRepository.create({
      email: dto.email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      collectContacts: canonicalRole === RoleType.AGENT && dto.collectContacts === true,
      employeeCode: empCode,
      designation: (dto as any).designation,
      role: { connect: { id: role.id } },
      company: companyConnect,
      status: (dto as any).status || UserStatus.ACTIVE,
      branch: branchConnect,
      department: departmentConnect,
    });

    if (canonicalRole === RoleType.AGENT && targetCompanyId) {
      try {
        const name = `${user.firstName || ''} ${user.lastName || ''}`.trim();
        await this.prisma.agent.create({
          data: {
            companyId: targetCompanyId,
            userId: user.id,
            agencyName: name ? `${name} Agency` : 'Agency',
            commissionTier: 'STANDARD',
            isActive: true,
          },
        });
      } catch {
        // Safe fallback if agent profile already exists or in case of concurrency
      }
    }

    const response: any = UserMapper.toResponse(user);
    response.initialPassword = initialPassword;
    return response;
  }

  async adminResetPassword(userId: string, newPassword?: string, actor?: any) {
    await this.findById(userId, actor);
    const password =
      newPassword || `${crypto.randomBytes(16).toString('hex')}A1`;
    const passwordHash = await argon2.hash(password);
    await this.userRepository.update(userId, { passwordHash });
    await this.revokeAllUserRefreshTokens(userId);
    await this.prisma.user.update({
      where: { id: userId },
      data: { authVersion: { increment: 1 } },
    });
    return {
      success: true,
      message: 'Password reset successfully',
      newPassword: password,
    };
  }

  async changePassword(
    userId: string,
    currentPassword?: string,
    newPassword?: string,
  ) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!currentPassword) {
      throw new BadRequestException('Current password is required');
    }
    if (!newPassword || newPassword.length < 6) {
      throw new BadRequestException(
        'New password must be at least 6 characters long',
      );
    }

    const isValid = await argon2.verify(user.passwordHash, currentPassword);
    if (!isValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const passwordHash = await argon2.hash(newPassword);
    await this.userRepository.update(userId, { passwordHash });
    await this.revokeAllUserRefreshTokens(userId);
    await this.prisma.user.update({
      where: { id: userId },
      data: { authVersion: { increment: 1 } },
    });
    return { success: true, message: 'Password changed successfully' };
  }

  async findAll(
    pagination: PaginationDto,
    status?: string,
    actor?: any,
    role?: string,
  ) {
    const page = pagination.page || 1;
    const limit = pagination.limit || 25;
    const skip = (page - 1) * limit;

    const actorCompanyId =
      actor?.companyId || actor?.organizationId || actor?.user?.companyId;

    const where: Prisma.UserWhereInput = {
      ...(actorCompanyId ? { companyId: actorCompanyId } : {}),
    };
    if (pagination.search) {
      where.OR = [
        { firstName: { contains: pagination.search, mode: 'insensitive' } },
        { lastName: { contains: pagination.search, mode: 'insensitive' } },
        { email: { contains: pagination.search, mode: 'insensitive' } },
        { employeeCode: { contains: pagination.search, mode: 'insensitive' } },
      ];
    }

    if (role && role !== 'ALL') {
      where.role = {
        code: { equals: role, mode: 'insensitive' },
      };
    }

    if (status && status !== 'ALL') {
      if (status === 'LOCKED') {
        where.status = UserStatus.SUSPENDED;
      } else if (status === 'DISABLED') {
        where.status = UserStatus.INACTIVE;
      } else if (Object.values(UserStatus).includes(status as UserStatus)) {
        where.status = status as UserStatus;
      }
    }

    const orderBy = pagination.sortBy
      ? ({ [pagination.sortBy]: pagination.sortOrder || 'asc' } as any)
      : { createdAt: 'desc' };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          role: true,
          branch: true,
          team: true,
          agentProfile: {
            include: {
              externalCodes: {
                where: { status: 'ACTIVE' },
                orderBy: [{ isPrimary: 'desc' }, { codeSystem: 'asc' }],
                select: {
                  id: true,
                  externalCode: true,
                  codeSystem: true,
                  verificationStatus: true,
                  isPrimary: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const data = UserMapper.toResponseList(users);
    return new PaginatedResponseDto(data, total, page, limit);
  }

  async findById(id: string, actor?: any) {
    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const actorCompanyId =
      actor?.companyId || actor?.organizationId || actor?.user?.companyId;
    if (actorCompanyId && user.companyId && user.companyId !== actorCompanyId) {
      throw new NotFoundException('User not found');
    }

    return UserMapper.toResponse(user);
  }

  async getUserWorkspace(id: string, actor?: any) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
        branch: true,
        team: true,
        department: true,
        agentProfile: {
          include: {
            externalCodes: {
              where: { status: 'ACTIVE' },
              orderBy: [{ isPrimary: 'desc' }, { codeSystem: 'asc' }],
              select: {
                id: true,
                externalCode: true,
                codeSystem: true,
                verificationStatus: true,
                isPrimary: true,
              },
            },
          },
        },
      },
    });

    if (!user || user.deletedAt) {
      throw new NotFoundException('User not found');
    }

    const actorCompanyId =
      actor?.companyId || actor?.organizationId || actor?.user?.companyId;
    if (actorCompanyId && user.companyId && user.companyId !== actorCompanyId) {
      throw new NotFoundException('User not found');
    }

    const companyId = user.companyId;
    let agentId = user.agentProfile?.id;
    if (!agentId) {
      const directAgent = await this.prisma.agent.findFirst({
        where: { userId: id },
      });
      if (directAgent) {
        agentId = directAgent.id;
      }
    }

    const leadUserFilter: Prisma.LeadWhereInput = {
      OR: [
        { assignedToId: id },
        ...(agentId ? [{ agentId }] : []),
        { createdById: id },
      ],
      deletedAt: null,
      ...(companyId ? { companyId } : {}),
    };

    const quoteUserFilter: Prisma.QuotationWhereInput = {
      OR: [
        ...(agentId ? [{ agentId }] : []),
        { agentId: id },
        { createdById: id },
        { contact: { OR: [ { createdById: id }, ...(agentId ? [{ assignedAgentId: agentId }] : []) ] } },
        { lead: { OR: [ { assignedToId: id }, ...(agentId ? [{ agentId }] : []), { createdById: id } ] } },
        ...(agentId ? [{ healthCase: { agentId } }] : []),
      ],
      deletedAt: null,
      ...(companyId ? { companyId } : {}),
    };

    const policyUserFilter: Prisma.PolicyWhereInput = {
      OR: [
        ...(agentId ? [{ agentId }] : []),
        { agentId: id },
        { createdById: id },
        { quotation: quoteUserFilter },
        { contact: { OR: [ { createdById: id }, ...(agentId ? [{ assignedAgentId: agentId }] : []) ] } },
      ],
      deletedAt: null,
      ...(companyId ? { companyId } : {}),
    };

    const [
      leadsCreated,
      leadsAssigned,
      leadsConverted,
      leadsLost,
      contactsCreated,
      customersCreated,
      customersManaged,
      policiesIssued,
      renewalsPending,
      pendingTasks,
      overdueTasks,
      quotationsCreated,
      quotationsIssued,
      quotationsApproved,
      quotationAggregate,
      policyAggregate,
      recentQuotationsRaw,
      recentPoliciesRaw,
      recentLeadsRaw,
      recentActivities,
      recentTasks,
    ] = await Promise.all([
      this.prisma.lead.count({
        where: { createdById: id, companyId, deletedAt: null },
      }),
      this.prisma.lead.count({
        where: leadUserFilter,
      }),
      this.prisma.lead.count({
        where: { ...leadUserFilter, status: 'CONVERTED' },
      }),
      this.prisma.lead.count({
        where: { ...leadUserFilter, status: 'LOST' },
      }),
      this.prisma.contact.count({
        where: {
          OR: [
            { createdById: id },
            ...(agentId ? [{ assignedAgentId: agentId }] : []),
          ],
          companyId,
          deletedAt: null,
        },
      }),
      this.prisma.customer.count({
        where: {
          OR: [
            { createdById: id },
            ...(agentId ? [{ primaryAgentId: agentId }] : []),
          ],
          companyId,
          deletedAt: null,
        },
      }),
      this.prisma.contact.count({
        where: {
          OR: [
            { createdById: id },
            ...(agentId ? [{ assignedAgentId: agentId }] : []),
          ],
          companyId,
          deletedAt: null,
        },
      }),
      this.prisma.policy.count({
        where: {
          ...policyUserFilter,
          status: 'ISSUED',
        },
      }),
      this.prisma.policy.count({
        where: {
          ...policyUserFilter,
          status: 'ACTIVE',
          expiryDate: {
            lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            gte: new Date(),
          },
        },
      }),
      this.prisma.task.count({
        where: {
          assignedToId: id,
          status: { in: ['PENDING', 'IN_PROGRESS'] },
          deletedAt: null,
        },
      }),
      this.prisma.task.count({
        where: {
          assignedToId: id,
          status: { in: ['PENDING', 'IN_PROGRESS'] },
          dueDate: { lt: new Date() },
          deletedAt: null,
        },
      }),
      this.prisma?.quotation?.count
        ? this.prisma.quotation.count({
            where: quoteUserFilter,
          })
        : Promise.resolve(0),
      this.prisma?.quotation?.count
        ? this.prisma.quotation.count({
            where: {
              AND: [
                quoteUserFilter,
                {
                  OR: [
                    { issuanceStatus: IssuanceStatus.ISSUED },
                    { status: QuotationStatus.CONVERTED_TO_POLICY },
                    { policy: { isNot: null } },
                  ],
                },
              ],
            },
          })
        : Promise.resolve(0),
      this.prisma?.quotation?.count
        ? this.prisma.quotation.count({
            where: {
              AND: [
                quoteUserFilter,
                { status: { in: ['APPROVED', 'ACCEPTED'] as any } },
              ],
            },
          })
        : Promise.resolve(0),
      this.prisma?.quotation?.aggregate
        ? this.prisma.quotation.aggregate({
            where: quoteUserFilter,
            _sum: { totalPremium: true },
          })
        : Promise.resolve({ _sum: { totalPremium: null } }),
      this.prisma?.policy?.aggregate
        ? this.prisma.policy.aggregate({
            where: {
              ...policyUserFilter,
              status: 'ISSUED',
            },
            _sum: { premiumAmount: true, actualPremium: true },
          })
        : Promise.resolve({ _sum: { premiumAmount: null, actualPremium: null } }),
      this.prisma?.quotation?.findMany
        ? this.prisma.quotation.findMany({
            where: quoteUserFilter,
            include: {
              contact: { select: { firstName: true, lastName: true, companyName: true, phone: true } },
              policy: { select: { policyNumber: true, actualPolicyNumber: true, status: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
          })
        : Promise.resolve([]),
      this.prisma?.policy?.findMany
        ? this.prisma.policy.findMany({
            where: policyUserFilter,
            include: {
              contact: { select: { firstName: true, lastName: true, companyName: true, phone: true } },
              quotation: { select: { quotationCode: true, insurerName: true, productType: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
          })
        : Promise.resolve([]),
      this.prisma?.lead?.findMany
        ? this.prisma.lead.findMany({
            where: leadUserFilter,
            include: {
              contact: { select: { firstName: true, lastName: true, companyName: true, phone: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
          })
        : Promise.resolve([]),
      this.prisma.auditLog.findMany({
        where: {
          OR: [{ userId: id }, { performedById: id }],
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      this.prisma.task.findMany({
        where: {
          assignedToId: id,
          deletedAt: null,
        },
        orderBy: { dueDate: 'asc' },
        take: 10,
      }),
    ]);

    const totalQuotationValue = Number(quotationAggregate?._sum?.totalPremium || 0);
    const totalIssuedPremium = Number(
      policyAggregate?._sum?.actualPremium ||
      policyAggregate?._sum?.premiumAmount ||
      0,
    );

    const recentQuotations = (recentQuotationsRaw || []).map((q: any) => ({
      id: q.id,
      quotationCode: q.quotationCode,
      title: q.title,
      customerName: q.contact
        ? `${q.contact.firstName || ''} ${q.contact.lastName || ''}`.trim() ||
          q.contact.companyName ||
          'Customer'
        : 'Customer',
      customerPhone: q.contact?.phone || null,
      insurerName: q.insurerName || 'Standard Insurer',
      productType: q.productType || 'MOTOR',
      totalPremium: Number(q.totalPremium || 0),
      basePremium: Number(q.basePremium || 0),
      status: q.status,
      issuanceStatus: q.issuanceStatus,
      policyNumber: q.policy?.actualPolicyNumber || q.policy?.policyNumber || null,
      createdAt: q.createdAt,
    }));

    const recentPolicies = (recentPoliciesRaw || []).map((p: any) => ({
      id: p.id,
      policyNumber: p.actualPolicyNumber || p.policyNumber,
      customerName: p.contact
        ? `${p.contact.firstName || ''} ${p.contact.lastName || ''}`.trim() ||
          p.contact.companyName ||
          'Customer'
        : 'Customer',
      customerPhone: p.contact?.phone || null,
      insurerName: p.quotation?.insurerName || 'Standard Insurer',
      productType: p.quotation?.productType || p.policyType || 'MOTOR',
      premiumAmount: Number(p.actualPremium || p.premiumAmount || 0),
      status: p.status,
      effectiveDate: p.effectiveDate,
      expiryDate: p.expiryDate,
      createdAt: p.createdAt,
    }));

    const recentLeads = (recentLeadsRaw || []).map((l: any) => ({
      id: l.id,
      leadCode: l.leadCode,
      title: l.title,
      customerName: l.contact
        ? `${l.contact.firstName || ''} ${l.contact.lastName || ''}`.trim() ||
          l.contact.companyName ||
          'Lead Customer'
        : 'Lead Customer',
      status: l.status,
      currentWorkflowStep: l.currentWorkflowStep,
      estimatedPremium: Number(l.estimatedPremium || 0),
      createdAt: l.createdAt,
    }));

    const auditActivities = (recentActivities || []).map((a) => ({
      id: a.id,
      action: a.action,
      entity: a.entity,
      entityId: a.entityId,
      ipAddress: a.ipAddress,
      createdAt: a.createdAt,
      details: a.newValue || a.metadata,
      source: 'AUDIT',
    }));

    const operationalActivities: any[] = [];
    for (const q of recentQuotationsRaw || []) {
      const isConverted =
        q.issuanceStatus === IssuanceStatus.ISSUED ||
        q.status === QuotationStatus.CONVERTED_TO_POLICY;
      operationalActivities.push({
        id: `quote-${q.id}`,
        action: isConverted ? 'CONVERT' : 'CREATE',
        entity: 'Quotation',
        entityId: q.quotationCode,
        ipAddress: 'System',
        createdAt: q.createdAt,
        details: {
          customer: q.contact
            ? `${q.contact.firstName || ''} ${q.contact.lastName || ''}`.trim()
            : 'Customer',
          insurer: q.insurerName,
          premium: `₹${Number(q.totalPremium || 0).toLocaleString('en-IN')}`,
          status: q.status,
          issuanceStatus: q.issuanceStatus,
        },
        source: 'OPERATIONAL',
      });
    }

    for (const p of recentPoliciesRaw || []) {
      operationalActivities.push({
        id: `policy-${p.id}`,
        action: 'ISSUE',
        entity: 'Policy',
        entityId: p.actualPolicyNumber || p.policyNumber,
        ipAddress: 'System',
        createdAt: p.createdAt,
        details: {
          customer: p.contact
            ? `${p.contact.firstName || ''} ${p.contact.lastName || ''}`.trim()
            : 'Customer',
          premium: `₹${Number(p.actualPremium || p.premiumAmount || 0).toLocaleString('en-IN')}`,
          status: p.status,
        },
        source: 'OPERATIONAL',
      });
    }

    for (const l of recentLeadsRaw || []) {
      operationalActivities.push({
        id: `lead-${l.id}`,
        action: l.status === 'CONVERTED' ? 'CONVERT_LEAD' : 'CREATE_LEAD',
        entity: 'Lead',
        entityId: l.leadCode || l.title,
        ipAddress: 'System',
        createdAt: l.createdAt,
        details: {
          customer: l.contact
            ? `${l.contact.firstName || ''} ${l.contact.lastName || ''}`.trim() || l.contact.companyName
            : 'Lead Customer',
          status: l.status,
          estimatedPremium: l.estimatedPremium ? `₹${Number(l.estimatedPremium).toLocaleString('en-IN')}` : undefined,
        },
        source: 'OPERATIONAL',
      });
    }

    const mergedActivities = [...auditActivities, ...operationalActivities]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, 40);

    return {
      profile: {
        id: user.id,
        employeeCode: user.employeeCode,
        firstName: user.firstName,
        lastName: user.lastName,
        name: `${user.firstName} ${user.lastName}`.trim(),
        email: user.email,
        phone: user.phone,
        designation: user.designation,
        department: user.department?.name || user.legacyDepartment,
        status: user.status,
        companyId: user.companyId,
        collectContacts: user.collectContacts,
        lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt).toISOString() : null,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        role: user.role
          ? {
              id: user.role.id,
              name: user.role.name,
              code: user.role.code,
              type: user.role.type,
              description: user.role.description,
              permissions:
                user.role.permissions?.map((rp: any) => ({
                  id: rp.permission?.id,
                  code: rp.permission?.code,
                  name: rp.permission?.name,
                  category: rp.permission?.category,
                  scope: rp.scope,
                })) || [],
            }
          : null,
        branch: user.branch
          ? {
              id: user.branch.id,
              code: user.branch.code,
              name: user.branch.name,
              city: user.branch.city,
            }
          : null,
        team: user.team
          ? {
              id: user.team.id,
              name: user.team.name,
            }
          : null,
        agentProfile: user.agentProfile
          ? {
              id: user.agentProfile.id,
              clientCodes: user.agentProfile.externalCodes.map((code) => ({
                id: code.id,
                value: code.externalCode,
                codeSystem: code.codeSystem,
                verificationStatus: code.verificationStatus,
                isPrimary: code.isPrimary,
              })),
              agencyName: user.agentProfile.agencyName,
              licenseNumber: user.agentProfile.licenseNumber,
              commissionTier: user.agentProfile.commissionTier,
              isActive: user.agentProfile.isActive,
            }
          : null,
      },
      portfolio: {
        leadsCreated,
        leadsAssigned,
        leadsConverted,
        leadsLost,
        contactsCreated,
        customersCreated,
        customersManaged,
        policiesIssued: Math.max(policiesIssued, quotationsIssued),
        renewalsPending,
        pendingTasks,
        overdueTasks,
        quotationsCreated,
        quotationsIssued,
        quotationsApproved,
        totalQuotationValue,
        totalIssuedPremium,
      },
      recentActivities: mergedActivities,
      recentTasks: recentTasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate,
        createdAt: t.createdAt,
      })),
      recentQuotations,
      recentPolicies,
      recentLeads,
    };
  }

  async updateStatus(
    id: string,
    targetStatus: UserStatus,
    reason?: string,
    actorId?: string,
    actor?: any,
  ) {
    const actorCompanyId =
      actor?.companyId || actor?.organizationId || actor?.user?.companyId;

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id },
        include: { role: true },
      });

      if (
        !user ||
        (actorCompanyId && user.companyId && user.companyId !== actorCompanyId)
      ) {
        throw new NotFoundException('User not found');
      }

      const currentStatus = user.status;

      if (currentStatus === targetStatus) {
        return UserMapper.toResponse(user);
      }

      // Explicit State Machine Rules:
      // PENDING_VERIFICATION -> ACTIVE
      // ACTIVE <-> SUSPENDED
      // ACTIVE <-> INACTIVE
      const validTransitions: Record<UserStatus, UserStatus[]> = {
        [UserStatus.PENDING_VERIFICATION]: [UserStatus.ACTIVE],
        [UserStatus.ACTIVE]: [UserStatus.SUSPENDED, UserStatus.INACTIVE],
        [UserStatus.SUSPENDED]: [UserStatus.ACTIVE],
        [UserStatus.INACTIVE]: [UserStatus.ACTIVE],
      };

      const allowed = validTransitions[currentStatus] || [];
      if (!allowed.includes(targetStatus)) {
        throw new BadRequestException(
          `Invalid status transition from ${currentStatus} to ${targetStatus}.`,
        );
      }

      const updated = await tx.user.update({
        where: { id },
        data: {
          status: targetStatus,
          updatedAt: new Date(),
        },
        include: { role: true },
      });

      // Audit trail logging
      await tx.auditLog
        .create({
          data: {
            action: 'UPDATE',
            entity: 'User',
            entityType: 'USER',
            entityId: id,
            userId: id,
            performedById: actorId || null,
            oldValue: { status: currentStatus },
            newValue: { status: targetStatus, reason: reason || null },
            module: 'USER_MANAGEMENT',
          },
        })
        .catch(() => {});

      return UserMapper.toResponse(updated);
    });
  }

  async lockUser(id: string, actorId?: string, actor?: any) {
    return this.updateStatus(
      id,
      UserStatus.SUSPENDED,
      'User locked by administrator',
      actorId,
      actor,
    );
  }

  async unlockUser(id: string, actorId?: string, actor?: any) {
    return this.updateStatus(
      id,
      UserStatus.ACTIVE,
      'User unlocked by administrator',
      actorId,
      actor,
    );
  }

  async update(id: string, dto: any, actor?: any) {
    await this.findById(id, actor);
    const updateData: any = {};
    if (dto.firstName) updateData.firstName = dto.firstName;
    if (dto.lastName) updateData.lastName = dto.lastName;
    if (dto.phone) updateData.phone = dto.phone;
    if (dto.email) updateData.email = dto.email;
    if (dto.status) updateData.status = dto.status;
    if (dto.collectContacts !== undefined) {
      const targetUser = await this.userRepository.findById(id);
      const targetRole = targetUser?.role?.type;
      if (dto.collectContacts === true && targetRole !== RoleType.AGENT) {
        throw new BadRequestException(
          'Contact collection preference can only be enabled for agent users',
        );
      }
      updateData.collectContacts =
        targetRole === RoleType.AGENT && dto.collectContacts === true;
    }
    if (dto.role) {
      const role = await this.userRepository.findRoleByType(dto.role);
      if (role) {
        updateData.role = { connect: { id: role.id } };
      }
    }
    const updated = await this.userRepository.update(id, updateData);
    return UserMapper.toResponse(updated);
  }

  async delete(id: string, actor?: any) {
    await this.findById(id, actor);
    const deleted = await this.userRepository.softDelete(id);
    return UserMapper.toResponse(deleted);
  }

  async findByEmailForAuth(email: string) {
    return this.userRepository.findByEmail(email);
  }

  async updateLastLogin(userId: string): Promise<any> {
    return this.userRepository.updateLastLogin(userId);
  }

  async storeRefreshToken(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    return this.userRepository.storeRefreshToken(data);
  }

  async findActiveRefreshTokens(userId: string) {
    return this.userRepository.findActiveRefreshTokens(userId);
  }

  async findUserRefreshTokens(userId: string) {
    return this.userRepository.findUserRefreshTokens(userId);
  }

  async revokeRefreshToken(tokenId: string): Promise<void> {
    return this.userRepository.revokeRefreshToken(tokenId);
  }

  async revokeAllUserRefreshTokens(userId: string): Promise<void> {
    return this.userRepository.revokeAllUserRefreshTokens(userId);
  }

  async createAuditLog(data: {
    userId: string;
    action: AuditAction;
    entity: string;
    entityId: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    return this.userRepository.createAuditLog(data);
  }
  /**
   * Retrieves commissions exclusively for the specified employee with company-scoped authorization.
   * Replaces unsafe local frontend name matching with authoritative database-scoped retrieval.
   */
  async getEmployeeCommissions(userId: string, actor: any) {
    const isSuperAdmin = PlatformPrivilegeResolver.isPlatformAdmin(actor);
    const callerCompanyId = actor?.companyId || actor?.organizationId;

    const targetUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        companyId: true,
        firstName: true,
        lastName: true,
        status: true,
        role: { select: { type: true, name: true } },
      },
    });

    if (!targetUser) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    if (!isSuperAdmin) {
      if (!callerCompanyId) {
        throw new ForbiddenException('Tenant organizational context is required');
      }
      if (targetUser.companyId !== callerCompanyId) {
        throw new ForbiddenException('User belongs to another organization');
      }
    }

    const effectiveCompanyId = targetUser.companyId || callerCompanyId;

    const commissions = await this.prisma.commission.findMany({
      where: {
        userId: targetUser.id,
        ...(effectiveCompanyId
          ? {
              OR: [
                { companyId: effectiveCompanyId },
                { user: { companyId: effectiveCompanyId } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const policyIds = commissions.map((c) => c.policyId).filter(Boolean);
    const policies =
      policyIds.length > 0
        ? await this.prisma.policy.findMany({
            where: {
              id: { in: policyIds },
              ...(effectiveCompanyId ? { companyId: effectiveCompanyId } : {}),
              deletedAt: null,
            },
            select: {
              id: true,
              policyNumber: true,
              premiumAmount: true,
              contact: { select: { firstName: true, lastName: true } },
            },
          })
        : [];
    const policyMap = new Map(policies.map((p) => [p.id, p]));

    // Audit access where required by financial data audit policy
    await this.prisma.auditLog.create({
      data: {
        action: AuditAction.LOGIN,
        entity: 'Commission',
        entityType: 'COMMISSION_ACCESS',
        entityId: targetUser.id,
        performedById: actor?.userId || actor?.id || null,
        metadata: {
          targetUserId: targetUser.id,
          companyId: effectiveCompanyId,
          recordsCount: commissions.length,
          endpoint: '/admin/users/:userId/commissions',
        },
        module: 'FINANCE_AUDIT',
      },
    });

    return commissions.map((c) => {
      const pol = policyMap.get(c.policyId);
      const grossPremium = pol ? Number(pol.premiumAmount) : Number(c.amount);
      const customerName = pol?.contact
        ? `${pol.contact.firstName} ${pol.contact.lastName || ''}`.trim()
        : 'Customer';
      const policyNumber =
        pol?.policyNumber || `POL-${c.policyId.slice(0, 8).toUpperCase()}`;

      return {
        id: c.id,
        policyId: c.policyId,
        policyNumber,
        customerName,
        userId: targetUser.id,
        agentName: `${targetUser.firstName || ''} ${targetUser.lastName || ''}`.trim(),
        roleTier: c.roleTier || 'AGENT',
        grossPremium,
        amount: Number(c.amount),
        commissionAmount: Number(c.amount),
        status: c.status,
        payoutStatus:
          c.status === 'PAID'
            ? 'PAID'
            : c.status === 'APPROVED'
              ? 'APPROVED'
              : 'PENDING',
        createdAt: c.createdAt,
      };
    });
  }

  /**
   * Retrieves performance incentives exclusively for the specified employee with company-scoped authorization.
   * Replaces unsafe local frontend name matching with authoritative database-scoped retrieval.
   */
  async getEmployeeIncentives(userId: string, actor: any) {
    const isSuperAdmin = PlatformPrivilegeResolver.isPlatformAdmin(actor);
    const callerCompanyId = actor?.companyId || actor?.organizationId;

    const targetUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        companyId: true,
        firstName: true,
        lastName: true,
        status: true,
      },
    });

    if (!targetUser) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    if (!isSuperAdmin) {
      if (!callerCompanyId) {
        throw new ForbiddenException('Tenant organizational context is required');
      }
      if (targetUser.companyId !== callerCompanyId) {
        throw new ForbiddenException('User belongs to another organization');
      }
    }

    const effectiveCompanyId = targetUser.companyId || callerCompanyId;

    const targets = await this.prisma.salesTarget.findMany({
      where: {
        userId: targetUser.id,
        ...(effectiveCompanyId
          ? { user: { companyId: effectiveCompanyId } }
          : {}),
      },
      orderBy: { year: 'desc' },
      take: 50,
    });

    // Audit access where required by financial data audit policy
    await this.prisma.auditLog.create({
      data: {
        action: AuditAction.LOGIN,
        entity: 'SalesTarget',
        entityType: 'INCENTIVE_ACCESS',
        entityId: targetUser.id,
        performedById: actor?.userId || actor?.id || null,
        metadata: {
          targetUserId: targetUser.id,
          companyId: effectiveCompanyId,
          recordsCount: targets.length,
          endpoint: '/admin/users/:userId/incentives',
        },
        module: 'FINANCE_AUDIT',
      },
    });

    return targets.map((t) => ({
      id: t.id,
      userId: targetUser.id,
      employeeName:
        `${targetUser.firstName || ''} ${targetUser.lastName || ''}`.trim() ||
        'Employee',
      role: 'Sales Executive',
      type: 'QUARTERLY_TARGET',
      year: t.year,
      month: t.month,
      targetAmount: Number(t.targetGwp || 100000),
      achievedAmount: Number(t.achievedGwp || 0),
      incentiveAmount: null,
      status: 'POLICY_PENDING',
      policyStatus: 'PENDING_APPROVAL',
      note: 'Incentive calculation pending executive business policy approval (INC-B01)',
    }));
  }
}
