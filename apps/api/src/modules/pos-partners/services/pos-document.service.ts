import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, PosVerificationStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { CreatePosDocumentDto } from '../dto/pos-document.dto';
import type { RequestUser } from '../../auth/decorators/current-user.decorator';

@Injectable()
export class PosDocumentService {
  constructor(private readonly prisma: PrismaService) {}

  async uploadDocument(posPartnerId: string, dto: CreatePosDocumentDto, user: RequestUser) {
    const companyId = user.companyId || (user as any).organizationId;
    const partner = await this.prisma.posPartner.findFirst({
      where: { id: posPartnerId, companyId, deletedAt: null },
    });
    if (!partner) {
      throw new NotFoundException(`POS Partner '${posPartnerId}' not found`);
    }

    const doc = await this.prisma.posPartnerDocument.create({
      data: {
        posPartnerId,
        documentType: dto.documentType,
        storageKey: dto.storageKey,
        fileName: dto.fileName,
        mimeType: dto.mimeType || 'application/pdf',
        fileSize: dto.fileSize || 0,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
        verificationStatus: PosVerificationStatus.PENDING,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        action: AuditAction.CREATE,
        entity: 'POS_DOCUMENT',
        entityType: 'PosPartnerDocument',
        entityId: doc.id,
        userId: user.id,
        performedById: user.id,
        module: 'POS_PARTNER',
        metadata: {
          companyId,
          event: 'POS_DOCUMENT_UPLOADED',
          posPartnerId,
          documentType: dto.documentType,
          fileName: dto.fileName,
        },
      },
    }).catch(() => null);

    return doc;
  }

  async listDocuments(posPartnerId: string, companyId: string) {
    const partner = await this.prisma.posPartner.findFirst({
      where: { id: posPartnerId, companyId, deletedAt: null },
    });
    if (!partner) {
      throw new NotFoundException(`POS Partner '${posPartnerId}' not found`);
    }

    return this.prisma.posPartnerDocument.findMany({
      where: { posPartnerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async verifyDocument(
    documentId: string,
    status: PosVerificationStatus,
    rejectionReason?: string,
    user?: RequestUser,
  ) {
    const doc = await this.prisma.posPartnerDocument.findUnique({
      where: { id: documentId },
      include: { posPartner: true },
    });
    if (!doc) throw new NotFoundException(`Document '${documentId}' not found`);

    const updated = await this.prisma.posPartnerDocument.update({
      where: { id: documentId },
      data: {
        verificationStatus: status,
        verifiedById: user?.id || null,
        verifiedAt: new Date(),
        rejectionReason: status === PosVerificationStatus.REJECTED ? rejectionReason : null,
      },
    });

    // Check if all partner documents are verified
    if (status === PosVerificationStatus.VERIFIED) {
      const pendingDocs = await this.prisma.posPartnerDocument.count({
        where: {
          posPartnerId: doc.posPartnerId,
          verificationStatus: { not: PosVerificationStatus.VERIFIED },
        },
      });
      if (pendingDocs === 0) {
        await this.prisma.posPartner.update({
          where: { id: doc.posPartnerId },
          data: { verificationStatus: PosVerificationStatus.VERIFIED },
        });
      }
    }

    return updated;
  }
}
