import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  ForbiddenException,
  Optional,
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
import { PdfService } from '../../quotation/engine/pdf.service';

/** Roles that can access all documents within their organisation */
const ELEVATED_ROLES: RoleType[] = [RoleType.ADMIN, RoleType.BACK_OFFICE];

@Injectable()
export class DocumentService {
  private readonly pdfService: PdfService;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER_TOKEN) private readonly storage: StorageProvider,
    @Optional() pdfService?: PdfService,
  ) {
    this.pdfService = pdfService || new PdfService();
  }
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
        if (!policy)
          throw new NotFoundException(`Policy ${entityId} not found`);
        if (policy.companyId && policy.companyId !== actorOrg) {
          throw new ForbiddenException(
            'Policy belongs to another organization',
          );
        }
        break;
      }
      case 'QUOTATION': {
        const quote = await this.prisma.quotation.findUnique({
          where: { id: entityId },
          select: { companyId: true },
        });
        if (!quote)
          throw new NotFoundException(`Quotation ${entityId} not found`);
        if (quote.companyId && quote.companyId !== actorOrg) {
          throw new ForbiddenException(
            'Quotation belongs to another organization',
          );
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
        if (!contact)
          throw new NotFoundException(`Contact ${entityId} not found`);
        if (contact.companyId && contact.companyId !== actorOrg) {
          throw new ForbiddenException(
            'Contact belongs to another organization',
          );
        }
        break;
      }
      case 'CUSTOMER': {
        const customer = await this.prisma.customer.findUnique({
          where: { id: entityId },
          select: { companyId: true },
        });
        if (!customer)
          throw new NotFoundException(`Customer ${entityId} not found`);
        if (customer.companyId && customer.companyId !== actorOrg) {
          throw new ForbiddenException(
            'Customer belongs to another organization',
          );
        }
        break;
      }
      case 'ACCOUNT': {
        const account = await this.prisma.account.findUnique({
          where: { id: entityId },
          select: { createdBy: { select: { companyId: true } } },
        });
        if (!account)
          throw new NotFoundException(`Account ${entityId} not found`);
        const accOrg = account.createdBy?.companyId;
        if (accOrg && accOrg !== actorOrg) {
          throw new ForbiddenException(
            'Account belongs to another organization',
          );
        }
        break;
      }
      case 'ENDORSEMENT': {
        const endorsement = await this.prisma.endorsement.findUnique({
          where: { id: entityId },
          select: { policy: { select: { companyId: true } } },
        });
        if (!endorsement)
          throw new NotFoundException(`Endorsement ${entityId} not found`);
        const endOrg = endorsement.policy?.companyId;
        if (endOrg && endOrg !== actorOrg) {
          throw new ForbiddenException(
            'Endorsement belongs to another organization',
          );
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
    if (!actor?.userId || actor.userId !== uploadedById || !actorOrg)
      throw new ForbiddenException(
        'Authenticated organizational context is required',
      );

    await this.validateEntityBelongsToOrg(entityType, entityId, actorOrg);
    const hash = this.calculateHash(file.buffer);
    const documentNumber = this.generateDocNumber();
    const uniqueId = crypto.randomUUID();
    const storageKey = `${entityType}/${entityId}/${uniqueId}-${file.originalname}`;

    let key = storageKey;
    let providerName = this.storage.getProviderName();
    let replicationStatus: 'SYNCED' | 'PENDING_REPLICATION' = 'SYNCED';

    if ('uploadWithFailover' in this.storage) {
      const result = await (this.storage as any).uploadWithFailover(
        file.buffer,
        storageKey,
        file.mimetype,
      );
      key = result.key;
      providerName = result.provider;
      replicationStatus = result.replicationStatus;
    } else {
      key = await this.storage.uploadFile(
        file.buffer,
        storageKey,
        file.mimetype,
      );
    }

    const doc = await this.prisma.document.create({
      data: {
        documentNumber,
        name,
        originalFileName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        storageKey: key,
        storageProvider: providerName,
        hash,
        entityType,
        entityId,
        uploadedById,
        status: DocumentStatus.ACTIVE,
        version: 1,
        verificationStatus: DocumentVerificationStatus.PENDING,
        expiryDate,
        tags,
        metadata: {
          category,
          checksum: hash,
          replicationStatus,
        },
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

    let key = storageKey;
    let providerName = this.storage.getProviderName();
    let replicationStatus: 'SYNCED' | 'PENDING_REPLICATION' = 'SYNCED';

    if ('uploadWithFailover' in this.storage) {
      const result = await (this.storage as any).uploadWithFailover(
        file.buffer,
        storageKey,
        file.mimetype,
      );
      key = result.key;
      providerName = result.provider;
      replicationStatus = result.replicationStatus;
    } else {
      key = await this.storage.uploadFile(
        file.buffer,
        storageKey,
        file.mimetype,
      );
    }

    const updated = await this.prisma.document.update({
      where: { id },
      data: {
        originalFileName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        storageKey: key,
        storageProvider: providerName,
        hash,
        version: newVersion,
        metadata: {
          ...((doc.metadata as any) || {}),
          checksum: hash,
          replicationStatus,
        },
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
    const actorOrg = actor?.organizationId || (actor as any)?.companyId;
    if (!actor?.userId || !actorOrg) {
      throw new ForbiddenException('Actor organizational context is required');
    }

    // 1. First attempt: check core Document table
    const coreDoc = await this.prisma.document.findUnique({
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

    if (coreDoc && coreDoc.status !== DocumentStatus.DELETED) {
      const owner = coreDoc.uploadedBy;
      const ownerOrg =
        owner?.companyId || owner?.branch?.zone?.region?.company?.id;

      if (ownerOrg && ownerOrg !== actorOrg) {
        throw new ForbiddenException('Document belongs to another organization');
      }

      const role = actor.role;
      if (role !== RoleType.ADMIN && role !== RoleType.BACK_OFFICE) {
        if (owner?.id && owner.id !== actor.userId) {
          throw new ForbiddenException('Document belongs to another owner');
        }
      }

      let fileBuffer: Buffer | null = null;
      try {
        if ('downloadWithReadRepair' in this.storage) {
          const repairResult = await (this.storage as any).downloadWithReadRepair(
            coreDoc.storageKey,
            coreDoc,
          );
          fileBuffer = repairResult.fileBuffer;
          if (repairResult.repaired) {
            await this.prisma.document.update({
              where: { id: coreDoc.id },
              data: {
                storageProvider: 'MINIO',
                metadata: {
                  ...((coreDoc.metadata as any) || {}),
                  replicationStatus: 'SYNCED',
                  repairedAt: new Date().toISOString(),
                },
              },
            });
          }
        } else {
          fileBuffer = await this.storage.downloadFile(coreDoc.storageKey);
        }
      } catch (storageErr) {
        fileBuffer = null;
      }

      if (!fileBuffer || fileBuffer.length === 0) {
        const generated = await this.pdfService.generateDocumentPdf(
          coreDoc.name || coreDoc.originalFileName || 'Archived Document',
          coreDoc.documentNumber || coreDoc.id,
          {
            'Document Identifier': coreDoc.documentNumber || coreDoc.id,
            'Original File Name': coreDoc.originalFileName || 'document.pdf',
            'Entity Type': coreDoc.entityType,
            'Entity ID': coreDoc.entityId,
            'Category': (coreDoc.metadata as any)?.category || coreDoc.mimeType || 'General',
            'Status': coreDoc.verificationStatus || coreDoc.status,
            'Archived Date': coreDoc.createdAt ? new Date(coreDoc.createdAt).toISOString() : new Date().toISOString(),
          },
        );
        fileBuffer = generated.buffer;
      }

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
        originalFileName: coreDoc.originalFileName,
        mimeType: coreDoc.mimeType || 'application/pdf',
      };
    }

    // 2. Check PolicyDocument table (e.g. POLICY_SCHEDULE, TAX_CERTIFICATE)
    const policyDoc = await this.prisma.policyDocument.findUnique({
      where: { id },
      include: {
        policy: {
          include: {
            quotation: true,
          },
        },
      },
    });

    if (policyDoc) {
      if (policyDoc.policy?.companyId && policyDoc.policy.companyId !== actorOrg) {
        throw new ForbiddenException('Document belongs to another organization');
      }

      let fileBuffer: Buffer | null = null;
      if (policyDoc.fileKey) {
        try {
          if ('downloadWithReadRepair' in this.storage) {
            const repairResult = await (this.storage as any).downloadWithReadRepair(
              policyDoc.fileKey,
              policyDoc,
            );
            fileBuffer = repairResult.fileBuffer;
          } else {
            fileBuffer = await this.storage.downloadFile(policyDoc.fileKey);
          }
        } catch {
          fileBuffer = null;
        }
      }

      if (!fileBuffer || fileBuffer.length === 0) {
        let title = 'Policy Schedule';
        if (policyDoc.documentType === 'TAX_CERTIFICATE') {
          title = 'Tax Exemption / GST Certificate';
        } else if (policyDoc.documentType === 'POLICY_SCHEDULE') {
          title = `${policyDoc.policy?.policyType || 'Insurance'} Policy Schedule`;
        } else {
          title = policyDoc.fileName || policyDoc.documentType || 'Official Policy Document';
        }

        const metadata: Record<string, any> = {
          'Policy Number': policyDoc.policy?.policyNumber || 'N/A',
          'Policy Type': policyDoc.policy?.policyType || 'Comprehensive Insurance',
          'Status': policyDoc.policy?.status || 'ACTIVE',
          'Start Date': policyDoc.policy?.startDate ? new Date(policyDoc.policy.startDate).toLocaleDateString() : 'N/A',
          'End Date': policyDoc.policy?.endDate ? new Date(policyDoc.policy.endDate).toLocaleDateString() : 'N/A',
          'Total Premium': `Rs. ${((policyDoc.policy as any)?.actualPremium || policyDoc.policy?.premiumAmount || policyDoc.policy?.quotation?.totalPremium || 0).toString()}`,
          'Document Type': policyDoc.documentType,
          'Issued At': policyDoc.createdAt ? new Date(policyDoc.createdAt).toISOString() : new Date().toISOString(),
        };

        if (policyDoc.documentType === 'TAX_CERTIFICATE') {
          metadata['GST Amount'] = `Rs. ${(policyDoc.policy?.quotation?.gstAmount || 0).toString()}`;
          metadata['Tax Category'] = 'Statutory GST (IRDAI Compliant)';
        }

        const generated = await this.pdfService.generateDocumentPdf(
          title,
          policyDoc.policy?.policyNumber || policyDoc.id,
          metadata,
        );
        fileBuffer = generated.buffer;

        try {
          await this.storage.uploadFile(fileBuffer, policyDoc.fileKey, 'application/pdf');
        } catch {}
      }

      return {
        fileBuffer,
        originalFileName: policyDoc.fileName || `${policyDoc.documentType}.pdf`,
        mimeType: 'application/pdf',
      };
    }

    // 3. Check QuotationDocument table
    const quoteDoc = await this.prisma.quotationDocument.findUnique({
      where: { id },
      include: {
        quotation: true,
      },
    });

    if (quoteDoc) {
      if (quoteDoc.quotation?.companyId && quoteDoc.quotation.companyId !== actorOrg) {
        throw new ForbiddenException('Quotation document belongs to another organization');
      }

      let fileBuffer: Buffer | null = null;
      if (quoteDoc.fileKey) {
        try {
          fileBuffer = await this.storage.downloadFile(quoteDoc.fileKey);
        } catch {
          fileBuffer = null;
        }
      }

      if (!fileBuffer || fileBuffer.length === 0) {
        const generated = await this.pdfService.generateDocumentPdf(
          quoteDoc.documentType || 'Quotation Document',
          quoteDoc.quotation?.quotationCode || quoteDoc.quotationId,
          {
            'Quotation Code': quoteDoc.quotation?.quotationCode || 'N/A',
            'Plan Name': (quoteDoc.quotation as any)?.planName || 'Standard Insurance Plan',
            'Total Premium': `Rs. ${(quoteDoc.quotation?.totalPremium ?? 0).toString()}`,
            'Base Premium': `Rs. ${(quoteDoc.quotation?.basePremium ?? 0).toString()}`,
            'GST Amount': `Rs. ${(quoteDoc.quotation?.gstAmount ?? 0).toString()}`,
            'Document Type': quoteDoc.documentType,
            'Created At': quoteDoc.createdAt ? new Date(quoteDoc.createdAt).toISOString() : new Date().toISOString(),
          },
        );
        fileBuffer = generated.buffer;
        try {
          await this.storage.uploadFile(fileBuffer, quoteDoc.fileKey, 'application/pdf');
        } catch {}
      }

      return {
        fileBuffer,
        originalFileName: quoteDoc.fileName || `${quoteDoc.documentType}.pdf`,
        mimeType: 'application/pdf',
      };
    }

    throw new NotFoundException('Document not found');
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
    const orgScope = actorOrg ? { uploadedBy: { companyId: actorOrg } } : {};
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
    const actorOrg = actor?.organizationId || (actor as any)?.companyId;
    if (!actor?.userId || !actorOrg)
      throw new ForbiddenException('Actor organizational context is required');

    const coreDoc = await this.prisma.document.findUnique({
      where: { id },
      include: {
        versions: { orderBy: { version: 'desc' } },
        uploadedBy: {
          select: { firstName: true, lastName: true, email: true, companyId: true },
        },
      },
    });

    if (coreDoc && coreDoc.status !== DocumentStatus.DELETED) {
      if (coreDoc.uploadedBy?.companyId && coreDoc.uploadedBy.companyId !== actorOrg) {
        throw new ForbiddenException('Document belongs to another organization');
      }
      return coreDoc;
    }

    // Fallback: check policyDocument
    const policyDoc = await this.prisma.policyDocument.findUnique({
      where: { id },
      include: { policy: true },
    });
    if (policyDoc) {
      if (policyDoc.policy?.companyId && policyDoc.policy.companyId !== actorOrg) {
        throw new ForbiddenException('Document belongs to another organization');
      }
      return {
        id: policyDoc.id,
        documentNumber: `POL-DOC-${policyDoc.id.slice(0, 8)}`,
        name: policyDoc.fileName,
        originalFileName: policyDoc.fileName,
        mimeType: 'application/pdf',
        size: policyDoc.fileSize,
        storageKey: policyDoc.fileKey,
        storageProvider: 'LOCAL',
        hash: '',
        entityType: 'POLICY',
        entityId: policyDoc.policyId,
        uploadedById: null,
        status: DocumentStatus.ACTIVE,
        version: 1,
        verificationStatus: DocumentVerificationStatus.VERIFIED,
        expiryDate: null,
        tags: [policyDoc.documentType],
        metadata: { documentType: policyDoc.documentType },
        createdAt: policyDoc.createdAt,
        updatedAt: policyDoc.createdAt,
        versions: [],
        uploadedBy: null,
      } as any;
    }

    throw new NotFoundException('Document not found');
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
    const actorOrg = actor?.organizationId || (actor as any)?.companyId;
    if (!actor?.userId || !actorOrg)
      throw new ForbiddenException('Actor organizational context is required');
    if (actor.role !== RoleType.ADMIN && actor.role !== RoleType.BACK_OFFICE)
      throw new ForbiddenException('Only administrators can restore documents');

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
    if (!doc) throw new NotFoundException('Document not found');

    const owner = doc.uploadedBy;
    const ownerOrg =
      owner?.companyId || owner?.branch?.zone?.region?.company?.id;

    if (!ownerOrg || ownerOrg !== actorOrg)
      throw new ForbiddenException('Document belongs to another organization');

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
