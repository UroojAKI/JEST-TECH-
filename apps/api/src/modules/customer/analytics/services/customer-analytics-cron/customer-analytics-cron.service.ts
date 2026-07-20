import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../../../database/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class CustomerAnalyticsCronService {
  private readonly logger = new Logger(CustomerAnalyticsCronService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async recalculateCustomerAnalytics() {
    this.logger.log('Starting nightly Customer Analytics recalculation...');

    const contacts = await this.prisma.contact.findMany({
      select: { id: true },
    });

    for (const contact of contacts) {
      await this.calculateMetricsForCustomer(contact.id);
    }

    this.logger.log('Finished nightly Customer Analytics recalculation.');
  }

  async calculateMetricsForCustomer(contactId: string) {
    // 1. Fetch related data
    const activePolicies = await this.prisma.policy.count({
      where: { contactId, status: 'ACTIVE' },
    });

    const expiredPolicies = await this.prisma.policy.count({
      where: { contactId, status: 'EXPIRED' },
    });

    const policies = await this.prisma.policy.findMany({
      where: { contactId },
      select: { premiumAmount: true },
    });

    const claims = await this.prisma.claim.findMany({
      where: { contactId },
      select: { amount: true },
    });

    // 2. Compute Lifetime values
    let lifetimePremium = new Decimal(0);
    policies.forEach((p) => {
      lifetimePremium = lifetimePremium.add(p.premiumAmount);
    });

    let lifetimeClaims = new Decimal(0);
    claims.forEach((c) => {
      lifetimeClaims = lifetimeClaims.add(c.amount);
    });

    // Lifetime Value: In a brokerage, this is usually total commissions earned.
    // Simplified here as a rough net metric, or could be fetched from Finance module.
    // Assuming LTV is 15% of lifetime premium for illustration.
    const lifetimeValue = lifetimePremium.mul(0.15);

    let claimRatio = new Decimal(0);
    if (lifetimePremium.gt(0)) {
      claimRatio = lifetimeClaims.div(lifetimePremium).mul(100);
    }

    // 3. Compute Probabilities (Simplified algorithm)
    let renewalProbability = 80;
    let churnProbability = 20;

    if (claimRatio.gt(100)) {
      renewalProbability -= 20; // Bad claims experience might mean they leave
      churnProbability += 20;
    }

    if (expiredPolicies > activePolicies) {
      renewalProbability -= 10;
      churnProbability += 10;
    }

    // Ensure within 0-100 bounds
    renewalProbability = Math.max(0, Math.min(100, renewalProbability));
    churnProbability = Math.max(0, Math.min(100, churnProbability));

    // 4. Upsert Analytics
    await this.prisma.customerAnalytics.upsert({
      where: { contactId },
      create: {
        contactId,
        lifetimePremium,
        lifetimeClaims,
        lifetimeValue,
        activePolicies,
        expiredPolicies,
        claimRatio,
        renewalProbability,
        churnProbability,
        customerRiskScore: churnProbability, // Simplified mapping
        healthScore: renewalProbability,
      },
      update: {
        lifetimePremium,
        lifetimeClaims,
        lifetimeValue,
        activePolicies,
        expiredPolicies,
        claimRatio,
        renewalProbability,
        churnProbability,
        customerRiskScore: churnProbability,
        healthScore: renewalProbability,
        lastCalculatedAt: new Date(),
      },
    });
  }
}
