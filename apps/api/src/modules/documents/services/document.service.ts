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

  private async validateEntityBelongsToOrg(
    entityType: string,
    entityId: string,
    actorOrg: string,
  ): Promise<void> {
    switch (entityType) {
      case 'LEAD': {
        const lead = await this.prisma.lead.findUnique({
          where: { id: entityId },
          select: { companyId: true },
        });
        if (!lead) throw new NotFoundException(`Lead ${entityId} not found`);
        if (lead.companyId && lead.companyId !== actorOrg) {
          throw new ForbiddenException('Lead belongs to another organization');
        }
        break;
      }
      case 'POLICY': {
        const policy = await this.prisma.policy.findUnique({
          where: { id: entityId },
          select: { companyId: true },
        });
        if (!policy) throw new NotFoundException(`Policy ${entityId} not found`);
        if (policy.companyId && policy.companyId !== actorOrg) {
          throw new ForbiddenException('Policy belongs to another organization');
        }
        break;
      }
      case 'QUOTATION': {
        const quote = await this.prisma.quotation.findUnique({
          where: { id: entityId },
          select: { companyId: true },
        });
        if (!quote) throw new NotFoundException(`Quotation ${entityId} not found`);
        if (quote.companyId && quote.companyId !== actorOrg) {
          throw new ForbiddenException('Quotation belongs to another organization');
        }
        break;
      }
      case 'CLAIM': {
        const claim = await this.prisma.claim.findUnique({
          where: { id: entityId },
          select: { companyId: true },
        });
        if (!claim) throw new NotFoundException(`Claim ${entityId} not found`);
        if (claim.companyId && claim.companyId !== actorOrg) {
          throw new ForbiddenException('Claim belongs to another organization');
        }
        break;
      }
      case 'CONTACT': {
        const contact = await this.prisma.contact.findUnique({
          where: { id: entityId },
          select: { companyId: true },
        });
        if (!contact) throw new NotFoundException(`Contact ${entityId} not found`);
        if (contact.companyId && contact.companyId !== actorOrg) {
          throw new ForbiddenException('Contact belongs to another organization');
        }
        break;
      }
      case 'CUSTOMER': {
        const customer = await this.prisma.customer.findUnique({
          where: { id: entityId },
          select: { companyId: true },
        });
        if (!customer) throw new NotFoundException(`Customer ${entityId} not found`);
        if (customer.companyId && customer.companyId !== actorOrg) {
          throw new ForbiddenException('Customer belongs to another organization');
        }
        break;
      }
      case 'ACCOUNT': {
        const account = await this.prisma.account.findUnique({
          where: { id: entityId },
          select: { createdBy: { select: { companyId: true } } },
        });
        if (!account) throw new NotFoundException(`Account ${entityId} not found`);
        const accOrg = account.createdBy?.companyId;
        if (accOrg && accOrg !== actorOrg) {
          throw new ForbiddenException('Account belongs to another organization');
        }
        break;
      }
      case 'ENDORSEMENT': {
        const endorsement = await this.prisma.endorsement.findUnique({
          where: { id: entityId },
          select: { policy: { select: { companyId: true } } },
        });
        if (!endorsement) throw new NotFoundException(`Endorsement ${entityId} not found`);
        const endOrg = endorsement.policy?.companyId;
        if (endOrg && endOrg !== actorOrg) {
          throw new ForbiddenException('Endorsement belongs to another organization');
        }
        break;
      }
    }
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
    const actorOrg = actor?.organizationId || (actor as any)?.companyId;
    if (
      !actor?.userId ||
      actor.userId !== uploadedById ||
      !actorOrg
    )
      throw new ForbiddenException(
        'Authenticated organizational context is required',
      );

    await this.validateEntityBelongsToOrg(entityType, entityId, actorOrg);
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
    const actorOrg = actor?.organizationId || (actor as any)?.companyId;
    if (!actor?.userId || !actorOrg)
      throw new ForbiddenException('Actor organizational context is required');

    await this.validateEntityBelongsToOrg(entityType, entityId, actorOrg);

    const page = pagination?.page || 1;
    const limit = pagination?.limit || 25;
    const sortBy = pagination?.sortBy || 'createdAt';
    const sortOrder = pagination?.sortOrder || 'desc';
    const skip = (page - 1) * limit;
    const isElevatedRole =
      actor.role === RoleType.ADMIN || actor.role === RoleType.BACK_OFFICE;
    const orgScope = actorOrg
      ? { uploadedBy: { companyId: actorOrg } }
      : {};
    const ownerScope = isElevatedRole ? {} : { uploadedById: actor.userId };
    const where = {
      entityType,
      entityId,
      status: { not: DocumentStatus.DELETED },
      ...orgScope,
      ...ownerScope,
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
    const actorOrg = actor?.organizationId || (actor as any)?.companyId;
    if (!actor?.userId || !actorOrg)
      throw new ForbiddenException('Actor organizational context is required');
    const page = pagination.page || 1;
    const limit = pagination.limit || 20;
    const skip = (page - 1) * limit;
    const where: any = {
      deletedAt: null,
      ...(actorOrg ? { uploadedBy: { companyId: actorOrg } } : {}),
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
