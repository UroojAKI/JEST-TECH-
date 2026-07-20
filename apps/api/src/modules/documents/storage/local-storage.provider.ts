import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { StorageProvider } from './storage-provider.interface';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  private readonly logger = new Logger(LocalStorageProvider.name);
  private readonly uploadDir = path.join(process.cwd(), 'uploads');

  constructor() {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  getProviderName(): string {
    return 'LOCAL';
  }

  /**
   * Resolves and validates that the given key stays within the upload directory.
   * Throws BadRequestException if a path traversal attempt is detected.
   */
  private safePath(key: string): string {
    const resolved = path.resolve(this.uploadDir, key);
    const uploadDirResolved = path.resolve(this.uploadDir);
    const relative = path.relative(uploadDirResolved, resolved);
    const isSafe = relative && !relative.startsWith('..') && !path.isAbsolute(relative);
    if (!isSafe) {
      throw new BadRequestException('Invalid storage path');
    }
    return resolved;
  }

  async uploadFile(fileBuffer: Buffer, key: string, mimeType: string): Promise<string> {
    const filePath = this.safePath(key);
    const parentDir = path.dirname(filePath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    await fs.promises.writeFile(filePath, fileBuffer);
    this.logger.log(`File uploaded successfully to: ${filePath}`);
    return key;
  }

  async downloadFile(key: string): Promise<Buffer> {
    const filePath = this.safePath(key);
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    return fs.promises.readFile(filePath);
  }

  async deleteFile(key: string): Promise<void> {
    const filePath = this.safePath(key);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      this.logger.log(`Deleted file: ${filePath}`);
    }
  }
}
