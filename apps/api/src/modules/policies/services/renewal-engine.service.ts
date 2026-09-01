import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Policy, PolicyStatus } from '@prisma/client';

@Injectable()
export class RenewalEngineService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('renewal-reminders') private readonly renewalQueue: Queue,
  ) {}

  async findPoliciesRequiringRenewal(
    daysBeforeExpiry: number,
  ): Promise<Policy[]> {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysBeforeExpiry);

    return this.prisma.policy.findMany({
      where: {
        status: PolicyStatus.ACTIVE,
        expiryDate: {
          lte: targetDate,
          gte: new Date(),
        },
        renewalTasks: {
          none: {
            status: 'PENDING',
          },
        },
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
    const policy = await this.prisma.policy.findUnique({
      where: { id: policyId },
    });
    if (!policy) return;

    await this.prisma.renewalTask.create({
      data: {
        policyId,
        agentId,
        dueDate: policy.expiryDate,
        status: 'PENDING',
        priority: 'MEDIUM',
      },
    });
  }

  async queueRenewalReminders(
    policyId: string,
    expiryDate: Date,
  ): Promise<void> {
    const policy = await this.prisma.policy.findUnique({
      where: { id: policyId },
    });
    if (!policy) return;

    // RENEW-001: Configuration-driven renewal reminder schedule with canonical fallbacks
    const config = await this.prisma.renewalConfiguration.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    const reminderOffsets: number[] = (config?.reminderOffsets as number[]) ?? [
      45, 30, 15, 7, 5, 3, 2, 1,
    ];
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
          {
            delay,
            jobId: `renewal-reminder:${policy.id}:${days}`,
          },
        );
      }
    }
  }

  async getRenewalPipeline(user: any, pagination: any) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 60);

    const policies = await this.prisma.policy.findMany({
      where: {
        status: PolicyStatus.ACTIVE,
        expiryDate: { lte: targetDate },
      },
      include: {
        renewalTasks: true,
        contact: true,
        quotation: true,
      },
      skip: pagination?.skip ? parseInt(pagination.skip, 10) : 0,
      take: pagination?.take ? parseInt(pagination.take, 10) : 10,
    });

    return {
      data: policies,
      total: policies.length,
    };
  }

  async getRenewalQueue(params?: {
    search?: string;
    urgency?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(params?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params?.limit) || 20));
    const skip = (page - 1) * limit;

    const sixtyDaysFromNow = new Date();
    sixtyDaysFromNow.setDate(sixtyDaysFromNow.getDate() + 60);

    const policies = await this.prisma.policy.findMany({
      where: {
        status: { in: [PolicyStatus.ACTIVE, PolicyStatus.PENDING_RENEWAL] },
        expiryDate: { lte: sixtyDaysFromNow },
      },
      include: {
        contact: true,
        claims: {
          select: { id: true, status: true },
        },
        quotation: true,
        renewalTasks: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
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
      const expiryMs = new Date(p.expiryDate).getTime();
      const daysRemaining = Math.ceil((expiryMs - now) / 86400000);

      let urgency: 'EXPIRED' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
      if (daysRemaining < 0) {
        urgency = 'EXPIRED';
      } else if (daysRemaining <= 7) {
        urgency = 'CRITICAL';
        criticalCount++;
      } else if (daysRemaining <= 15) {
        urgency = 'HIGH';
        highCount++;
      } else if (daysRemaining <= 30) {
        urgency = 'MEDIUM';
        mediumCount++;
      } else {
        urgency = 'LOW';
        lowCount++;
      }

      // Check claims for NCB roll-over rule
      const hasClaims = p.claims && p.claims.length > 0;
      const currentNcb = Number(p.quotation?.ncbPercentage || 20);
      const nextNcb = hasClaims ? 0 : this.calculateNextNCBSlab(currentNcb);

      const basePrem = Number(p.premiumAmount || 0);
      const estimatedRenewalPremium = Math.round(
        basePrem * (1 - nextNcb / 100),
      );

      const vehicleMeta = (p.motorMetadata as Record<string, any>) || {};
      const regNumber = vehicleMeta.registrationNumber || 'N/A';

      const item = {
        id: p.id,
        policyNumber: p.policyNumber,
        customerName: p.contact
          ? `${p.contact.firstName} ${p.contact.lastName || ''}`.trim()
          : 'Customer',
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
        registrationNumber: regNumber,
        insurerName: p.quotation?.insurerName || 'HDFC ERGO',
        escalated:
          p.renewalTasks?.[0]?.priority === 'CRITICAL' ||
          p.renewalTasks?.[0]?.priority === 'HIGH',
      };

      if (params?.urgency && params.urgency !== 'ALL') {
        if (item.urgency !== params.urgency) continue;
      }

      if (params?.search && params.search.trim()) {
        const q = params.search.toLowerCase().trim();
        const matches =
          item.policyNumber.toLowerCase().includes(q) ||
          item.customerName.toLowerCase().includes(q) ||
          item.registrationNumber.toLowerCase().includes(q);
        if (!matches) continue;
      }

      items.push(item);
    }

    const total = items.length;
    return {
      data: items.slice(skip, skip + limit),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
      summary: {
        totalExpiring: items.length,
        criticalCount,
        highCount,
        mediumCount,
        lowCount,
      },
    };
  }

  async triggerManualReminder(policyId: string, actorId: string) {
    const policy = await this.prisma.policy.findUnique({
      where: { id: policyId },
      include: { contact: true },
    });

    if (!policy) {
      return { success: false, message: `Policy ${policyId} not found` };
    }

    await this.renewalQueue.add('send-renewal-reminder', {
      policyId: policy.id,
      policyNumber: policy.policyNumber,
      expiryDate: policy.expiryDate,
      customerId: policy.contactId,
      agentId: actorId,
      daysBefore: 0,
      isManualTrigger: true,
    });

    return {
      success: true,
      message: `Renewal reminder dispatched for policy ${policy.policyNumber} to ${policy.contact?.phone || policy.contact?.email}`,
    };
  }

  async escalateRenewal(policyId: string, actorId: string) {
    const policy = await this.prisma.policy.findUnique({
      where: { id: policyId },
    });
    if (!policy) {
      return { success: false, message: `Policy ${policyId} not found` };
    }

    const existingTask = await this.prisma.renewalTask.findFirst({
      where: { policyId },
    });

    if (existingTask) {
      await this.prisma.renewalTask.update({
        where: { id: existingTask.id },
        data: { priority: 'CRITICAL' },
      });
    } else {
      await this.prisma.renewalTask.create({
        data: {
          policyId,
          agentId: actorId,
          dueDate: policy.expiryDate,
          status: 'PENDING',
          priority: 'CRITICAL',
        },
      });
    }

    return {
      success: true,
      message: `Policy ${policy.policyNumber} renewal successfully escalated to Branch Management.`,
    };
  }
}
