import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { STORAGE_PROVIDER_TOKEN } from '../storage/storage-provider.interface';
import type { StorageProvider } from '../storage/storage-provider.interface';
import { DocumentStatus, DocumentAccessAction, DocumentVerificationStatus } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class DocumentService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER_TOKEN) private readonly storage: StorageProvider,
  ) {}

  private calculateHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  private generateDocNumber(): string {
    return `DOC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }

  async uploadDocument(params: {
    file: Express.Multer.File;
    name: string;
    entityType: string;
    entityId: string;
    uploadedById: string;
    category?: string;
    expiryDate?: Date;
    tags?: string[];
    ipAddress?: string;
  }) {
    const { file, name, entityType, entityId, uploadedById, category, expiryDate, tags = [], ipAddress } = params;

    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const hash = this.calculateHash(file.buffer);
    const documentNumber = this.generateDocNumber();
    const uniqueId = crypto.randomUUID();
    const storageKey = `${entityType}/${entityId}/${uniqueId}-${file.originalname}`;

    const key = await this.storage.uploadFile(file.buffer, storageKey, file.mimetype);

    const doc = await this.prisma.document.create({
      data: {
        documentNumber,
        name,
        originalFileName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        storageKey: key,
        storageProvider: this.storage.getProviderName(),
        hash,
        entityType,
        entityId,
        uploadedById,
        status: DocumentStatus.ACTIVE,
        version: 1,
        verificationStatus: DocumentVerificationStatus.PENDING,
        expiryDate,
        tags,
        metadata: { category },
      },
    });

    await this.prisma.documentVersion.create({
      data: {
        documentId: doc.id,
        version: 1,
        storageKey: key,
        originalFileName: file.originalname,
        size: file.size,
        hash,
      },
    });

    await this.prisma.documentAccessLog.create({
      data: {
        documentId: doc.id,
        userId: uploadedById,
        action: DocumentAccessAction.VIEW,
        ipAddress,
      },
    });

    return doc;
  }

  async replaceDocument(id: string, file: Express.Multer.File, userId: string, ipAddress?: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id },
    });

    if (!doc || doc.status === DocumentStatus.DELETED) {
      throw new NotFoundException('Document not found or deleted');
    }

    const hash = this.calculateHash(file.buffer);
    const uniqueId = crypto.randomUUID();
    const storageKey = `${doc.entityType}/${doc.entityId}/${uniqueId}-${file.originalname}`;
    const newVersion = doc.version + 1;

    const key = await this.storage.uploadFile(file.buffer, storageKey, file.mimetype);

    const updated = await this.prisma.document.update({
      where: { id },
      data: {
        originalFileName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        storageKey: key,
        hash,
        version: newVersion,
      },
    });

    await this.prisma.documentVersion.create({
      data: {
        documentId: id,
        version: newVersion,
        storageKey: key,
        originalFileName: file.originalname,
        size: file.size,
        hash,
      },
    });

    await this.prisma.documentAccessLog.create({
      data: {
        documentId: id,
        userId,
        action: DocumentAccessAction.VIEW,
        ipAddress,
      },
    });

    return updated;
  }

  async downloadDocument(id: string, userId: string, ipAddress?: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id },
    });

    if (!doc || doc.status === DocumentStatus.DELETED) {
      throw new NotFoundException('Document not found');
    }

    const fileBuffer = await this.storage.downloadFile(doc.storageKey);

    await this.prisma.documentAccessLog.create({
      data: {
        documentId: id,
        userId,
        action: DocumentAccessAction.DOWNLOAD,
        ipAddress,
      },
    });

    return {
      fileBuffer,
      originalFileName: doc.originalFileName,
      mimeType: doc.mimeType,
    };
  }

  async getEntityDocuments(entityType: string, entityId: string) {
    return this.prisma.document.findMany({
      where: {
        entityType,
        entityId,
        status: { not: DocumentStatus.DELETED },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDocumentDetails(id: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id },
      include: {
        versions: { orderBy: { version: 'desc' } },
        uploadedBy: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
    });
    if (!doc || doc.status === DocumentStatus.DELETED) {
      throw new NotFoundException('Document not found');
    }
    return doc;
  }

  async softDeleteDocument(id: string, userId: string, ipAddress?: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id },
    });

    if (!doc || doc.status === DocumentStatus.DELETED) {
      throw new NotFoundException('Document not found');
    }

    await this.prisma.document.update({
      where: { id },
      data: { status: DocumentStatus.DELETED, deletedAt: new Date() },
    });

    await this.prisma.documentAccessLog.create({
      data: {
        documentId: id,
        userId,
        action: DocumentAccessAction.DELETE,
        ipAddress,
      },
    });
  }

  async restoreDocument(id: string, userId: string, ipAddress?: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id },
    });

    if (!doc) {
      throw new NotFoundException('Document not found');
    }

    await this.prisma.document.update({
      where: { id },
      data: { status: DocumentStatus.ACTIVE, deletedAt: null },
    });

    await this.prisma.documentAccessLog.create({
      data: {
        documentId: id,
        userId,
        action: DocumentAccessAction.RESTORE,
        ipAddress,
      },
    });
  }

  async getAccessLogs(id: string) {
    return this.prisma.documentAccessLog.findMany({
      where: { documentId: id },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
