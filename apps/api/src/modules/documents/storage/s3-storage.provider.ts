import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { StorageProvider } from './storage-provider.interface';

@Injectable()
export class S3StorageProvider implements StorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly logger = new Logger('S3StorageProvider');

  constructor(private readonly config: ConfigService) {
    const region = this.config.get<string>('STORAGE_REGION') || 'us-east-1';
    const accessKeyId = this.config.get<string>('STORAGE_ACCESS_KEY');
    const secretAccessKey = this.config.get<string>('STORAGE_SECRET_KEY');
    const endpoint = this.config.get<string>('STORAGE_ENDPOINT');
    this.bucket =
      this.config.get<string>('STORAGE_BUCKET') || 'jest-policy-crm';

    const isProduction =
      this.config.get<string>('NODE_ENV') === 'production' ||
      process.env.NODE_ENV === 'production';
    const provider = this.config.get<string>('STORAGE_PROVIDER', 'LOCAL');

    if (
      isProduction &&
      (provider === 'S3' || provider === 'MINIO') &&
      (!accessKeyId || !secretAccessKey)
    ) {
      throw new Error(
        'S3StorageProvider: STORAGE_ACCESS_KEY and STORAGE_SECRET_KEY must be configured in production',
      );
    }

    this.client = new S3Client({
      region,
      credentials: {
        accessKeyId: accessKeyId || (isProduction ? '' : 'development-key'),
        secretAccessKey:
          secretAccessKey || (isProduction ? '' : 'development-secret'),
      },
      endpoint: endpoint || undefined,
      forcePathStyle: endpoint ? true : false, // Required for MinIO
    });
  }

  getProviderName(): string {
    const provider = this.config.get<string>('STORAGE_PROVIDER', 'LOCAL');
    return provider === 'MINIO' ? 'MINIO' : 'S3';
  }

  async uploadFile(
    fileBuffer: Buffer,
    key: string,
    mimeType: string,
  ): Promise<string> {
    this.logger.log(`Uploading file [${key}] to S3 bucket [${this.bucket}]`);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: fileBuffer,
        ContentType: mimeType,
      }),
    );
    return key;
  }

  async downloadFile(key: string): Promise<Buffer> {
    this.logger.log(
      `Downloading file [${key}] from S3 bucket [${this.bucket}]`,
    );
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );

    const streamToBuffer = (stream: any): Promise<Buffer> =>
      new Promise((resolve, reject) => {
        const chunks: any[] = [];
        stream.on('data', (chunk: any) => chunks.push(chunk));
        stream.on('error', (err: any) => reject(err));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
      });

    return streamToBuffer(response.Body);
  }

  async deleteFile(key: string): Promise<void> {
    this.logger.log(`Deleting file [${key}] from S3 bucket [${this.bucket}]`);
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }
}
