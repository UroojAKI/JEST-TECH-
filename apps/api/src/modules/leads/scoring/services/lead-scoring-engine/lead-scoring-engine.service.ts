import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../database/prisma.service';
import { Lead } from '@prisma/client';

@Injectable()
export class LeadScoringEngineService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Evaluates the lead against all active LeadScoreRules and updates the lead score.
   */
  async evaluateLead(leadId: string): Promise<Lead> {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: { contact: true, account: true },
    });

    if (!lead) throw new Error('Lead not found');

    const rules = await this.prisma.leadScoreRule.findMany({
      where: { isActive: true },
    });

    let totalScore = 0;
    const logs = [];

    for (const rule of rules) {
      const isMatch = this.evaluateCondition(rule.condition, lead);

      if (isMatch) {
        totalScore += rule.points;
        logs.push({
          leadId: lead.id,
          ruleId: rule.id,
          points: rule.points,
        });
      }
    }

    let priority = 'LOW';
    if (totalScore >= 50) priority = 'HOT';
    else if (totalScore >= 20) priority = 'WARM';

    // Transaction to update lead and save logs
    const updatedLead = await this.prisma.$transaction(async (tx) => {
      if (logs.length > 0) {
        await tx.leadScoreLog.createMany({ data: logs });
      }
      return tx.lead.update({
        where: { id: lead.id },
        data: { score: totalScore, priority },
      });
    });

    return updatedLead;
  }

  private evaluateCondition(conditionJson: string, leadData: any): boolean {
    try {
      const condition = JSON.parse(conditionJson);
      // Very basic rule evaluation
      // e.g., condition = { "field": "source", "operator": "EQUALS", "value": "WEBSITE" }
      if (condition.field && condition.operator && condition.value) {
        const actualValue = leadData[condition.field];
        switch (condition.operator) {
          case 'EQUALS':
            return actualValue === condition.value;
          case 'NOT_EQUALS':
            return actualValue !== condition.value;
          case 'CONTAINS':
            return (
              typeof actualValue === 'string' &&
              actualValue.includes(condition.value)
            );
        }
      }
      return false;
    } catch (e) {
      // If not JSON, return false for now
      return false;
    }
  }
}
