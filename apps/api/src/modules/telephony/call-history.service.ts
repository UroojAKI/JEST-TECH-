import { Injectable, NotFoundException } from '@nestjs/common';
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

@Injectable()
export class CallHistoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: ResourceAuthorizationService,
    private readonly recordings: RecordingArchiveService,
  ) {}

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
      select: {
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
      },
    });

    return calls.map((c) => ({
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
    }));
  }

  /** Downloads a call's recording after checking access to its lead */
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
      !call?.leadId ||
      call.recordingDeletedAt ||
      !(call.recordingStorageKey || call.recordingUrl)
    ) {
      throw new NotFoundException('Recording not found');
    }
    await this.getAuthorizedLead(call.leadId, user);
    // Our own stored copy first, Exotel's copy as a fallback
    return this.recordings.read(callId);
  }
}
