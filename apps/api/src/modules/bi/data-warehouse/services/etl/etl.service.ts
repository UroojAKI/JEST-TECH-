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
        createdBy: { include: { branch: true } },
        quotation: true,
      },
    });

    if (!policy) return;

    const agent = policy.createdBy;
    const agentId = policy.createdById ?? 'UNKNOWN';
    const productId = policy.quotationId;

    // 1. Ensure Dimensions Exist
    const date = policy.createdAt;
    const dateId = date.toISOString().split('T')[0];
    await this.ensureDimDate(dateId, date);

    const branchId = agent?.branchId ?? 'UNKNOWN';
    if (agent?.branch) {
      await this.prisma.dimBranch.upsert({
        where: { id: branchId },
        create: {
          id: branchId,
          name: agent.branch.name,
          region: agent.branch.zoneId ?? undefined,
        },
        update: {
          name: agent.branch.name,
          region: agent.branch.zoneId ?? undefined,
        },
      });
    }

    if (policy.createdById && agent) {
      await this.prisma.dimAgent.upsert({
        where: { id: policy.createdById },
        create: {
          id: policy.createdById,
          name: `${agent.firstName} ${agent.lastName}`.trim(),
          role: 'AGENT',
          branchId,
        },
        update: {
          name: `${agent.firstName} ${agent.lastName}`.trim(),
        },
      });
    }

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

    await this.prisma.dimProduct.upsert({
      where: { id: productId },
      create: {
        id: productId,
        name: policy.quotation.productType,
        category: policy.quotation.productType,
        insurer: policy.quotation.insurerName,
      },
      update: {
        name: policy.quotation.productType,
        category: policy.quotation.productType,
        insurer: policy.quotation.insurerName,
      },
    });

    // 2. Load Fact
    await this.prisma.factPolicy.upsert({
      where: { id: policy.id },
      create: {
        id: policy.id,
        dateId,
        branchId,
        agentId,
        customerId: policy.contactId,
        productId,
        premiumAmount: policy.premiumAmount,
        commissionAmt: new Decimal(0),
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
