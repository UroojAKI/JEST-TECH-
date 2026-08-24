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

  async findPoliciesRequiringRenewal(daysBeforeExpiry: number): Promise<Policy[]> {
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
    const policy = await this.prisma.policy.findUnique({ where: { id: policyId } });
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

  async queueRenewalReminders(policyId: string, expiryDate: Date): Promise<void> {
    const policy = await this.prisma.policy.findUnique({ 
        where: { id: policyId }
    });
    if (!policy) return;

    const daysList = [60, 45, 30, 15, 7, 0, -7];
    
    for (const days of daysList) {
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
          },
          { delay }
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
}
