import { Injectable, NotFoundException, BadRequestException, Inject, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { STORAGE_PROVIDER_TOKEN } from '../storage/storage-provider.interface';
import type { StorageProvider } from '../storage/storage-provider.interface';
import { DocumentStatus, DocumentAccessAction, DocumentVerificationStatus, RoleType } from '@prisma/client';
import * as crypto from 'crypto';
import { PaginationDto } from '../../../common/pagination/pagination.dto';
import { PaginatedResponseDto } from '../../../common/pagination/paginated-response.dto';
import { ActorContext } from '../../../common/interfaces/actor-context.interface';

const GLOBAL_ROLES: RoleType[] = [RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.SYSTEM_ADMINISTRATOR, RoleType.MD_CEO];
const OPERATIONAL_ROLES: RoleType[] = [RoleType.OPERATIONS, RoleType.POLICY_ISSUANCE_EXECUTIVE, RoleType.UNDERWRITER, RoleType.FINANCE, RoleType.FINANCE_ACCOUNTS_EXECUTIVE, RoleType.CHIEF_FINANCE_OFFICER, RoleType.CLAIMS_OFFICER, RoleType.RENEWAL_EXECUTIVE, RoleType.CUSTOMER_SERVICE_EXECUTIVE];

@Injectable()
export class DocumentService {
  constructor(private readonly prisma: PrismaService, @Inject(STORAGE_PROVIDER_TOKEN) private readonly storage: StorageProvider) {}
  private calculateHash(buffer: Buffer): string { return crypto.createHash('sha256').update(buffer).digest('hex'); }
  private generateDocNumber(): string { return `DOC-${Date.now()}-${crypto.randomInt(0, 1000)}`; }

  private async getAuthorizedDocument(id: string, actor: ActorContext) {
    if (!actor?.userId || !actor.organizationId) throw new ForbiddenException('Actor organizational context is required');
    const doc = await this.prisma.document.findUnique({ where: { id }, include: { uploadedBy: { include: { branch: { include: { zone: { include: { region: { include: { company: true } } } } } }, team: true } } } });
    if (!doc || doc.status === DocumentStatus.DELETED) throw new NotFoundException('Document not found');
    const roles = actor.roles?.length ? actor.roles : [actor.role];
    if (roles.some((r) => GLOBAL_ROLES.includes(r))) return doc;
    const owner = doc.uploadedBy;
    const ownerOrg = owner?.branch?.zone?.region?.company?.id;
    if (!ownerOrg || ownerOrg !== actor.organizationId) throw new ForbiddenException('Document belongs to another organization');
    if (roles.some((r) => OPERATIONAL_ROLES.includes(r))) return doc;
    if (roles.includes(RoleType.BRANCH_MANAGER) || roles.includes(RoleType.MARKETING_DIRECTOR)) {
      if (!actor.branchId || owner.branchId !== actor.branchId) throw new ForbiddenException('Document belongs to another branch');
      return doc;
    }
    if (roles.includes(RoleType.TEAM_LEADER) || roles.includes(RoleType.SALES_MANAGER)) {
      if (!actor.teamId || owner.teamId !== actor.teamId) throw new ForbiddenException('Document belongs to another sales team');
      return doc;
    }
    if (owner.id !== actor.userId) throw new ForbiddenException('Document belongs to another owner');
    return doc;
  }

  async uploadDocument(params: { file: Express.Multer.File; name: string; entityType: string; entityId: string; uploadedById: string; category?: string; expiryDate?: Date; tags?: string[]; ipAddress?: string; actor?: ActorContext }) {
    const { file, name, entityType, entityId, uploadedById, category, expiryDate, tags = [], ipAddress, actor } = params;
    if (!file) throw new BadRequestException('No file provided');
    if (!actor?.userId || actor.userId !== uploadedById || !actor.organizationId) throw new ForbiddenException('Authenticated organizational context is required');
    const hash = this.calculateHash(file.buffer);
    const documentNumber = this.generateDocNumber(); const uniqueId = crypto.randomUUID();
    const storageKey = `${entityType}/${entityId}/${uniqueId}-${file.originalname}`;
    const key = await this.storage.uploadFile(file.buffer, storageKey, file.mimetype);
    const doc = await this.prisma.document.create({ data: { documentNumber, name, originalFileName: file.originalname, mimeType: file.mimetype, size: file.size, storageKey: key, storageProvider: this.storage.getProviderName(), hash, entityType, entityId, uploadedById, status: DocumentStatus.ACTIVE, version: 1, verificationStatus: DocumentVerificationStatus.PENDING, expiryDate, tags, metadata: { category } } });
    await this.prisma.documentVersion.create({ data: { documentId: doc.id, version: 1, storageKey: key, originalFileName: file.originalname, size: file.size, hash } });
    await this.prisma.documentAccessLog.create({ data: { documentId: doc.id, userId: uploadedById, action: DocumentAccessAction.VIEW, ipAddress } });
    return doc;
  }

  async replaceDocument(id: string, file: Express.Multer.File, userId: string, ipAddress?: string, actor?: ActorContext) {
    const doc = await this.getAuthorizedDocument(id, actor as ActorContext);
    if (!file) throw new BadRequestException('No file provided');
    const hash = this.calculateHash(file.buffer); const uniqueId = crypto.randomUUID();
    const storageKey = `${doc.entityType}/${doc.entityId}/${uniqueId}-${file.originalname}`; const newVersion = doc.version + 1;
    const key = await this.storage.uploadFile(file.buffer, storageKey, file.mimetype);
    const updated = await this.prisma.document.update({ where: { id }, data: { originalFileName: file.originalname, mimeType: file.mimetype, size: file.size, storageKey: key, hash, version: newVersion } });
    await this.prisma.documentVersion.create({ data: { documentId: id, version: newVersion, storageKey: key, originalFileName: file.originalname, size: file.size, hash } });
    await this.prisma.documentAccessLog.create({ data: { documentId: id, userId, action: DocumentAccessAction.VIEW, ipAddress } });
    return updated;
  }

  async downloadDocument(id: string, userId: string, ipAddress?: string, actor?: ActorContext) {
    const doc = await this.getAuthorizedDocument(id, actor as ActorContext);
    const fileBuffer = await this.storage.downloadFile(doc.storageKey);
    await this.prisma.documentAccessLog.create({ data: { documentId: id, userId, action: DocumentAccessAction.DOWNLOAD, ipAddress } });
    return { fileBuffer, originalFileName: doc.originalFileName, mimeType: doc.mimeType };
  }

  async getEntityDocuments(entityType: string, entityId: string, pagination?: PaginationDto, actor?: ActorContext) {
    if (!actor?.userId || !actor.organizationId) throw new ForbiddenException('Actor organizational context is required');
    const page = pagination?.page || 1; const limit = pagination?.limit || 10; const sortBy = pagination?.sortBy || 'createdAt'; const sortOrder = pagination?.sortOrder || 'desc'; const skip = (page - 1) * limit;
    const roles = actor.roles?.length ? actor.roles : [actor.role];
    const scope = roles.some((r) => GLOBAL_ROLES.includes(r)) ? {} : { uploadedById: actor.userId };
    const where = { entityType, entityId, status: { not: DocumentStatus.DELETED }, ...scope };
    const [data, total] = await Promise.all([this.prisma.document.findMany({ skip, take: limit, where, orderBy: { [sortBy]: sortOrder } }), this.prisma.document.count({ where })]);
    return new PaginatedResponseDto(data, total, page, limit);
  }

  async getDocumentDetails(id: string, actor: ActorContext) {
    const doc = await this.getAuthorizedDocument(id, actor);
    return this.prisma.document.findUnique({ where: { id }, include: { versions: { orderBy: { version: 'desc' } }, uploadedBy: { select: { firstName: true, lastName: true, email: true } } } });
  }

  async softDeleteDocument(id: string, userId: string, ipAddress?: string, actor?: ActorContext) {
    await this.getAuthorizedDocument(id, actor as ActorContext);
    await this.prisma.document.update({ where: { id }, data: { status: DocumentStatus.DELETED, deletedAt: new Date() } });
    await this.prisma.documentAccessLog.create({ data: { documentId: id, userId, action: DocumentAccessAction.DELETE, ipAddress } });
  }

  async restoreDocument(id: string, userId: string, ipAddress?: string, actor?: ActorContext) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');
    if (!actor?.userId || !actor.organizationId) throw new ForbiddenException('Actor organizational context is required');
    const roles = actor.roles?.length ? actor.roles : [actor.role];
    if (!roles.some((r) => GLOBAL_ROLES.includes(r))) throw new ForbiddenException('Only administrators can restore documents');
    await this.prisma.document.update({ where: { id }, data: { status: DocumentStatus.ACTIVE, deletedAt: null } });
    await this.prisma.documentAccessLog.create({ data: { documentId: id, userId, action: DocumentAccessAction.RESTORE, ipAddress } });
  }

  async getAccessLogs(id: string, actor: ActorContext) { await this.getAuthorizedDocument(id, actor); return this.prisma.documentAccessLog.findMany({ where: { documentId: id }, include: { user: { select: { firstName: true, lastName: true, email: true } } }, orderBy: { createdAt: 'desc' } }); }

  async findAll(pagination: PaginationDto, actor: ActorContext) {
    if (!actor?.userId || !actor.organizationId) throw new ForbiddenException('Actor organizational context is required');
    const page = pagination.page || 1; const limit = pagination.limit || 20; const skip = (page - 1) * limit;
    const roles = actor.roles?.length ? actor.roles : [actor.role];
    const where: any = { deletedAt: null };
    if (!roles.some((r) => GLOBAL_ROLES.includes(r))) where.uploadedById = actor.userId;
    const [data, total] = await Promise.all([this.prisma.document.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }), this.prisma.document.count({ where })]);
    return new PaginatedResponseDto(data, total, page, limit);
  }
}
