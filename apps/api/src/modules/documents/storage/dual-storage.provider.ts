import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { StorageProvider } from './storage-provider.interface';
import { LocalStorageProvider } from './local-storage.provider';
import { MinioStorageProvider } from './minio-storage.provider';

export interface StorageUploadResult {
  key: string;
  provider: 'MINIO' | 'LOCAL';
  replicationStatus: 'SYNCED' | 'PENDING_REPLICATION';
}

export interface ReadRepairResult {
  fileBuffer: Buffer;
  repaired: boolean;
}

@Injectable()
export class DualStorageProvider implements StorageProvider {
  private readonly logger = new Logger(DualStorageProvider.name);

  constructor(
    private readonly primary: MinioStorageProvider,
    private readonly secondary: LocalStorageProvider,
  ) {}

  getProviderName(): string {
    return 'DUAL';
  }

  async isAvailable(): Promise<boolean> {
    const primaryOk = (await this.primary.isAvailable?.()) ?? false;
    const secondaryOk = (await this.secondary.isAvailable?.()) ?? false;
    return primaryOk || secondaryOk;
  }

  /**
   * Standard upload interface implementing StorageProvider.
   * Delegates to uploadWithFailover and returns key.
   */
  async uploadFile(
    fileBuffer: Buffer,
    key: string,
    mimeType: string,
  ): Promise<string> {
    const result = await this.uploadWithFailover(fileBuffer, key, mimeType);
    return result.key;
  }

  /**
   * Resilient upload with failover:
   * 1. Attempts primary (MinIO).
   * 2. If available & succeeds, optionally writes local copy and returns MINIO / SYNCED.
   * 3. If primary fails or is down, writes to local and returns LOCAL / PENDING_REPLICATION.
   */
  async uploadWithFailover(
    fileBuffer: Buffer,
    key: string,
    mimeType: string,
  ): Promise<StorageUploadResult> {
    try {
      const primaryAvailable = (await this.primary.isAvailable?.()) ?? false;
      if (primaryAvailable) {
        const primaryKey = await this.primary.uploadFile(fileBuffer, key, mimeType);
        // Also maintain local copy for failover read safety
        try {
          await this.secondary.uploadFile(fileBuffer, key, mimeType);
        } catch (localErr: any) {
          this.logger.warn(`Failed to mirror file locally: ${localErr.message}`);
        }
        return {
          key: primaryKey,
          provider: 'MINIO',
          replicationStatus: 'SYNCED',
        };
      }
    } catch (primaryErr: any) {
      this.logger.warn(
        `Primary MinIO storage failed, falling back to local storage: ${primaryErr.message}`,
      );
    }

    // Fallback to local storage
    const localKey = await this.secondary.uploadFile(fileBuffer, key, mimeType);
    return {
      key: localKey,
      provider: 'LOCAL',
      replicationStatus: 'PENDING_REPLICATION',
    };
  }

  /**
   * Standard download interface implementing StorageProvider.
   */
  async downloadFile(key: string): Promise<Buffer> {
    try {
      return await this.primary.downloadFile(key);
    } catch {
      return this.secondary.downloadFile(key);
    }
  }

  /**
   * Read-Repair Download:
   * - If doc is stored in LOCAL or marked PENDING_REPLICATION:
   *   1. Serves file from local storage.
   *   2. If MinIO is now available, replicates buffer to MinIO.
   *   3. Verifies SHA-256 checksum on MinIO against original checksum.
   *   4. Signals repaired = true so caller updates document metadata to MINIO and SYNCED.
   *   5. Never deletes local copy before successful checksum confirmation.
   * - If doc is MINIO:
   *   1. Downloads from MinIO.
   *   2. If MinIO fails, falls back to local storage copy.
   */
  async downloadWithReadRepair(
    key: string,
    doc: {
      storageProvider: string;
      hash: string;
      mimeType?: string;
      metadata?: any;
    },
  ): Promise<ReadRepairResult> {
    const isLocal =
      doc.storageProvider === 'LOCAL' ||
      doc.metadata?.replicationStatus === 'PENDING_REPLICATION';

    if (isLocal) {
      // 1. Serve locally
      const localBuffer = await this.secondary.downloadFile(key);

      // 2. Check if primary has become available for read-repair
      let repaired = false;
      try {
        const primaryAvailable = (await this.primary.isAvailable?.()) ?? false;
        if (primaryAvailable) {
          const mime = doc.mimeType || 'application/octet-stream';
          await this.primary.uploadFile(localBuffer, key, mime);

          // 3. Confirm checksum on MinIO
          const remoteBuffer = await this.primary.downloadFile(key);
          const remoteHash = crypto
            .createHash('sha256')
            .update(remoteBuffer)
            .digest('hex');

          if (remoteHash === doc.hash) {
            this.logger.log(
              `Read-repair successful for storage key: ${key}. Checksum verified (${remoteHash}).`,
            );
            repaired = true;
          } else {
            this.logger.error(
              `Read-repair checksum mismatch for key: ${key}. Expected ${doc.hash}, got ${remoteHash}`,
            );
          }
        }
      } catch (repairErr: any) {
        this.logger.warn(
          `Read-repair replication skipped/failed: ${repairErr.message}`,
        );
      }

      return { fileBuffer: localBuffer, repaired };
    }

    // Primary is MINIO: attempt primary download with local fallback
    try {
      const buffer = await this.primary.downloadFile(key);
      return { fileBuffer: buffer, repaired: false };
    } catch (minioErr: any) {
      this.logger.warn(
        `MinIO download failed for key ${key}, falling back to local copy: ${minioErr.message}`,
      );
      const fallbackBuffer = await this.secondary.downloadFile(key);
      return { fileBuffer: fallbackBuffer, repaired: false };
    }
  }

  async deleteFile(key: string): Promise<void> {
    const errors: Error[] = [];
    try {
      await this.primary.deleteFile(key);
    } catch (err: any) {
      errors.push(err);
    }
    try {
      await this.secondary.deleteFile(key);
    } catch (err: any) {
      errors.push(err);
    }
    if (errors.length === 2) {
      throw new Error(`Failed to delete file from both primary and secondary storage`);
    }
  }
}
