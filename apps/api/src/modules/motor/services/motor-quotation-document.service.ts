import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { AttachMotorDocumentDto, VerifyMotorDocumentDto } from '../dto/motor-quotation-document.dto';

interface RequestUser {
  id: string;
  companyId: string;
  role?: string;
  roles?: string[];
}

@Injectable()
export class MotorQuotationDocumentService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Attaches an existing Document to a Quotation with specific Motor Document classification
   * Reuses the platform StorageProvider & core Document storage
   */
  async attachDocument(quotationId: string, dto: AttachMotorDocumentDto, user: RequestUser) {
    const quotation = await this.prisma.quotation.findFirst({
      where: { id: quotationId, companyId: user.companyId },
    });

    if (!quotation) {
      throw new NotFoundException(`Quotation '${quotationId}' not found or access denied`);
    }

    // Verify document exists and belongs to the same tenant
    const document = await this.prisma.document.findFirst({
      where: {
        id: dto.documentId,
        deletedAt: null,
        uploadedBy: { companyId: user.companyId },
      },
    });

    if (!document) {
      throw new NotFoundException(`Document '${dto.documentId}' not found or access denied`);
    }

    return this.prisma.motorQuotationDocument.create({
      data: {
        companyId: user.companyId,
        quotationId,
        caseId: quotation.caseId || null,
        documentId: dto.documentId,
        documentType: dto.documentType,
        verificationStatus: 'PENDING',
      },
      include: {
        document: true,
      },
    });
  }

  /**
   * Retrieves all motor documents attached to a quotation
   */
  async getQuotationDocuments(quotationId: string, user: RequestUser) {
    const quotation = await this.prisma.quotation.findFirst({
      where: { id: quotationId, companyId: user.companyId },
    });

    if (!quotation) {
      throw new NotFoundException(`Quotation '${quotationId}' not found or access denied`);
    }

    return this.prisma.motorQuotationDocument.findMany({
      where: { quotationId, companyId: user.companyId },
      include: {
        document: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Reviews and verifies a motor quotation document
   */
  async verifyDocument(id: string, dto: VerifyMotorDocumentDto, user: RequestUser) {
    const motorDoc = await this.prisma.motorQuotationDocument.findFirst({
      where: { id, companyId: user.companyId },
    });

    if (!motorDoc) {
      throw new NotFoundException(`MotorQuotationDocument '${id}' not found or access denied`);
    }

    return this.prisma.motorQuotationDocument.update({
      where: { id },
      data: {
        verificationStatus: dto.status,
        rejectionReason: dto.status === 'REJECTED' ? (dto.rejectionReason || 'Rejected by reviewer') : null,
        verifiedById: user.id,
        verifiedAt: new Date(),
      },
      include: {
        document: true,
      },
    });
  }

  /**
   * Removes a document association from a quotation
   */
  async deleteQuotationDocument(id: string, user: RequestUser) {
    const motorDoc = await this.prisma.motorQuotationDocument.findFirst({
      where: { id, companyId: user.companyId },
    });

    if (!motorDoc) {
      throw new NotFoundException(`MotorQuotationDocument '${id}' not found or access denied`);
    }

    return this.prisma.motorQuotationDocument.delete({
      where: { id },
    });
  }
}