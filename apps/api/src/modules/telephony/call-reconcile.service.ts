import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { ExotelClient } from './exotel.client';
import { ExotelWebhookService } from './exotel-webhook.service';

/** Calls younger than this may still be running, so we leave them alone */
const STUCK_AFTER_MS = 15 * 60 * 1000;
/** Exotel statuses that mean the call is over */
const FINAL_STATUSES = ['completed', 'busy', 'no-answer', 'failed', 'canceled'];

/**
 * Finishes calls that stayed "In progress" because Exotel's result never
 * reached us (for example when ngrok or the server was down).
 *
 *  - Outgoing (click-to-call): asks Exotel for the final result and saves it
 *    exactly as if the status callback had arrived.
 *  - Incoming: the "after call" event never came, so nobody answered →
 *    saved as missed.
 *
 * Runs on startup and every 30 minutes.
 */
@Injectable()
export class CallReconcileService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CallReconcileService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly exotel: ExotelClient,
    private readonly webhooks: ExotelWebhookService,
  ) {}

  onApplicationBootstrap(): void {
    setTimeout(() => void this.reconcileStuckCalls(), 20000);
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async reconcileStuckCalls(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const stuck = await this.prisma.callLog.findMany({
        where: {
          provider: 'EXOTEL',
          callOutcome: 'INITIATED',
          createdAt: { lt: new Date(Date.now() - STUCK_AFTER_MS) },
        },
        orderBy: { createdAt: 'asc' },
        take: 50,
        select: { id: true, callType: true, providerCallSid: true },
      });

      let fixed = 0;
      for (const call of stuck) {
        try {
          if (await this.reconcile(call)) fixed++;
        } catch (err) {
          this.logger.warn(
            `Could not finish stuck call ${call.id}: ${(err as Error).message}`,
          );
        }
      }
      if (stuck.length) {
        this.logger.log(`Stuck calls checked: ${stuck.length}, finished: ${fixed}`);
      }
    } finally {
      this.running = false;
    }
  }

  private async reconcile(call: {
    id: string;
    callType: string;
    providerCallSid: string | null;
  }): Promise<boolean> {
    if (call.callType === 'INBOUND') {
      await this.prisma.callLog.update({
        where: { id: call.id },
        data: { callOutcome: 'NO_ANSWER', callStatus: 'missed', endedAt: new Date() },
      });
      return true;
    }

    if (!call.providerCallSid) {
      await this.prisma.callLog.update({
        where: { id: call.id },
        data: { callOutcome: 'FAILED', callStatus: 'failed' },
      });
      return true;
    }

    const details = await this.exotel.getCallDetails(call.providerCallSid);
    const status = String(details?.Status ?? '').toLowerCase();
    if (!details || !FINAL_STATUSES.includes(status)) {
      return false; // Exotel unreachable or call still running — try again later
    }

    // Same path as a real status callback, so recordings get archived too
    await this.webhooks.handleStatusCallback({
      CallSid: details.Sid,
      CustomField: call.id,
      Status: status,
      ConversationDuration: details.Duration,
      StartTime: details.StartTime,
      EndTime: details.EndTime,
      RecordingUrl: details.RecordingUrl || undefined,
    });
    return true;
  }
}
