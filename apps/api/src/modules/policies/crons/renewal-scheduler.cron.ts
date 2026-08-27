import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../../database/prisma.service';
import { PolicyStatus } from '@prisma/client';

@Injectable()
export class RenewalSchedulerCron {
  private readonly logger = new Logger(RenewalSchedulerCron.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('renewal-reminders') private readonly renewalQueue: Queue,
  ) {}

  @Cron('0 2 * * *')
  async handleCron() {
    await this.runManually();
  }

  async runManually() {
    this.logger.log('Starting multi-offset renewal scheduler scan...');
    try {
      const now = new Date();
      let totalQueued = 0;

      // 1. Scan for policies in multiple offset tiers: [45, 30, 15, 7, 0, -1]
      const offsets = [45, 30, 15, 7, 0, -1];

      for (const offset of offsets) {
        let policies: any[] = [];

        if (offset === -1) {
          // Overdue: expired policies not yet marked LAPSED
          policies = await this.prisma.policy.findMany({
            where: {
              status: { in: [PolicyStatus.ACTIVE, PolicyStatus.PENDING_RENEWAL] },
              expiryDate: { lt: now },
            },
          });
        } else {
          // Future expiring window for this specific offset
          const windowStart = new Date(now);
          windowStart.setDate(windowStart.getDate() + Math.max(0, offset - 2));
          const windowEnd = new Date(now);
          windowEnd.setDate(windowEnd.getDate() + offset + 2);

          policies = await this.prisma.policy.findMany({
            where: {
              status: { in: [PolicyStatus.ACTIVE, PolicyStatus.PENDING_RENEWAL] },
              expiryDate: { gte: windowStart, lte: windowEnd },
            },
          });
        }

        for (const policy of policies) {
          // Ensure RenewalTask exists if within 30 days
          if (offset <= 30 && offset >= 0 && policy.createdById) {
            const existingTask = await this.prisma.renewalTask.findFirst({
              where: { policyId: policy.id, status: 'PENDING' },
            });

            if (!existingTask) {
              await this.prisma.renewalTask.create({
                data: {
                  policyId: policy.id,
                  agentId: policy.createdById,
                  dueDate: policy.expiryDate,
                  status: 'PENDING',
                  priority: offset <= 7 ? 'HIGH' : 'MEDIUM',
                },
              });
            }
          }

          // Enqueue reminder job
          await this.renewalQueue.add('send-renewal-reminder', {
            policyId: policy.id,
            policyNumber: policy.policyNumber,
            expiryDate: policy.expiryDate,
            customerId: policy.contactId,
            agentId: policy.createdById,
            daysBefore: offset,
          });

          totalQueued++;
        }
      }

      this.logger.log(`Multi-offset renewal scan completed. Queued ${totalQueued} jobs.`);
      return { success: true, totalQueued };
    } catch (error: any) {
      this.logger.error('Failed to run renewal scheduler scan', error);
      return { success: false, error: error.message };
    }
  }
}
