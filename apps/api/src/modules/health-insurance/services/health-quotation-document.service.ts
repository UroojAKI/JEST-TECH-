import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentVerificationStatus, HealthDocumentType } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { RequestUser } from '../../auth/decorators/current-user.decorator';
import { AttachHealthDocumentDto, VerifyHealthDocumentDto } from '../dto/health-quotation-case.dto';
import { HealthDocumentRuleService } from './health-document-rule.service';

const documentSelect = {
  id: true,
  documentNumber: true,
  name: true,
  originalFileName: true,
  mimeType: true,
  size: true,
  createdAt: true,
};

/**
 * Attaches uploaded files (via the shared /documents/upload endpoint) to Health cases and quotes,
 * and reports the Section C document checklist status.
 */
@Injectable()
export class HealthQuotationDocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ruleService: HealthDocumentRuleService,
  ) {}

  async attachDocument(caseId: string, dto: AttachHealthDocumentDto, user: RequestUser) {
    const healthCase = await this.findCase(caseId, user);

    if (dto.documentType === HealthDocumentType.QUOTE_DOCUMENT && !dto.quotationId) {
      throw new BadRequestException('quotationId is required for QUOTE_DOCUMENT uploads');
    }
    if (dto.quotationId) {
      const quote = await this.prisma.quotation.findFirst({
        where: { id: dto.quotationId, companyId: user.companyId, healthCaseId: healthCase.id },
      });
      if (!quote) {
        throw new BadRequestException(`Quotation '${dto.quotationId}' does not belong to case ${healthCase.caseCode}`);
      }
    }

    const document = await this.prisma.document.findFirst({
      where: { id: dto.documentId, deletedAt: null, uploadedBy: { companyId: user.companyId } },
    });
    if (!document) {
      throw new NotFoundException(`Document '${dto.documentId}' not found or access denied`);
    }

    return this.prisma.healthQuotationDocument.create({
      data: {
        companyId: user.companyId,
        caseId: healthCase.id,
        quotationId: dto.quotationId ?? null,
        documentId: dto.documentId,
        documentType: dto.documentType,
        verificationStatus: DocumentVerificationStatus.PENDING,
      },
      include: { document: { select: documentSelect } },
    });
  }

  /**
   * Returns the checklist for the case's category / policy form, merged with what has been uploaded,
   * plus the quote files grouped per quote.
   */
  async getChecklist(caseId: string, user: RequestUser) {
    const healthCase = await this.findCase(caseId, user);

    const uploaded = await this.prisma.healthQuotationDocument.findMany({
      where: { caseId: healthCase.id, companyId: user.companyId },
      include: { document: { select: documentSelect } },
      orderBy: { createdAt: 'desc' },
    });

    const checklist = this.ruleService
      .getRequirements(healthCase.planCategory, healthCase.policyForm)
      .map((requirement) => {
        const files = uploaded.filter((u) => u.documentType === requirement.documentType);
        const status = files.some((f) => f.verificationStatus === DocumentVerificationStatus.VERIFIED)
          ? 'VERIFIED'
          : files.length
            ? 'UPLOADED'
            : 'MISSING';
        return { ...requirement, status, files };
      });

    const missingRequired = checklist.filter((c) => c.required && c.status === 'MISSING').map((c) => c.documentType);
    const quoteDocuments = uploaded.filter((u) => u.documentType === HealthDocumentType.QUOTE_DOCUMENT);

    return {
      caseId: healthCase.id,
      caseCode: healthCase.caseCode,
      planCategory: healthCase.planCategory,
      policyForm: healthCase.policyForm,
      complete: missingRequired.length === 0,
      missingRequired,
      checklist,
      quoteDocuments,
    };
  }

  async verifyDocument(id: string, dto: VerifyHealthDocumentDto, user: RequestUser) {
    const record = await this.prisma.healthQuotationDocument.findFirst({
      where: { id, companyId: user.companyId },
    });
    if (!record) {
      throw new NotFoundException(`HealthQuotationDocument '${id}' not found or access denied`);
    }

    return this.prisma.healthQuotationDocument.update({
      where: { id },
      data: {
        verificationStatus: dto.status,
        rejectionReason:
          dto.status === DocumentVerificationStatus.REJECTED ? dto.rejectionReason || 'Rejected by reviewer' : null,
        verifiedById: user.id,
        verifiedAt: new Date(),
      },
      include: { document: { select: documentSelect } },
    });
  }

  async removeDocument(id: string, user: RequestUser) {
    const record = await this.prisma.healthQuotationDocument.findFirst({
      where: { id, companyId: user.companyId },
    });
    if (!record) {
      throw new NotFoundException(`HealthQuotationDocument '${id}' not found or access denied`);
    }
    await this.prisma.healthQuotationDocument.delete({ where: { id } });
    return { id, removed: true };
  }

  private async findCase(caseId: string, user: RequestUser) {
    const healthCase = await this.prisma.healthQuotationCase.findFirst({
      where: { id: caseId, companyId: user.companyId, deletedAt: null },
    });
    if (!healthCase) {
      throw new NotFoundException(`HealthQuotationCase '${caseId}' not found or access denied`);
    }
    return healthCase;
  }
}
