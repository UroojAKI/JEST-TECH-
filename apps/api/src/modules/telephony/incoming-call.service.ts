import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { RecordingArchiveService } from './recording-archive.service';

export type IncomingCallEvent = 'popup' | 'completed' | 'missed';
export const INCOMING_CALL_EVENTS: IncomingCallEvent[] = [
  'popup',
  'completed',
  'missed',
];

/** How long a ringing call keeps showing as a pop-up on the agent's screen */
const POPUP_WINDOW_MS = 90 * 1000;

/**
 * Handles calls that customers make TO our ExoPhone (through the IVR).
 *
 * Exotel calls these events (configured in the Exotel flow builder):
 *  - popup     → Connect applet "Create popup" URL: an agent's phone is ringing
 *  - completed → Passthru in "After the call conversation ends"
 *  - missed    → Passthru in "If nobody answers"
 */
@Injectable()
export class IncomingCallService {
  private readonly logger = new Logger(IncomingCallService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly recordings: RecordingArchiveService,
  ) {}

  async handle(
    event: IncomingCallEvent,
    params: Record<string, unknown>,
  ): Promise<void> {
    // Log only the parameter names (never phone numbers) to help setup
    this.logger.log(
      `Exotel ${event} event, params: ${Object.keys(params).join(', ')}`,
    );

    const callSid = this.param(params, 'CallSid', 'callSid');
    if (!callSid) {
      this.logger.warn(`Exotel ${event} event without CallSid`);
      return;
    }

    const callerNumber = this.param(params, 'CallFrom', 'From');
    const agentNumber = this.param(
      params,
      'DialWhomNumber',
      'AgentPhoneNumber',
      'DialWhom',
    );
    const ivrOption = this.digits(this.param(params, 'digits', 'Digits'));

    const existing = await this.prisma.callLog.findUnique({
      where: { providerCallSid: callSid },
      select: { id: true, leadId: true, callOutcome: true },
    });
    const agent = agentNumber ? await this.findUserByPhone(agentNumber) : null;

    const update: Prisma.CallLogUncheckedUpdateInput = {};
    if (agent) update.userId = agent.id;
    if (agentNumber) update.toNumber = agentNumber;
    if (ivrOption) update.ivrOption = ivrOption;

    if (event === 'popup') {
      update.callStatus = 'ringing';
    } else if (event === 'completed') {
      const recordingUrl = this.param(params, 'RecordingUrl');
      const startedAt = this.parseExotelTime(this.param(params, 'StartTime'));
      update.callOutcome = 'CONNECTED';
      update.callStatus = 'completed';
      update.durationSeconds =
        Number(
          this.param(params, 'DialCallDuration', 'ConversationDuration'),
        ) || 0;
      update.endedAt =
        this.parseExotelTime(this.param(params, 'EndTime')) ?? new Date();
      if (startedAt) update.startedAt = startedAt;
      if (recordingUrl) {
        update.recordingUrl = recordingUrl;
        update.recordingExpiresAt = this.recordings.expiryFor(
          startedAt ?? new Date(),
        );
      }
    } else {
      update.callOutcome = 'NO_ANSWER';
      update.callStatus = 'missed';
      update.endedAt = new Date();
    }

    let callLogId: string;
    let leadId: string | null;
    if (existing) {
      await this.prisma.callLog.update({
        where: { id: existing.id },
        data: update,
      });
      callLogId = existing.id;
      leadId = existing.leadId;
    } else {
      const caller = callerNumber ? await this.findCaller(callerNumber) : null;
      try {
        const created = await this.prisma.callLog.create({
          data: {
            ...(update as Prisma.CallLogUncheckedCreateInput),
            providerCallSid: callSid,
            provider: 'EXOTEL',
            callType: 'INBOUND',
            callOutcome:
              (update.callOutcome as string | undefined) ?? 'INITIATED',
            fromNumber: callerNumber,
            leadId: caller?.leadId ?? null,
            contactId: caller?.contactId ?? null,
            startedAt: (update.startedAt as Date | undefined) ?? new Date(),
          },
          select: { id: true, leadId: true },
        });
        callLogId = created.id;
        leadId = created.leadId;
      } catch (err) {
        // Two events for the same call arrived at the same moment
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          return this.handle(event, params);
        }
        throw err;
      }
    }

    if (event === 'completed' && update.recordingUrl) {
      this.recordings.archiveInBackground(callLogId);
    }

    // A missed call on a known lead → "call back" task for the lead's owner
    if (
      event === 'missed' &&
      leadId &&
      existing?.callOutcome !== 'NO_ANSWER'
    ) {
      await this.createCallbackTask(leadId, callerNumber);
    }
  }

  /** Ringing incoming calls for this agent (shown as a pop-up) */
  async activeForAgent(userId: string) {
    const calls = await this.prisma.callLog.findMany({
      where: {
        userId,
        callType: 'INBOUND',
        callStatus: 'ringing',
        createdAt: { gte: new Date(Date.now() - POPUP_WINDOW_MS) },
      },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: {
        id: true,
        createdAt: true,
        fromNumber: true,
        ivrOption: true,
        lead: {
          select: {
            id: true,
            leadCode: true,
            title: true,
            contact: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    return calls.map((c) => ({
      id: c.id,
      createdAt: c.createdAt,
      fromNumber: c.fromNumber,
      ivrOption: c.ivrOption,
      lead: c.lead
        ? {
            id: c.lead.id,
            leadCode: c.lead.leadCode,
            title: c.lead.title,
            customerName:
              `${c.lead.contact.firstName} ${c.lead.contact.lastName}`.trim(),
          }
        : null,
    }));
  }

  /** Matches the caller's number to a contact and their latest lead */
  private async findCaller(number: string) {
    const last10 = this.last10(number);
    if (!last10) return null;
    const companyId = this.config.get<string>('EXOTEL_COMPANY_ID');

    const contact = await this.prisma.contact.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { phone: { endsWith: last10 } },
          { alternatePhone: { endsWith: last10 } },
        ],
        ...(companyId ? { companyId } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });
    if (!contact) return null;

    const lead = await this.prisma.lead.findFirst({
      where: { contactId: contact.id, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });
    return { contactId: contact.id, leadId: lead?.id ?? null };
  }

  private async findUserByPhone(number: string) {
    const last10 = this.last10(number);
    if (!last10) return null;
    return this.prisma.user.findFirst({
      where: { phone: { endsWith: last10 }, deletedAt: null },
      select: { id: true },
    });
  }

  private async createCallbackTask(leadId: string, callerNumber?: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      select: { assignedToId: true, createdById: true },
    });
    await this.prisma.activity.create({
      data: {
        leadId,
        type: 'CALL',
        subject: 'Call back: missed incoming call',
        description: callerNumber
          ? `Customer called from ${callerNumber} and nobody answered.`
          : 'Customer called and nobody answered.',
        dueDate: new Date(),
        assignedToId: lead?.assignedToId ?? lead?.createdById ?? null,
      },
    });
  }

  private param(
    params: Record<string, unknown>,
    ...names: string[]
  ): string | undefined {
    for (const name of names) {
      const value = params[name];
      if (typeof value === 'string' && value.trim() !== '') {
        return value.trim();
      }
    }
    return undefined;
  }

  /** Exotel sends the pressed key with quotes, e.g. "1" → 1 */
  private digits(value?: string): string | undefined {
    const cleaned = value?.replace(/[^0-9*#]/g, '');
    return cleaned ? cleaned : undefined;
  }

  private last10(number: string): string | null {
    const digits = number.replace(/\D/g, '');
    return digits.length >= 10 ? digits.slice(-10) : null;
  }

  /** Exotel sends "2026-11-12 14:05:00" in Indian time */
  private parseExotelTime(value?: string): Date | undefined {
    if (!value) return undefined;
    const date = new Date(`${value.replace(' ', 'T')}+05:30`);
    return isNaN(date.getTime()) ? undefined : date;
  }
}
