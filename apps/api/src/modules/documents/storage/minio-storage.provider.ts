import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { StorageProvider } from './storage-provider.interface';

@Injectable()
export class MinioStorageProvider implements StorageProvider, OnModuleInit {
  private readonly logger = new Logger(MinioStorageProvider.name);
  private readonly client: Minio.Client | null = null;
  private readonly bucket: string;
  private readonly isMinioEnabled: boolean;

  constructor(private readonly config: ConfigService) {
    const production = this.config.get<string>('NODE_ENV') === 'production';
    const provider = (
      this.config.get<string>('STORAGE_PROVIDER', 'DUAL') || 'DUAL'
    ).toUpperCase();
    this.isMinioEnabled = provider === 'MINIO' || provider === 'DUAL';
    this.bucket = this.config.get<string>('MINIO_BUCKET', 'jest-documents');

    if (!this.isMinioEnabled) {
      return;
    }

    const host = this.config.get<string>('MINIO_HOST');
    const accessKey = this.config.get<string>('MINIO_ROOT_USER');
    const secretKey = this.config.get<string>('MINIO_ROOT_PASSWORD');
    if (production && (!host || !accessKey || !secretKey)) {
      throw new Error('Production object storage requires MINIO_HOST, MINIO_ROOT_USER and MINIO_ROOT_PASSWORD.');
    }
    this.client = new Minio.Client({
      endPoint: host || 'localhost',
      port: this.config.get<number>('MINIO_PORT', 9000),
      useSSL: production,
      accessKey: accessKey || 'minioadmin',
      secretKey: secretKey || 'minioadmin',
    });
  }

  private getClient(): Minio.Client {
    if (!this.client) {
      throw new Error(
        'MinIO client is not initialized because STORAGE_PROVIDER does not use MinIO.',
      );
    }
    return this.client;
  }

  getProviderName(): string {
    return 'MINIO';
  }

  async isAvailable(): Promise<boolean> {
    if (!this.client) {
      return false;
    }
    try {
      return await this.client.bucketExists(this.bucket);
    } catch {
      return false;
    }
  }

  async onModuleInit() {
    if (!this.isMinioEnabled || !this.client) {
      return;
    }
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket, 'us-east-1');
        this.logger.log(`Created MinIO bucket: ${this.bucket}`);
      }
    } catch (error: any) {
      this.logger.error(
        `MinIO initialization failed: ${error.message}. The configured storage strategy will determine whether upload failover is permitted.`,
      );
    }
  }

  async uploadFile(
    buffer: Buffer,
    key: string,
    mimeType: string,
  ): Promise<string> {
    await this.getClient().putObject(this.bucket, key, buffer, buffer.length, {
      'Content-Type': mimeType,
    });
    return key;
  }

  async downloadFile(key: string): Promise<Buffer> {
    const stream = await this.getClient().getObject(this.bucket, key);
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  async deleteFile(key: string): Promise<void> {
    await this.getClient().removeObject(this.bucket, key);
  }

  async getFileUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    return this.getClient().presignedGetObject(
      this.bucket,
      key,
      expiresInSeconds,
    );
  }
}
