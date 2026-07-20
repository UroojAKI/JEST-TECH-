import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../../../database/prisma.service';

@Injectable()
export class SlaMonitorService {
  private readonly logger = new Logger(SlaMonitorService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkSlaBreaches() {
    this.logger.log('Running SLA Monitor Cron Job...');

    // In a real implementation, we would query leads that are in 'NEW' status
    // and see if the difference between now() and createdAt exceeds firstResponseMin
    // from their applicable SlaPolicy.

    const policies = await this.prisma.slaPolicy.findMany({
      where: { targetEntity: 'LEAD', isActive: true },
    });

    for (const policy of policies) {
      if (!policy.firstResponseMin) continue;

      const breachThreshold = new Date();
      breachThreshold.setMinutes(
        breachThreshold.getMinutes() - policy.firstResponseMin,
      );

      // Find leads created before breachThreshold that don't have firstResponseAt set
      const breachedLeads = await this.prisma.lead.findMany({
        where: {
          firstResponseAt: null,
          createdAt: { lt: breachThreshold },
          slaStatus: { not: 'BREACHED' },
        },
      });

      for (const lead of breachedLeads) {
        this.logger.warn(
          `Lead ${lead.id} breached SLA for policy ${policy.name}`,
        );

        await this.prisma.$transaction([
          this.prisma.slaViolation.create({
            data: {
              entityType: 'LEAD',
              entityId: lead.id,
              policyId: policy.id,
              breachType: 'FIRST_RESPONSE',
            },
          }),
          this.prisma.lead.update({
            where: { id: lead.id },
            data: { slaStatus: 'BREACHED' },
          }),
        ]);
      }
    }
  }
}
