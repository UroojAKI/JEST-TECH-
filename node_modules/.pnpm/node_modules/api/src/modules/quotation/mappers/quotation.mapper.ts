import { QuotationResponseDto } from '../dto/quotation-response.dto';
import { QuotationWithRelations } from '../repositories/quotation.repository';

export class QuotationMapper {
  static toResponse(q: QuotationWithRelations): QuotationResponseDto {
    const dto = new QuotationResponseDto();
    dto.id = q.id;
    dto.quotationCode = q.quotationCode;
    dto.title = q.title;
    dto.status = q.status;
    dto.leadId = q.leadId;
    dto.contactId = q.contactId;
    dto.accountId = q.accountId;
    dto.insurerName = q.insurerName;
    dto.productType = q.productType;
    dto.sumInsured = Number(q.sumInsured);
    dto.basePremium = Number(q.basePremium);
    dto.gstAmount = Number(q.gstAmount);
    dto.totalPremium = Number(q.totalPremium);
    dto.ncbPercentage = q.ncbPercentage;
    dto.discountAmount = Number(q.discountAmount);
    dto.expiryDate = q.expiryDate;
    dto.createdById = q.createdById;
    dto.updatedById = q.updatedById;
    dto.createdAt = q.createdAt;
    dto.updatedAt = q.updatedAt;

    if (q.versions) {
      dto.versions = q.versions.map((v) => ({
        id: v.id,
        versionNumber: v.versionNumber,
        sumInsured: Number(v.sumInsured),
        basePremium: Number(v.basePremium),
        gstAmount: Number(v.gstAmount),
        totalPremium: Number(v.totalPremium),
        discountAmount: Number(v.discountAmount),
        metadata: v.metadata,
        createdById: v.createdById,
        createdAt: v.createdAt,
      }));
    }

    if (q.addons) {
      dto.addons = q.addons.map((a) => ({
        id: a.id,
        addonCode: a.addonCode,
        addonName: a.addonName,
        premium: Number(a.premium),
        description: a.description,
      }));
    }

    if (q.discounts) {
      dto.discounts = q.discounts.map((d) => ({
        id: d.id,
        discountType: d.discountType,
        percentage: d.percentage ? Number(d.percentage) : null,
        amount: Number(d.amount),
        description: d.description,
      }));
    }

    if (q.histories) {
      dto.histories = q.histories.map((h) => ({
        id: h.id,
        status: h.status,
        comments: h.comments,
        createdById: h.createdById,
        createdAt: h.createdAt,
      }));
    }

    if (q.documents) {
      dto.documents = q.documents.map((doc) => ({
        id: doc.id,
        documentType: doc.documentType,
        fileKey: doc.fileKey,
        fileName: doc.fileName,
        fileSize: doc.fileSize,
        createdAt: doc.createdAt,
      }));
    }

    return dto;
  }

  static toResponseList(quotations: QuotationWithRelations[]): QuotationResponseDto[] {
    return quotations.map((q) => this.toResponse(q));
  }
}
