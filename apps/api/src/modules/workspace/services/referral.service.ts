import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class ReferralService {
  constructor(private readonly prisma: PrismaService) {}

  async createReferral(
    dto: {
      sourceLeadId?: string;
      referrerContactId?: string;
      referralName: string;
      phone: string;
      email?: string;
      relationship?: string;
      interestedProduct?: string;
      assignedToId?: string;
    },
    userId: string,
  ) {
    if (!dto.referralName || !dto.phone) {
      throw new BadRequestException(
        'Referral name and phone number are required',
      );
    }

    // 1. Create Referral Record
    const referral = await this.prisma.referral.create({
      data: {
        sourceLeadId: dto.sourceLeadId,
        referrerContactId: dto.referrerContactId,
        referralName: dto.referralName,
        phone: dto.phone,
        email: dto.email,
        relationship: dto.relationship,
        interestedProduct: dto.interestedProduct || 'MOTOR',
        assignedToId: dto.assignedToId || userId,
        status: 'NEW',
      },
    });

    // 2. Auto-Provision Linked Lead for the Referral
    let contact = await this.prisma.contact.findFirst({
      where: { phone: dto.phone, deletedAt: null },
    });

    if (!contact) {
      const contactCount = await this.prisma.contact.count();
      const contactCode = `CNT-${String(contactCount + 1).padStart(5, '0')}`;

      contact = await this.prisma.contact.create({
        data: {
          contactCode,
          type: 'INDIVIDUAL',
          firstName: dto.referralName.split(' ')[0] || dto.referralName,
          lastName:
            dto.referralName.split(' ').slice(1).join(' ') || 'Customer',
          phone: dto.phone,
          email: dto.email,
          createdById: userId,
        },
      });
    }

    const leadCount = await this.prisma.lead.count();
    const leadCode = `LD-${String(leadCount + 1).padStart(5, '0')}`;

    const newLead = await this.prisma.lead.create({
      data: {
        leadCode,
        title: `Referral Lead: ${dto.referralName} (${dto.interestedProduct || 'MOTOR'})`,
        source: 'REFERRAL',
        status: 'NEW',
        contactId: contact.id,
        assignedToId: dto.assignedToId || userId,
        createdById: userId,
        description: `Referred by lead #${dto.sourceLeadId || 'N/A'}. Relationship: ${dto.relationship || 'Friend/Family'}.`,
        currentWorkflowStep: 'ASSIGNED',
      },
    });

    // Update referral with created lead reference
    await this.prisma.referral.update({
      where: { id: referral.id },
      data: { createdLeadId: newLead.id },
    });

    return {
      referral,
      createdLead: newLead,
    };
  }

  async markNoReferral(leadId: string, reason: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException(`Lead '${leadId}' not found`);

    return this.prisma.lead.update({
      where: { id: leadId },
      data: { noReferralReason: reason },
    });
  }

  async getReferralsForLead(leadId: string) {
    return this.prisma.referral.findMany({
      where: { sourceLeadId: leadId },
      include: {
        createdLead: true,
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }
}
