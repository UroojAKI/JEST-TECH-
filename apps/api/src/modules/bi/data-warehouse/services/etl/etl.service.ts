import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../../database/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class EtlService {
  private readonly logger = new Logger(EtlService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Transforms a Policy from the OLTP schema into the Analytics Star Schema.
   */
  async extractAndLoadPolicy(policyId: string) {
    const policy = await this.prisma.policy.findUnique({
      where: { id: policyId },
      include: {
        contact: true,
        user: { include: { branch: true } }, // Agent
        product: { include: { insurer: true } },
      },
    });

    if (!policy) return;

    // 1. Ensure Dimensions Exist
    // Date Dimension
    const date = policy.createdAt;
    const dateId = date.toISOString().split('T')[0]; // YYYY-MM-DD
    await this.ensureDimDate(dateId, date);

    // Branch Dimension
    const branchId = policy.user?.branchId || 'UNKNOWN';
    if (policy.user?.branch) {
      await this.prisma.dimBranch.upsert({
        where: { id: branchId },
        create: {
          id: branchId,
          name: policy.user.branch.name,
          region: policy.user.branch.regionId,
        },
        update: {
          name: policy.user.branch.name,
          region: policy.user.branch.regionId,
        },
      });
    }

    // Agent Dimension
    await this.prisma.dimAgent.upsert({
      where: { id: policy.userId },
      create: {
        id: policy.userId,
        name: `${policy.user?.firstName || ''} ${policy.user?.lastName || ''}`,
        role: 'AGENT',
        branchId,
      },
      update: {
        name: `${policy.user?.firstName || ''} ${policy.user?.lastName || ''}`,
      },
    });

    // Customer Dimension
    await this.prisma.dimCustomer.upsert({
      where: { id: policy.contactId },
      create: {
        id: policy.contactId,
        name: `${policy.contact.firstName} ${policy.contact.lastName}`,
        type: policy.contact.type,
      },
      update: {
        name: `${policy.contact.firstName} ${policy.contact.lastName}`,
        type: policy.contact.type,
      },
    });

    // Product Dimension
    await this.prisma.dimProduct.upsert({
      where: { id: policy.productId },
      create: {
        id: policy.productId,
        name: policy.product.name,
        category: policy.product.category,
        insurer: policy.product.insurer.name,
      },
      update: {
        name: policy.product.name,
        category: policy.product.category,
        insurer: policy.product.insurer.name,
      },
    });

    // 2. Load Fact
    await this.prisma.factPolicy.upsert({
      where: { id: policy.id },
      create: {
        id: policy.id,
        dateId,
        branchId,
        agentId: policy.userId,
        customerId: policy.contactId,
        productId: policy.productId,
        premiumAmount: policy.premiumAmount,
        commissionAmt: new Decimal(0), // Would come from commission logic
        status: policy.status,
      },
      update: {
        status: policy.status,
        premiumAmount: policy.premiumAmount,
      },
    });

    this.logger.log(`ETL processed FactPolicy for ${policy.id}`);
  }

  private async ensureDimDate(dateId: string, date: Date) {
    const existing = await this.prisma.dimDate.findUnique({
      where: { dateId },
    });
    if (!existing) {
      await this.prisma.dimDate.create({
        data: {
          dateId,
          date,
          year: date.getFullYear(),
          month: date.getMonth() + 1,
          day: date.getDate(),
          quarter: Math.floor(date.getMonth() / 3) + 1,
          dayOfWeek: date.getDay(),
        },
      });
    }
  }
}
