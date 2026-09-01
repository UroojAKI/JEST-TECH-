import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Policy, PolicyStatus, RoleType } from '@prisma/client';
import { ActorContext } from '../../../common/interfaces/actor-context.interface';

const GLOBAL_ROLES: RoleType[] = [
  RoleType.SUPER_ADMIN,
  RoleType.ADMIN,
  RoleType.SYSTEM_ADMINISTRATOR,
  RoleType.MD_CEO,
];

@Injectable()
export class RenewalEngineService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('renewal-reminders') private readonly renewalQueue: Queue,
  ) {}

  async findPoliciesRequiringRenewal(daysBeforeExpiry: number): Promise<Policy[]> {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysBeforeExpiry);

    return this.prisma.policy.findMany({
      where: {
        status: PolicyStatus.ACTIVE,
        expiryDate: { lte: targetDate, gte: new Date() },
        renewalTasks: { none: { status: 'PENDING' } },
      },
    });
  }

  calculateNextNCBSlab(currentNCB: number): number {
    if (currentNCB < 20) return 20;
    if (currentNCB < 25) return 25;
    if (currentNCB < 35) return 35;
    if (currentNCB < 45) return 45;
    return 50;
  }

  async createRenewalRecord(policyId: string, agentId: string): Promise<void> {
    const policy = await this.prisma.policy.findUnique({ where: { id: policyId } });
    if (!policy) return;

    await this.prisma.renewalTask.upsert({
      where: { policyId_offsetDays: { policyId, offsetDays: 30 } },
      create: {
        policyId,
        agentId,
        dueDate: policy.expiryDate,
        offsetDays: 30,
        status: 'PENDING',
        priority: 'MEDIUM',
      },
      update: { agentId, dueDate: policy.expiryDate, status: 'PENDING' },
    });
  }

  async queueRenewalReminders(policyId: string, expiryDate: Date): Promise<void> {
    const policy = await this.prisma.policy.findUnique({ where: { id: policyId } });
    if (!policy) return;

    const config = await this.prisma.renewalConfiguration.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    const reminderOffsets: number[] = (config?.reminderOffsets as number[]) ?? [45, 30, 15, 7, 5, 3, 2, 1];
    const escalationOffsets = [7, 3, 1];

    for (const days of reminderOffsets) {
      const reminderDate = new Date(expiryDate);
      reminderDate.setDate(reminderDate.getDate() - days);
      const delay = reminderDate.getTime() - Date.now();
      if (delay > 0) {
        await this.renewalQueue.add(
          'send-renewal-reminder',
          {
            policyId: policy.id,
            policyNumber: policy.policyNumber,
            expiryDate: policy.expiryDate,
            customerId: policy.contactId,
            agentId: policy.createdById,
            daysBefore: days,
            isEscalation: escalationOffsets.includes(days),
          },
          { delay, jobId: `renewal-reminder:${policy.id}:${days}` },
        );
      }
    }
  }

  private async buildPolicyScope(actor: ActorContext): Promise<any> {
    const roles = actor.roles?.length ? actor.roles : [actor.role];
    if (roles.some((role) => GLOBAL_ROLES.includes(role))) return {};

    if (roles.includes(RoleType.BRANCH_MANAGER)) {
      if (!actor.branchId) throw new ForbiddenException('Branch context is required');
      return { createdBy: { branchId: actor.branchId } };
    }

    if (roles.includes(RoleType.TEAM_LEADER) || roles.includes(RoleType.SALES_MANAGER)) {
      if (!actor.teamId) throw new ForbiddenException('Team context is required');
      return { createdBy: { teamId: actor.teamId } };
    }

    if (
      roles.includes(RoleType.RENEWAL_EXECUTIVE) ||
      roles.includes(RoleType.SALES_EXECUTIVE)
    ) {
      return { renewalTasks: { some: { agentId: actor.userId } } };
    }

    return { createdById: actor.userId };
  }

  private async assertPolicyAccess(policyId: string, actor: ActorContext): Promise<void> {
    const scope = await this.buildPolicyScope(actor);
    const exists = await this.prisma.policy.findFirst({
      where: { id: policyId, deletedAt: null, ...scope },
      select: { id: true },
    });
    if (!exists) throw new ForbiddenException('You do not have access to this renewal');
  }

  async getRenewalPipeline(actor: ActorContext, pagination: any) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 60);
    const scope = await this.buildPolicyScope(actor);

    const where = {
      ...scope,
      status: PolicyStatus.ACTIVE,
      expiryDate: { lte: targetDate },
      deletedAt: null,
    };

    const [policies, total] = await Promise.all([
      this.prisma.policy.findMany({
        where,
        include: { renewalTasks: true, contact: true, quotation: true },
        skip: pagination?.skip ? Number(pagination.skip) : 0,
        take: pagination?.take ? Number(pagination.take) : 10,
        orderBy: { expiryDate: 'asc' },
      }),
      this.prisma.policy.count({ where }),
    ]);

    return { data: policies, total };
  }

  async getRenewalQueue(actor: ActorContext, params?: { search?: string; urgency?: string; page?: number; limit?: number }) {
    const page = Math.max(1, Number(params?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params?.limit) || 20));
    const skip = (page - 1) * limit;
    const sixtyDaysFromNow = new Date();
    sixtyDaysFromNow.setDate(sixtyDaysFromNow.getDate() + 60);
    const scope = await this.buildPolicyScope(actor);

    const policies = await this.prisma.policy.findMany({
      where: {
        ...scope,
        status: { in: [PolicyStatus.ACTIVE, PolicyStatus.PENDING_RENEWAL] },
        expiryDate: { lte: sixtyDaysFromNow },
        deletedAt: null,
      },
      include: {
        contact: true,
        claims: { select: { id: true, status: true } },
        quotation: true,
        renewalTasks: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { expiryDate: 'asc' },
    });

    const now = Date.now();
    const items: any[] = [];
    let criticalCount = 0;
    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;

    for (const p of policies) {
      const daysRemaining = Math.ceil((new Date(p.expiryDate).getTime() - now) / 86400000);
      let urgency: 'EXPIRED' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
      if (daysRemaining < 0) urgency = 'EXPIRED';
      else if (daysRemaining <= 7) { urgency = 'CRITICAL'; criticalCount++; }
      else if (daysRemaining <= 15) { urgency = 'HIGH'; highCount++; }
      else if (daysRemaining <= 30) { urgency = 'MEDIUM'; mediumCount++; }
      else lowCount++;

      const hasClaims = p.claims.length > 0;
      const currentNcb = Number(p.quotation?.ncbPercentage || 20);
      const nextNcb = hasClaims ? 0 : this.calculateNextNCBSlab(currentNcb);
      const basePrem = Number(p.premiumAmount || 0);
      const estimatedRenewalPremium = Math.round(basePrem * (1 - nextNcb / 100));
      const vehicleMeta = (p.motorMetadata as Record<string, any>) || {};
      const item = {
        id: p.id,
        policyNumber: p.policyNumber,
        customerName: p.contact ? `${p.contact.firstName} ${p.contact.lastName || ''}`.trim() : 'Customer',
        customerPhone: p.contact?.phone || undefined,
        customerEmail: p.contact?.email || undefined,
        expiryDate: p.expiryDate.toISOString(),
        daysRemaining,
        urgency,
        hasClaims,
        currentNcb,
        nextNcb,
        lastPremium: basePrem,
        estimatedRenewalPremium,
        registrationNumber: vehicleMeta.registrationNumber || 'N/A',
        insurerName: p.quotation?.insurerName || 'HDFC ERGO',
        escalated: p.renewalTasks?.[0]?.priority === 'CRITICAL' || p.renewalTasks?.[0]?.priority === 'HIGH',
      };

      if (params?.urgency && params.urgency !== 'ALL' && item.urgency !== params.urgency) continue;
      if (params?.search?.trim()) {
        const q = params.search.toLowerCase().trim();
        if (!item.policyNumber.toLowerCase().includes(q) && !item.customerName.toLowerCase().includes(q) && !item.registrationNumber.toLowerCase().includes(q)) continue;
      }
      items.push(item);
    }

    const total = items.length;
    return {
      data: items.slice(skip, skip + limit),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
      summary: { totalExpiring: total, criticalCount, highCount, mediumCount, lowCount },
    };
  }

  async triggerManualReminder(policyId: string, actor: ActorContext) {
    await this.assertPolicyAccess(policyId, actor);
    const policy = await this.prisma.policy.findUnique({ where: { id: policyId }, include: { contact: true } });
    if (!policy) return { success: false, message: `Policy ${policyId} not found` };

    await this.renewalQueue.add('send-renewal-reminder', {
      policyId: policy.id,
      policyNumber: policy.policyNumber,
      expiryDate: policy.expiryDate,
      customerId: policy.contactId,
      agentId: actor.userId,
      daysBefore: 0,
      isManualTrigger: true,
    });
    return { success: true, message: `Renewal reminder dispatched for policy ${policy.policyNumber} to ${policy.contact?.phone || policy.contact?.email}` };
  }

  async escalateRenewal(policyId: string, actor: ActorContext) {
    await this.assertPolicyAccess(policyId, actor);
    const policy = await this.prisma.policy.findUnique({ where: { id: policyId } });
    if (!policy) return { success: false, message: `Policy ${policyId} not found` };

    const existingTask = await this.prisma.renewalTask.findFirst({ where: { policyId }, orderBy: { createdAt: 'desc' } });
    if (existingTask) {
      await this.prisma.renewalTask.update({ where: { id: existingTask.id }, data: { priority: 'CRITICAL' } });
    } else {
      await this.prisma.renewalTask.create({ data: { policyId, agentId: actor.userId, dueDate: policy.expiryDate, status: 'PENDING', priority: 'CRITICAL', offsetDays: 0 } });
    }
    return { success: true, message: `Policy ${policy.policyNumber} renewal successfully escalated.` };
  }
}
