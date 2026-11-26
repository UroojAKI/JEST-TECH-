import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { ActorContext } from '../../common/interfaces/actor-context.interface';
import { ExotelClient } from './exotel.client';
import { ExotelWebhookService } from './exotel-webhook.service';
import { CallHistoryService } from './call-history.service';

type Caller = ActorContext & { id: string };

/** Who and what a click-to-call is for */
interface CallTarget {
  customerNumber: string | null | undefined;
  leadId?: string | null;
  contactId?: string | null;
}

@Injectable()
export class ClickToCallService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly exotel: ExotelClient,
    private readonly webhooks: ExotelWebhookService,
    private readonly callHistory: CallHistoryService,
  ) {}

  /** Call button on a lead */
  async callLead(leadId: string, user: Caller) {
    // Only if this user is allowed to see the lead
    const lead = await this.callHistory.getAuthorizedLead(leadId, user);
    return this.startCall(
      {
        customerNumber: lead.contact.phone,
        leadId: lead.id,
        contactId: lead.contactId,
      },
      user,
    );
  }

  /** Call button on a contact (Contacts page) */
  async callContact(contactId: string, user: Caller) {
    const companyId = this.companyOf(user);
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, companyId, deletedAt: null },
      select: {
        id: true,
        phone: true,
        createdById: true,
        assignedAgentId: true,
      },
    });
    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    // Same rule as the Contacts page: admin / back office see all,
    // others only contacts they created or that are assigned to them
    if (!this.seesWholeCompany(user) && contact.createdById !== user.userId) {
      const agentId = await this.agentIdOf(user);
      if (!agentId || contact.assignedAgentId !== agentId) {
        throw new ForbiddenException('You cannot call this contact');
      }
    }

    return this.startCall(
      { customerNumber: contact.phone, contactId: contact.id },
      user,
    );
  }

  /** Call button on a customer (Customers page) */
  async callCustomer(customerId: string, user: Caller) {
    const companyId = this.companyOf(user);
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, companyId, deletedAt: null },
      select: {
        id: true,
        mobile: true,
        contactId: true,
        createdById: true,
        primaryAgentId: true,
      },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // Same rule as the Customers page: admin / back office see all,
    // agents only customers they created or have a lead for
    if (!this.seesWholeCompany(user) && customer.createdById !== user.userId) {
      const agentId = await this.agentIdOf(user);
      const hasLead =
        Boolean(agentId) &&
        (customer.primaryAgentId === agentId ||
          (await this.prisma.lead.count({
            where: {
              companyId,
              customerId: customer.id,
              agentId,
              deletedAt: null,
            },
          })) > 0);
      if (!hasLead) {
        throw new ForbiddenException('You cannot call this customer');
      }
    }

    return this.startCall(
      { customerNumber: customer.mobile, contactId: customer.contactId },
      user,
    );
  }

  /** Rings the agent's phone, then connects the customer, and logs the call */
  private async startCall(target: CallTarget, user: Caller) {
    const customerNumber = target.customerNumber?.trim();
    if (!customerNumber) {
      throw new BadRequestException('This customer has no phone number');
    }

    // 1. Find the agent's own phone number
    const agent = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { phone: true },
    });
    if (!agent?.phone) {
      throw new BadRequestException(
        'Please add your mobile number to your profile before calling',
      );
    }

    // 2. Save "call started" in CallLog
    const callLog = await this.prisma.callLog.create({
      data: {
        leadId: target.leadId ?? null,
        contactId: target.contactId ?? null,
        userId: user.id,
        callType: 'OUTBOUND',
        callOutcome: 'INITIATED',
        provider: 'EXOTEL',
        fromNumber: agent.phone,
        toNumber: customerNumber,
        startedAt: new Date(),
      },
    });

    // 3. Ask Exotel to connect the call
    try {
      const result = await this.exotel.connectCall({
        agentNumber: agent.phone,
        customerNumber,
        customField: callLog.id,
        statusCallbackUrl: this.webhooks.statusCallbackUrl(),
      });

      // 4. Save Exotel's call ID
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

  private companyOf(user: Caller): string {
    const companyId = user.companyId || user.organizationId;
    if (!companyId) {
      throw new ForbiddenException('Tenant context is required');
    }
    return companyId;
  }

  private seesWholeCompany(user: Caller): boolean {
    const roles = user.roles?.length ? user.roles : [user.role];
    return (
      roles.includes(RoleType.ADMIN) || roles.includes(RoleType.BACK_OFFICE)
    );
  }

  private async agentIdOf(user: Caller): Promise<string | undefined> {
    if (user.agentId) return user.agentId;
    const agent = await this.prisma.agent.findFirst({
      where: {
        userId: user.userId,
        companyId: this.companyOf(user),
        deletedAt: null,
      },
      select: { id: true },
    });
    return agent?.id;
  }
}
