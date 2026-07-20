import { Injectable } from '@nestjs/common';
import {
  WorkflowEntityType,
  ProposalStatus,
  PolicyStatus,
} from '@prisma/client';
import { WorkflowEntityAdapter } from '../../platform/workflow/interfaces/workflow-entity-adapter.interface';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class ProposalWorkflowAdapter implements WorkflowEntityAdapter {
  constructor(private readonly prisma: PrismaService) {}

  supports(entityType: WorkflowEntityType): boolean {
    return entityType === WorkflowEntityType.PROPOSAL;
  }

  async getCurrentState(entityId: string): Promise<string> {
    const prop = await this.prisma.proposal.findUnique({
      where: { id: entityId },
      select: { status: true },
    });
    if (!prop) throw new Error(`Proposal with ID ${entityId} not found`);
    return prop.status;
  }

  async updateState(
    entityId: string,
    stateCode: string,
    tx?: any,
  ): Promise<void> {
    const prismaTx = tx || this.prisma;
    const status = stateCode as ProposalStatus;

    const currentProp = await prismaTx.proposal.findUnique({
      where: { id: entityId },
      select: { version: true },
    });
    const nextVersion = ((currentProp?.version || 1) as number) + 1;

    if (status === ProposalStatus.APPROVED) {
      const prop = await prismaTx.proposal.findUnique({
        where: { id: entityId },
        include: { quotation: true },
      });
      if (!prop) throw new Error(`Proposal with ID ${entityId} not found`);

      const result =
        await prismaTx.$queryRaw`SELECT nextval('policy_number_seq')`;
      const nextval = result[0].nextval;
      const policyNumber = `POL-${nextval.toString().padStart(6, '0')}`;

      await prismaTx.policy.create({
        data: {
          policyNumber,
          status: PolicyStatus.ACTIVE,
          quotationId: prop.quotationId,
          contactId: prop.contactId,
          premiumAmount: prop.quotation.totalPremium,
          effectiveDate: new Date(),
          expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          proposalId: prop.id,
        },
      });

      await prismaTx.proposal.update({
        where: { id: entityId },
        data: {
          status: ProposalStatus.POLICY_ISSUED,
          approvedAt: new Date(),
          version: nextVersion,
        },
      });
    } else {
      const extraData: any = {};
      if (status === ProposalStatus.SUBMITTED) {
        extraData.submittedAt = new Date();
      }
      await prismaTx.proposal.update({
        where: { id: entityId },
        data: {
          status,
          version: nextVersion,
          ...extraData,
        },
      });
    }
  }

  async getVariables(entityId: string): Promise<Record<string, any>> {
    const prop = await this.prisma.proposal.findUnique({
      where: { id: entityId },
      include: { quotation: true },
    });
    if (!prop) throw new Error(`Proposal with ID ${entityId} not found`);
    return {
      premiumAmount: Number(prop.quotation?.totalPremium) || 0,
      basePremium: Number(prop.quotation?.basePremium) || 0,
      status: prop.status,
    };
  }
}
