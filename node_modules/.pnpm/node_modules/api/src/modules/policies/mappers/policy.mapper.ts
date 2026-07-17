import { PolicyResponseDto } from '../dto/policy-response.dto';
import { PolicyWithRelations } from '../repositories/policy.repository';

export class PolicyMapper {
  static toResponse(p: PolicyWithRelations): PolicyResponseDto {
    const dto = new PolicyResponseDto();
    dto.id = p.id;
    dto.policyNumber = p.policyNumber;
    dto.status = p.status;
    dto.quotationId = p.quotationId;
    dto.contactId = p.contactId;
    dto.accountId = p.accountId;
    dto.premiumAmount = Number(p.premiumAmount);
    dto.effectiveDate = p.effectiveDate;
    dto.expiryDate = p.expiryDate;
    dto.createdById = p.createdById;
    dto.updatedById = p.updatedById;
    dto.createdAt = p.createdAt;
    dto.updatedAt = p.updatedAt;

    if (p.members) {
      dto.members = p.members.map((m) => ({
        id: m.id,
        firstName: m.firstName,
        lastName: m.lastName,
        relation: m.relation,
        dateOfBirth: m.dateOfBirth,
      }));
    }

    if (p.nominees) {
      dto.nominees = p.nominees.map((n) => ({
        id: n.id,
        firstName: n.firstName,
        lastName: n.lastName,
        relation: n.relation,
        percentage: Number(n.percentage),
      }));
    }

    if (p.renewals) {
      dto.renewals = p.renewals.map((r) => ({
        id: r.id,
        renewalNumber: r.renewalNumber,
        previousExpiry: r.previousExpiry,
        newExpiry: r.newExpiry,
        premiumAmount: Number(r.premiumAmount),
        createdAt: r.createdAt,
      }));
    }

    if (p.payments) {
      dto.payments = p.payments.map((pay) => ({
        id: pay.id,
        amount: Number(pay.amount),
        paymentDate: pay.paymentDate,
        transactionId: pay.transactionId,
        paymentMethod: pay.paymentMethod,
        status: pay.status,
      }));
    }

    if (p.documents) {
      dto.documents = p.documents.map((doc) => ({
        id: doc.id,
        documentType: doc.documentType,
        fileKey: doc.fileKey,
        fileName: doc.fileName,
        fileSize: doc.fileSize,
        createdAt: doc.createdAt,
      }));
    }

    if (p.histories) {
      dto.histories = p.histories.map((h) => ({
        id: h.id,
        status: h.status,
        comments: h.comments,
        createdById: h.createdById,
        createdAt: h.createdAt,
      }));
    }

    return dto;
  }

  static toResponseList(policies: PolicyWithRelations[]): PolicyResponseDto[] {
    return policies.map((p) => this.toResponse(p));
  }
}
