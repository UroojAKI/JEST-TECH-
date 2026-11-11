import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { LegacyPolicyStatus, RoleType } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../database/prisma.service';

const DECLARATION = 'I confirm that this policy was already issued by the insurer and that I have verified the supplied policy details and document offline. This declaration does not represent a JEST inspection or underwriting approval.';

@Injectable()
export class LegacyPoliciesService {
  constructor(private readonly prisma: PrismaService) {}

  private scope(user: any) {
    if (!user?.id || !user?.companyId) throw new ForbiddenException('Authenticated company user required');
    if (user.role !== RoleType.AGENT) throw new ForbiddenException('Only agents may register historical policies');
    return { userId: user.id as string, companyId: user.companyId as string };
  }

  async create(dto: any, user: any) {
    const { userId, companyId } = this.scope(user);
    if (!!dto.customerId === !!dto.contactId) throw new BadRequestException('Provide exactly one customerId or contactId');
    if (dto.agentDeclaration !== true) throw new BadRequestException('Agent declaration is mandatory');
    if (!dto.evidenceDocumentId) throw new BadRequestException('Insurer-issued policy document is mandatory');
    if (!dto.insurerName?.trim() || !dto.insurerPolicyNumber?.trim() || !dto.productType?.trim()) throw new BadRequestException('Insurer, insurer policy number and product type are required');

    const start = new Date(dto.policyStartDate);
    const expiry = new Date(dto.policyExpiryDate);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(expiry.getTime()) || expiry <= start) throw new BadRequestException('Valid policy dates are required and expiry must be after start date');
    const premium = Number(dto.premiumAmount);
    if (!Number.isFinite(premium) || premium < 0) throw new BadRequestException('Premium must be a non-negative number');

    if (dto.customerId) {
      const customer = await this.prisma.customer.findFirst({ where: { id: dto.customerId, companyId, deletedAt: null } });
      if (!customer) throw new NotFoundException('Customer not found in your company');
      const agent = await this.prisma.agent.findFirst({ where: { userId, companyId } });
      if (customer.primaryAgentId && customer.primaryAgentId !== agent?.id) throw new ForbiddenException('Customer is assigned to another agent');
    }
    if (dto.contactId) {
      const contact = await this.prisma.contact.findFirst({ where: { id: dto.contactId, companyId, deletedAt: null } });
      if (!contact) throw new NotFoundException('Contact not found in your company');
      const agent = await this.prisma.agent.findFirst({ where: { userId, companyId } });
      if (contact.assignedAgentId && contact.assignedAgentId !== agent?.id) throw new ForbiddenException('Contact is assigned to another agent');
    }

    const entityId = dto.customerId || dto.contactId;
    const entityType = dto.customerId ? 'CUSTOMER' : 'CONTACT';
    const document = await this.prisma.document.findFirst({
      where: {
        id: dto.evidenceDocumentId, entityId, entityType, deletedAt: null, status: 'ACTIVE',
        uploadedById: userId,
        uploadedBy: { companyId },
      },
      select: { id: true },
    });
    if (!document) throw new BadRequestException('Evidence must be an active insurer-issued policy document uploaded by you and associated with the selected customer/contact');

    const normalizedInsurer = dto.insurerName.trim();
    const normalizedNumber = dto.insurerPolicyNumber.trim();
    const duplicate = await this.prisma.legacyPolicyRecord.findFirst({
      where: { companyId, insurerName: { equals: normalizedInsurer, mode: 'insensitive' }, insurerPolicyNumber: { equals: normalizedNumber, mode: 'insensitive' } },
      select: { id: true },
    });
    if (duplicate) throw new BadRequestException('This insurer policy number is already registered in your company');

    const now = new Date();
    const status = expiry > now ? LegacyPolicyStatus.ACTIVE : LegacyPolicyStatus.EXPIRED;
    const record = await this.prisma.legacyPolicyRecord.create({
      data: {
        legacyPolicyNumber: `LEG-${randomUUID()}`,
        insurerName: normalizedInsurer,
        insurerPolicyNumber: normalizedNumber,
        productType: dto.productType.trim(),
        coverageDescription: dto.coverageDescription?.trim() || null,
        premiumAmount: premium,
        policyStartDate: start,
        policyExpiryDate: expiry,
        issueDate: dto.issueDate ? new Date(dto.issueDate) : null,
        status,
        customerId: dto.customerId || null,
        contactId: dto.contactId || null,
        companyId,
        evidenceDocumentId: document.id,
        agentDeclaration: true,
        declarationText: DECLARATION,
        createdById: userId,
      },
    });

    const offsets = [45, 30, 15, 7, 0, -1];
    await this.prisma.legacyPolicyRenewalReminder.createMany({
      data: offsets.map(offsetDays => {
        const dueDate = new Date(expiry);
        dueDate.setDate(dueDate.getDate() - offsetDays);
        return { legacyPolicyId: record.id, offsetDays, dueDate };
      }),
    });
    return { ...record, renewalTracking: 'SCHEDULED', declarationText: DECLARATION };
  }

  async findAll(user: any) {
    const { userId, companyId } = this.scope(user);
    const agent = await this.prisma.agent.findFirst({ where: { userId, companyId }, select: { id: true } });
    return this.prisma.legacyPolicyRecord.findMany({
      where: {
        companyId,
        OR: [
          { createdById: userId },
          ...(agent?.id ? [{ customer: { primaryAgentId: agent.id } }, { contact: { assignedAgentId: agent.id } }] : []),
        ],
      },
      include: { reminders: { orderBy: { dueDate: 'asc' } } },
      orderBy: { policyExpiryDate: 'asc' },
    });
  }

  async findOne(id: string, user: any) {
    const rows = await this.findAll(user);
    const record = rows.find(row => row.id === id);
    if (!record) throw new NotFoundException('Legacy policy not found');
    return record;
  }

  async upcoming(user: any) {
    const rows = await this.findAll(user);
    const ids = rows.map(row => row.id);
    if (!ids.length) return [];
    return this.prisma.legacyPolicyRenewalReminder.findMany({
      where: { legacyPolicyId: { in: ids }, status: 'PENDING', dueDate: { lte: new Date(Date.now() + 45 * 86400000) } },
      include: { legacyPolicy: true },
      orderBy: { dueDate: 'asc' },
    });
  }
}
