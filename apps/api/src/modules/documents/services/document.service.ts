import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { STORAGE_PROVIDER_TOKEN } from '../storage/storage-provider.interface';
import type { StorageProvider } from '../storage/storage-provider.interface';
import {
  DocumentStatus,
  DocumentAccessAction,
  DocumentVerificationStatus,
  RoleType,
} from '@prisma/client';
import * as crypto from 'crypto';
import { PaginationDto } from '../../../common/pagination/pagination.dto';
import { PaginatedResponseDto } from '../../../common/pagination/paginated-response.dto';
import { ActorContext } from '../../../common/interfaces/actor-context.interface';

/** Roles that can access all documents within their organisation */
const ELEVATED_ROLES: RoleType[] = [RoleType.ADMIN, RoleType.BACK_OFFICE];

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
    return `DOC-${Date.now()}-${crypto.randomInt(0, 1000)}`;
  }

  private async getAuthorizedDocument(id: string, actor: ActorContext) {
    const actorOrg = actor?.organizationId || (actor as any)?.companyId;
    if (!actor?.userId || !actorOrg)
      throw new ForbiddenException('Actor organizational context is required');
    const doc = await this.prisma.document.findUnique({
      where: { id },
      include: {
        uploadedBy: {
          include: {
            branch: {
              include: {
                zone: { include: { region: { include: { company: true } } } },
              },
            },
            team: true,
          },
        },
      },
    });
    if (!doc || doc.status === DocumentStatus.DELETED)
      throw new NotFoundException('Document not found');
    const owner = doc.uploadedBy;
    const ownerOrg =
      owner?.companyId || owner?.branch?.zone?.region?.company?.id;

    // Strict fail-closed tenant boundary
    if (!ownerOrg || ownerOrg !== actorOrg)
      throw new ForbiddenException('Document belongs to another organization');

    const role = actor.role;
    // ADMIN and BACK_OFFICE can see all org documents
    if (role === RoleType.ADMIN || role === RoleType.BACK_OFFICE) return doc;
    // AGENT can only see their own documents
    if (owner?.id !== actor.userId)
      throw new ForbiddenException('Document belongs to another owner');
    return doc;
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
    actor?: ActorContext;
  }) {
    const {
      file,
      name,
      entityType,
      entityId,
      uploadedById,
      category,
      expiryDate,
      tags = [],
      ipAddress,
      actor,
    } = params;
    if (!file) throw new BadRequestException('No file provided');
    if (
      !actor?.userId ||
      actor.userId !== uploadedById ||
      !actor.organizationId
    )
      throw new ForbiddenException(
        'Authenticated organizational context is required',
      );
    const hash = this.calculateHash(file.buffer);
    const documentNumber = this.generateDocNumber();
    const uniqueId = crypto.randomUUID();
    const storageKey = `${entityType}/${entityId}/${uniqueId}-${file.originalname}`;
    const key = await this.storage.uploadFile(
      file.buffer,
      storageKey,
      file.mimetype,
    );
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

  async replaceDocument(
    id: string,
    file: Express.Multer.File,
    userId: string,
    ipAddress?: string,
    actor?: ActorContext,
  ) {
    const doc = await this.getAuthorizedDocument(id, actor as ActorContext);
    if (!file) throw new BadRequestException('No file provided');
    const hash = this.calculateHash(file.buffer);
    const uniqueId = crypto.randomUUID();
    const storageKey = `${doc.entityType}/${doc.entityId}/${uniqueId}-${file.originalname}`;
    const newVersion = doc.version + 1;
    const key = await this.storage.uploadFile(
      file.buffer,
      storageKey,
      file.mimetype,
    );
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

  async downloadDocument(
    id: string,
    userId: string,
    ipAddress?: string,
    actor?: ActorContext,
  ) {
    const doc = await this.getAuthorizedDocument(id, actor as ActorContext);
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

  async getEntityDocuments(
    entityType: string,
    entityId: string,
    pagination?: PaginationDto,
    actor?: ActorContext,
  ) {
    if (!actor?.userId || !actor.organizationId)
      throw new ForbiddenException('Actor organizational context is required');
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 25;
    const sortBy = pagination?.sortBy || 'createdAt';
    const sortOrder = pagination?.sortOrder || 'desc';
    const skip = (page - 1) * limit;
    const isElevatedRole =
      actor.role === RoleType.ADMIN || actor.role === RoleType.BACK_OFFICE;
    const orgScope = actor.organizationId
      ? { organizationId: actor.organizationId }
      : {};
    const ownerScope = isElevatedRole ? {} : { uploadedById: actor.userId };
    const scope = { ...orgScope, ...ownerScope };
    const where = {
      entityType,
      entityId,
      status: { not: DocumentStatus.DELETED },
      ...scope,
    };
    const [data, total] = await Promise.all([
      this.prisma.document.findMany({
        skip,
        take: limit,
        where,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.document.count({ where }),
    ]);
    return new PaginatedResponseDto(data, total, page, limit);
  }

  async getDocumentDetails(id: string, actor: ActorContext) {
    const doc = await this.getAuthorizedDocument(id, actor);
    return this.prisma.document.findUnique({
      where: { id },
      include: {
        versions: { orderBy: { version: 'desc' } },
        uploadedBy: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  async softDeleteDocument(
    id: string,
    userId: string,
    ipAddress?: string,
    actor?: ActorContext,
  ) {
    await this.getAuthorizedDocument(id, actor as ActorContext);
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

  async restoreDocument(
    id: string,
    userId: string,
    ipAddress?: string,
    actor?: ActorContext,
  ) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');
    if (!actor?.userId || !actor.organizationId)
      throw new ForbiddenException('Actor organizational context is required');
    if (actor.role !== RoleType.ADMIN && actor.role !== RoleType.BACK_OFFICE)
      throw new ForbiddenException('Only administrators can restore documents');
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

  async getAccessLogs(id: string, actor: ActorContext) {
    await this.getAuthorizedDocument(id, actor);
    return this.prisma.documentAccessLog.findMany({
      where: { documentId: id },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAll(pagination: PaginationDto, actor: ActorContext) {
    if (!actor?.userId || !actor.organizationId)
      throw new ForbiddenException('Actor organizational context is required');
    const page = pagination.page || 1;
    const limit = pagination.limit || 20;
    const skip = (page - 1) * limit;
    const where: any = {
      deletedAt: null,
      ...(actor.organizationId ? { organizationId: actor.organizationId } : {}),
    };
    if (actor.role !== RoleType.ADMIN && actor.role !== RoleType.BACK_OFFICE)
      where.uploadedById = actor.userId;
    const [data, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.document.count({ where }),
    ]);
    return new PaginatedResponseDto(data, total, page, limit);
  }
}
