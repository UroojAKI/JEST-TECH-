import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, RoleType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { ResourceAuthorizationService } from '../../common/services/resource-authorization.service';
import type { ActorContext } from '../../common/interfaces/actor-context.interface';
import { RecordingArchiveService } from './recording-archive.service';

export interface CallHistoryItem {
  id: string;
  createdAt: Date;
  callType: string;
  callOutcome: string;
  callStatus: string | null;
  provider: string | null;
  durationSeconds: number;
  startedAt: Date | null;
  endedAt: Date | null;
  toNumber: string | null;
  fromNumber: string | null;
  notes: string | null;
  agentName: string;
  ivrOption: string | null;
  hasRecording: boolean;
}

/** A call on the "Call Logs" page — also shows which lead it belongs to */
export interface CallLogListItem extends CallHistoryItem {
  lead: { id: string; leadCode: string; customerName: string } | null;
}

export interface CallLogFilters {
  /** INBOUND or OUTBOUND */
  type?: string;
  /** connected = talked; not_connected = missed / busy / failed */
  result?: string;
  /** Part of a phone number */
  phone?: string;
  page?: number;
}

const PAGE_SIZE = 25;

const CALL_SELECT = {
  id: true,
  createdAt: true,
  callType: true,
  callOutcome: true,
  callStatus: true,
  provider: true,
  durationSeconds: true,
  startedAt: true,
  endedAt: true,
  toNumber: true,
  notes: true,
  ivrOption: true,
  fromNumber: true,
  recordingUrl: true,
  recordingStorageKey: true,
  recordingDeletedAt: true,
  user: { select: { firstName: true, lastName: true } },
} satisfies Prisma.CallLogSelect;

type SelectedCall = Prisma.CallLogGetPayload<{ select: typeof CALL_SELECT }>;

@Injectable()
export class CallHistoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: ResourceAuthorizationService,
    private readonly recordings: RecordingArchiveService,
    private readonly config: ConfigService,
  ) {}

  /** Admin and back office see every call of their company */
  private seesAllCalls(user: ActorContext): boolean {
    const roles = user.roles?.length ? user.roles : [user.role];
    return roles.includes(RoleType.ADMIN) || roles.includes(RoleType.BACK_OFFICE);
  }

  /**
   * Which calls this user may see:
   *  - Admin / back office: all calls of their company, including incoming
   *    calls from unknown numbers (not linked to any lead or agent)
   *  - Agent: their own calls and calls on leads they own
   */
  private callScope(user: ActorContext): Prisma.CallLogWhereInput {
    const companyId = user.companyId;
    // Unlinked incoming calls belong to the company that owns the Exotel account
    const ownsExotel =
      Boolean(companyId) &&
      this.config.get<string>('EXOTEL_COMPANY_ID') === companyId;

    const companyScope: Prisma.CallLogWhereInput = {
      OR: [
        { lead: { companyId } },
        { user: { companyId } },
        ...(ownsExotel ? [{ leadId: null, userId: null }] : []),
      ],
    };
    if (this.seesAllCalls(user)) return companyScope;

    return {
      AND: [
        companyScope,
        {
          OR: [
            { userId: user.userId },
            { lead: { assignedToId: user.userId } },
            { lead: { createdById: user.userId } },
          ],
        },
      ],
    };
  }

  /** All calls the user may see, newest first, 25 per page */
  async listCalls(user: ActorContext, filters: CallLogFilters) {
    const where: Prisma.CallLogWhereInput[] = [this.callScope(user)];

    if (filters.type === 'INBOUND' || filters.type === 'OUTBOUND') {
      where.push({ callType: filters.type });
    }
    if (filters.result === 'connected') {
      where.push({ callOutcome: 'CONNECTED' });
    } else if (filters.result === 'not_connected') {
      where.push({ callOutcome: { in: ['NO_ANSWER', 'BUSY', 'FAILED'] } });
    }
    const digits = (filters.phone ?? '').replace(/\D/g, '').slice(-10);
    if (digits.length >= 3) {
      where.push({
        OR: [
          { fromNumber: { contains: digits } },
          { toNumber: { contains: digits } },
        ],
      });
    }

    const page = Math.max(1, Math.floor(Number(filters.page) || 1));
    const [total, calls] = await Promise.all([
      this.prisma.callLog.count({ where: { AND: where } }),
      this.prisma.callLog.findMany({
        where: { AND: where },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          ...CALL_SELECT,
          lead: {
            select: {
              id: true,
              leadCode: true,
              contact: { select: { firstName: true, lastName: true } },
            },
          },
        },
      }),
    ]);

    const items: CallLogListItem[] = calls.map((c) => ({
      ...this.toItem(c),
      lead: c.lead
        ? {
            id: c.lead.id,
            leadCode: c.lead.leadCode,
            customerName: c.lead.contact
              ? `${c.lead.contact.firstName} ${c.lead.contact.lastName}`.trim()
              : '',
          }
        : null,
    }));

    return { items, total, page, pageSize: PAGE_SIZE };
  }

  private toItem(c: SelectedCall): CallHistoryItem {
    return {
      id: c.id,
      createdAt: c.createdAt,
      callType: c.callType,
      callOutcome: c.callOutcome,
      callStatus: c.callStatus,
      provider: c.provider,
      durationSeconds: c.durationSeconds,
      startedAt: c.startedAt,
      endedAt: c.endedAt,
      toNumber: c.toNumber,
      fromNumber: c.fromNumber,
      notes: c.notes,
      agentName: c.user
        ? `${c.user.firstName} ${c.user.lastName}`.trim()
        : 'No agent',
      ivrOption: c.ivrOption,
      // The recording link itself is never sent to the browser
      hasRecording:
        !c.recordingDeletedAt && Boolean(c.recordingStorageKey || c.recordingUrl),
    };
  }

  /** Loads the lead and checks the user is allowed to see it */
  async getAuthorizedLead(leadId: string, user: ActorContext) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, deletedAt: null },
      select: {
        id: true,
        companyId: true,
        createdById: true,
        assignedToId: true,
        contactId: true,
        contact: { select: { phone: true } },
      },
    });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
    this.authz.authorize(user, 'LEAD', 'READ', lead);
    return lead;
  }

  /** All calls for a lead (Exotel and manually logged), newest first */
  async listForLead(
    leadId: string,
    user: ActorContext,
  ): Promise<CallHistoryItem[]> {
    await this.getAuthorizedLead(leadId, user);

    const calls = await this.prisma.callLog.findMany({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: CALL_SELECT,
    });

    return calls.map((c) => this.toItem(c));
  }

  /** Downloads a call's recording after checking the user may see the call */
  async getRecording(callId: string, user: ActorContext) {
    const call = await this.prisma.callLog.findUnique({
      where: { id: callId },
      select: {
        leadId: true,
        recordingUrl: true,
        recordingStorageKey: true,
        recordingDeletedAt: true,
      },
    });
    if (
      !call ||
      call.recordingDeletedAt ||
      !(call.recordingStorageKey || call.recordingUrl)
    ) {
      throw new NotFoundException('Recording not found');
    }
    if (call.leadId) {
      await this.getAuthorizedLead(call.leadId, user);
    } else {
      // Not linked to a lead (e.g. unknown caller): same rules as Call Logs
      const allowed = await this.prisma.callLog.count({
        where: { AND: [{ id: callId }, this.callScope(user)] },
      });
      if (!allowed) {
        throw new ForbiddenException('You cannot access this recording');
      }
    }
    // Our own stored copy first, Exotel's copy as a fallback
    return this.recordings.read(callId);
  }
}
