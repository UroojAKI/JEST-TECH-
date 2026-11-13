import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { PrismaService } from '../../database/prisma.service';

/** Exotel status → our CallLog.callOutcome */
const OUTCOME_BY_STATUS: Record<string, string> = {
  completed: 'CONNECTED',
  busy: 'BUSY',
  'no-answer': 'NO_ANSWER',
  failed: 'FAILED',
  canceled: 'FAILED',
};

@Injectable()
export class ExotelWebhookService {
  private readonly logger = new Logger(ExotelWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Full URL we give Exotel; undefined if not configured yet */
  statusCallbackUrl(): string | undefined {
    const base = this.config.get<string>('EXOTEL_WEBHOOK_BASE_URL');
    const secret = this.config.get<string>('EXOTEL_WEBHOOK_SECRET');
    if (!base || !secret) return undefined;
    return `${base.replace(/\/$/, '')}/api/v1/telephony/exotel/status-callback?token=${secret}`;
  }

  /** Rejects requests that don't carry our secret token */
  verifyToken(token: string | undefined): void {
    const secret = this.config.get<string>('EXOTEL_WEBHOOK_SECRET');
    if (!secret || !token) throw new UnauthorizedException();
    const a = Buffer.from(token);
    const b = Buffer.from(secret);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException();
    }
  }

  /** Saves the final call result sent by Exotel */
  async handleStatusCallback(payload: Record<string, any>): Promise<void> {
    const callSid: string | undefined = payload.CallSid;
    const callLogId: string | undefined = payload.CustomField;
    if (!callSid && !callLogId) {
      this.logger.warn('Exotel callback without CallSid/CustomField');
      return;
    }

    const callLog = await this.prisma.callLog.findFirst({
      where: callSid
        ? { OR: [{ providerCallSid: callSid }, { id: callLogId ?? '' }] }
        : { id: callLogId },
      select: { id: true },
    });
    if (!callLog) {
      this.logger.warn(`Exotel callback for unknown call ${callSid}`);
      return;
    }

    const status = String(payload.Status ?? '').toLowerCase();
    await this.prisma.callLog.update({
      where: { id: callLog.id },
      data: {
        providerCallSid: callSid ?? undefined,
        callStatus: status || undefined,
        callOutcome: OUTCOME_BY_STATUS[status] ?? 'FAILED',
        durationSeconds: Number(payload.ConversationDuration) || 0,
        startedAt: this.parseExotelTime(payload.StartTime),
        endedAt: this.parseExotelTime(payload.EndTime),
        recordingUrl: payload.RecordingUrl || undefined,
      },
    });
  }

  /** Exotel sends "2026-11-12 14:05:00" in Indian time */
  private parseExotelTime(value: unknown): Date | undefined {
    if (typeof value !== 'string' || !value) return undefined;
    const date = new Date(`${value.replace(' ', 'T')}+05:30`);
    return isNaN(date.getTime()) ? undefined : date;
  }
}
