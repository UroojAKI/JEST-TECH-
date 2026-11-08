import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { StorageProvider } from './storage-provider.interface';

@Injectable()
export class MinioStorageProvider implements StorageProvider, OnModuleInit {
  private readonly logger = new Logger(MinioStorageProvider.name);
  private readonly client: Minio.Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    const production = this.config.get<string>('NODE_ENV') === 'production';
    const host = this.config.get<string>('MINIO_HOST');
    const accessKey = this.config.get<string>('MINIO_ROOT_USER');
    const secretKey = this.config.get<string>('MINIO_ROOT_PASSWORD');
    if (production && (!host || !accessKey || !secretKey)) {
      throw new Error('Production object storage requires MINIO_HOST, MINIO_ROOT_USER and MINIO_ROOT_PASSWORD.');
    }
    this.bucket = this.config.get<string>('MINIO_BUCKET', 'jest-documents');
    this.client = new Minio.Client({
      endPoint: host || 'localhost',
      port: this.config.get<number>('MINIO_PORT', 9000),
      useSSL: production,
      accessKey: accessKey || 'minioadmin',
      secretKey: secretKey || 'minioadmin',
    });
  }

  getProviderName(): string {
    return 'MINIO';
  }

  async isAvailable(): Promise<boolean> {
    try {
      return await this.client.bucketExists(this.bucket);
    } catch {
      return false;
    }
  }

  async onModuleInit() {
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
    await this.client.putObject(this.bucket, key, buffer, buffer.length, {
      'Content-Type': mimeType,
    });
    return key;
  }

  async downloadFile(key: string): Promise<Buffer> {
    const stream = await this.client.getObject(this.bucket, key);
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  async deleteFile(key: string): Promise<void> {
    await this.client.removeObject(this.bucket, key);
  }

  async getFileUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    return this.client.presignedGetObject(this.bucket, key, expiresInSeconds);
  }
}
