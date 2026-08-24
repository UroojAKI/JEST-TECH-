import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../../database/prisma.service';

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
    this.logger.log('Starting daily renewal scheduler scan...');
    try {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 60);

      const policies = await this.prisma.policy.findMany({
        where: {
          status: 'ACTIVE',
          expiryDate: {
            lte: targetDate,
            gte: new Date(),
          },
        },
      });

      let queuedCount = 0;

      for (const policy of policies) {
        const existingTask = await this.prisma.renewalTask.findFirst({
          where: { policyId: policy.id, status: 'PENDING' },
        });

        if (!existingTask && policy.createdById) {
          await this.prisma.renewalTask.create({
            data: {
              policyId: policy.id,
              agentId: policy.createdById,
              dueDate: policy.expiryDate,
              status: 'PENDING',
              priority: 'MEDIUM',
            },
          });
          
          await this.renewalQueue.add('send-renewal-reminder', {
            policyId: policy.id,
            policyNumber: policy.policyNumber,
            expiryDate: policy.expiryDate,
            customerId: policy.contactId,
            agentId: policy.createdById,
            daysBefore: 60,
          });

          queuedCount++;
        }
      }

      this.logger.log(`Renewal scan completed. Queued ${queuedCount} reminders.`);
      return { success: true, queuedCount };
    } catch (error: any) {
      this.logger.error('Failed to run renewal scheduler scan', error);
      return { success: false, error: error.message };
    }
  }
}
