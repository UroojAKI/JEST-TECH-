import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ExotelClient } from './exotel.client';
import { ExotelWebhookService } from './exotel-webhook.service';

@Injectable()
export class ClickToCallService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly exotel: ExotelClient,
    private readonly webhooks: ExotelWebhookService,
  ) {}

  async callLead(leadId: string, userId: string, companyId: string) {
    // 1. Find the lead (only inside the agent's own company)
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, companyId },
      select: {
        id: true,
        contactId: true,
        contact: { select: { phone: true } },
      },
    });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
    const customerNumber = lead.contact.phone;
    if (!customerNumber) {
      throw new BadRequestException('This lead has no phone number');
    }

    // 2. Find the agent's own phone number
    const agent = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true },
    });
    if (!agent?.phone) {
      throw new BadRequestException(
        'Please add your mobile number to your profile before calling',
      );
    }

    // 3. Save "call started" in CallLog
    const callLog = await this.prisma.callLog.create({
      data: {
        leadId: lead.id,
        contactId: lead.contactId,
        userId,
        callType: 'OUTBOUND',
        callOutcome: 'INITIATED',
        provider: 'EXOTEL',
        fromNumber: agent.phone,
        toNumber: customerNumber,
        startedAt: new Date(),
      },
    });

    // 4. Ask Exotel to connect the call
    try {
      const result = await this.exotel.connectCall({
        agentNumber: agent.phone,
        customerNumber,
        customField: callLog.id,
        statusCallbackUrl: this.webhooks.statusCallbackUrl(),
      });

      // 5. Save Exotel's call ID
      return await this.prisma.callLog.update({
        where: { id: callLog.id },
        data: {
          providerCallSid: result.callSid,
          callStatus: result.status,
        },
        select: { id: true, providerCallSid: true, callStatus: true },
      });
    } catch (err) {
      await this.prisma.callLog.update({
        where: { id: callLog.id },
        data: { callOutcome: 'FAILED', callStatus: 'failed' },
      });
      throw err;
    }
  }
}
