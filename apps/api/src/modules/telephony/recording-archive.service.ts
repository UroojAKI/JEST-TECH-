import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import {
  STORAGE_PROVIDER_TOKEN,
  StorageProvider,
} from '../documents/storage/storage-provider.interface';
import { ExotelClient } from './exotel.client';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Keeps our own copy of every call recording, and deletes it when it expires.
 *
 *  - After a call ends: download from Exotel → save in our storage
 *    (MinIO/S3, or the local uploads/ folder when those are not running)
 *  - Every 30 minutes: retry any recording that failed to copy
 *  - Every night at 2 AM (India time): delete recordings past their expiry date
 */
@Injectable()
export class RecordingArchiveService implements OnApplicationBootstrap {
  private readonly logger = new Logger(RecordingArchiveService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly exotel: ExotelClient,
    @Inject(STORAGE_PROVIDER_TOKEN) private readonly storage: StorageProvider,
  ) {}

  /** How long recordings are kept (RECORDING_RETENTION_DAYS, default 365) */
  retentionDays(): number {
    const days = Number(this.config.get('RECORDING_RETENTION_DAYS'));
    return Number.isFinite(days) && days > 0 ? days : 365;
  }

  /** Expiry date for a call that happened at `callTime` */
  expiryFor(callTime: Date): Date {
    return new Date(callTime.getTime() + this.retentionDays() * DAY_MS);
  }

  /** Copies one call's recording into our storage (safe to run twice) */
  async archive(callLogId: string): Promise<void> {
    const call = await this.prisma.callLog.findUnique({
      where: { id: callLogId },
      select: {
        id: true,
        createdAt: true,
        startedAt: true,
        recordingUrl: true,
        recordingStorageKey: true,
        recordingDeletedAt: true,
      },
    });
    if (
      !call?.recordingUrl ||
      call.recordingStorageKey ||
      call.recordingDeletedAt
    ) {
      return;
    }

    const { body, contentType } = await this.exotel.fetchRecording(
      call.recordingUrl,
    );

    const callTime = call.startedAt ?? call.createdAt;
    const year = callTime.getUTCFullYear();
    const month = String(callTime.getUTCMonth() + 1).padStart(2, '0');
    const key = `call-recordings/${year}/${month}/${call.id}.mp3`;

    const storedKey = await this.storage.uploadFile(body, key, contentType);

    await this.prisma.callLog.update({
      where: { id: call.id },
      data: {
        recordingStorageKey: storedKey,
        recordingExpiresAt: this.expiryFor(callTime),
      },
    });
    this.logger.log(`Recording archived for call ${call.id}`);
  }

  /** Starts archiving without making the caller wait */
  archiveInBackground(callLogId: string): void {
    this.archive(callLogId).catch((err) =>
      this.logger.warn(
        `Recording copy failed for call ${callLogId} (will retry): ${(err as Error).message}`,
      ),
    );
  }

  /** Returns the recording audio — our copy if we have it, else Exotel's */
  async read(callLogId: string): Promise<{ body: Buffer; contentType: string }> {
    const call = await this.prisma.callLog.findUnique({
      where: { id: callLogId },
      select: {
        recordingUrl: true,
        recordingStorageKey: true,
        recordingDeletedAt: true,
      },
    });
    if (!call || call.recordingDeletedAt) {
      throw new NotFoundException('Recording not found');
    }
    if (call.recordingStorageKey) {
      try {
        const body = await this.storage.downloadFile(call.recordingStorageKey);
        return { body, contentType: 'audio/mpeg' };
      } catch (err) {
        this.logger.warn(
          `Stored recording missing for call ${callLogId}, trying Exotel: ${(err as Error).message}`,
        );
      }
    }
    if (call.recordingUrl) {
      return this.exotel.fetchRecording(call.recordingUrl);
    }
    throw new NotFoundException('Recording not found');
  }

  /** On startup, pick up any recordings that were not copied yet */
  onApplicationBootstrap(): void {
    setTimeout(() => void this.retryPending(), 15000);
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async retryPending(): Promise<void> {
    const pending = await this.prisma.callLog.findMany({
      where: {
        recordingUrl: { not: null },
        recordingStorageKey: null,
        recordingDeletedAt: null,
        createdAt: { gte: new Date(Date.now() - 30 * DAY_MS) },
      },
      select: { id: true },
      take: 50,
    });
    for (const { id } of pending) {
      try {
        await this.archive(id);
      } catch (err) {
        this.logger.warn(
          `Recording copy retry failed for call ${id}: ${(err as Error).message}`,
        );
      }
    }
  }

  @Cron('0 2 * * *', { timeZone: 'Asia/Kolkata' })
  async deleteExpired(): Promise<void> {
    const expired = await this.prisma.callLog.findMany({
      where: {
        recordingExpiresAt: { lte: new Date() },
        recordingDeletedAt: null,
      },
      select: { id: true, recordingStorageKey: true },
      take: 500,
    });

    for (const call of expired) {
      if (call.recordingStorageKey) {
        try {
          await this.storage.deleteFile(call.recordingStorageKey);
        } catch (err) {
          this.logger.warn(
            `Could not delete recording file for call ${call.id}: ${(err as Error).message}`,
          );
          continue; // try again tomorrow
        }
      }
      await this.prisma.callLog.update({
        where: { id: call.id },
        data: {
          recordingStorageKey: null,
          recordingUrl: null,
          recordingDeletedAt: new Date(),
        },
      });
    }

    if (expired.length > 0) {
      this.logger.log(`Deleted ${expired.length} expired call recording(s)`);
    }
  }
}
