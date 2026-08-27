import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  DocumentStatus,
  DocumentVerificationStatus,
  DocumentAccessAction,
} from '@prisma/client';

export type DocumentLifecycleState = 'UPLOADED' | 'UNDER_REVIEW' | 'VERIFIED' | 'REJECTED';

export interface VerifyDocumentDto {
  status: 'VERIFIED' | 'REJECTED';
  rejectionReason?: string;
  notes?: string;
}

@Injectable()
export class DocumentVerificationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Transitions a document to UNDER_REVIEW.
   * G017: Uploading a file does not equal verified; explicit under-review gate.
   */
  async startReview(documentId: string, reviewerId: string, ipAddress?: string) {
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, deletedAt: null },
    });

    if (!doc) {
      throw new NotFoundException(`Document with ID ${documentId} not found`);
    }

    const metadata = (doc.metadata as Record<string, any>) || {};
    const currentState: DocumentLifecycleState = metadata.lifecycleState || 'UPLOADED';

    if (currentState !== 'UPLOADED' && currentState !== 'REJECTED') {
      throw new BadRequestException(
        `Cannot start review for document in "${currentState}" state. Must be UPLOADED or REJECTED.`,
      );
    }

    const updated = await this.prisma.document.update({
      where: { id: documentId },
      data: {
        verificationStatus: DocumentVerificationStatus.PENDING,
        metadata: {
          ...metadata,
          lifecycleState: 'UNDER_REVIEW',
          reviewStartedAt: new Date().toISOString(),
          reviewerId,
        },
      },
    });

    await this.prisma.documentAccessLog.create({
      data: {
        documentId,
        userId: reviewerId,
        action: DocumentAccessAction.VIEW,
        ipAddress,
      },
    });

    return {
      documentId: updated.id,
      lifecycleState: 'UNDER_REVIEW',
      verificationStatus: updated.verificationStatus,
      reviewerId,
      message: 'Document review in progress.',
    };
  }

  /**
   * Verifies or Rejects a document.
   * G017: Enforces strict separation of duties: uploader cannot verify their own document.
   */
  async submitVerification(
    documentId: string,
    dto: VerifyDocumentDto,
    verifierId: string,
    ipAddress?: string,
  ) {
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, deletedAt: null },
    });

    if (!doc) {
      throw new NotFoundException(`Document with ID ${documentId} not found`);
    }

    // Separation of duties check
    if (doc.uploadedById === verifierId) {
      throw new ForbiddenException(
        'Segregation of duties violation: The user who uploaded the document cannot verify it. An independent operations/underwriting officer must verify.',
      );
    }

    const metadata = (doc.metadata as Record<string, any>) || {};
    const currentState: DocumentLifecycleState = metadata.lifecycleState || 'UPLOADED';

    if (currentState !== 'UNDER_REVIEW') {
      throw new BadRequestException(
        `Document must be placed "UNDER_REVIEW" before it can be verified or rejected. Current state: "${currentState}".`,
      );
    }

    if (dto.status === 'REJECTED' && (!dto.rejectionReason || !dto.rejectionReason.trim())) {
      throw new BadRequestException('A non-empty rejectionReason is mandatory when rejecting a document.');
    }

    const newVerificationStatus =
      dto.status === 'VERIFIED'
        ? DocumentVerificationStatus.VERIFIED
        : DocumentVerificationStatus.REJECTED;

    const newLifecycleState: DocumentLifecycleState =
      dto.status === 'VERIFIED' ? 'VERIFIED' : 'REJECTED';

    const updated = await this.prisma.document.update({
      where: { id: documentId },
      data: {
        verificationStatus: newVerificationStatus,
        metadata: {
          ...metadata,
          lifecycleState: newLifecycleState,
          verifiedAt: new Date().toISOString(),
          verifierId,
          rejectionReason: dto.rejectionReason || null,
          verificationNotes: dto.notes || null,
        },
      },
    });

    await this.prisma.documentAccessLog.create({
      data: {
        documentId,
        userId: verifierId,
        action: DocumentAccessAction.VIEW,
        ipAddress,
      },
    });

    return {
      documentId: updated.id,
      lifecycleState: newLifecycleState,
      verificationStatus: updated.verificationStatus,
      verifierId,
      rejectionReason: dto.rejectionReason,
      message: dto.status === 'VERIFIED' ? 'Document verified successfully.' : 'Document rejected.',
    };
  }

  /**
   * Retrieves verification status and audit history of a document.
   */
  async getVerificationStatus(documentId: string) {
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, deletedAt: null },
      include: {
        uploadedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    if (!doc) {
      throw new NotFoundException(`Document with ID ${documentId} not found`);
    }

    const metadata = (doc.metadata as Record<string, any>) || {};

    return {
      documentId: doc.id,
      documentNumber: doc.documentNumber,
      name: doc.name,
      entityType: doc.entityType,
      entityId: doc.entityId,
      uploadedBy: doc.uploadedBy,
      uploadedAt: doc.createdAt,
      lifecycleState: metadata.lifecycleState || 'UPLOADED',
      verificationStatus: doc.verificationStatus,
      verifierId: metadata.verifierId,
      verifiedAt: metadata.verifiedAt,
      rejectionReason: metadata.rejectionReason,
    };
  }
}
