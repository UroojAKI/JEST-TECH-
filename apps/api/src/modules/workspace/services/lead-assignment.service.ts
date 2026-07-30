import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class LeadAssignmentService {
  constructor(private readonly prisma: PrismaService) {}

  async assignLead(leadId: string, assignedToId: string, assignedById: string, reason?: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException(`Lead '${leadId}' not found`);

    const updatedLead = await this.prisma.lead.update({
      where: { id: leadId },
      data: {
        assignedToId,
        updatedById: assignedById,
      },
    });

    await this.prisma.leadAssignment.create({
      data: {
        leadId,
        assignedToId,
        assignedById,
        reason: reason || 'Lead assigned via Sales Workspace',
      },
    });

    return updatedLead;
  }

  async getAssignmentHistory(leadId: string) {
    return this.prisma.leadAssignment.findMany({
      where: { leadId },
      orderBy: { assignedAt: 'desc' },
      include: {
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
        assignedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }
}
