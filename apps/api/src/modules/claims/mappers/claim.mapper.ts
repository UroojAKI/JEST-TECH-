import { ClaimResponseDto } from '../dto/claim-response.dto';
import { ClaimWithRelations } from '../repositories/claim.repository';

export class ClaimMapper {
  static toResponse(c: ClaimWithRelations): ClaimResponseDto {
    const dto = new ClaimResponseDto();
    dto.id = c.id;
    dto.claimNumber = c.claimNumber;
    dto.status = c.status;
    dto.policyId = c.policyId;
    dto.contactId = c.contactId;
    dto.accountId = c.accountId;
    dto.incidentDate = c.incidentDate;
    dto.reportedDate = c.reportedDate;
    dto.description = c.description;
    dto.claimAmount = Number(c.claimAmount);
    dto.approvedAmount = c.approvedAmount ? Number(c.approvedAmount) : null;
    dto.surveyorName = c.surveyorName;
    dto.surveyorDetails = c.surveyorDetails;
    dto.createdById = c.createdById;
    dto.updatedById = c.updatedById;
    dto.createdAt = c.createdAt;
    dto.updatedAt = c.updatedAt;

    if (c.documents) {
      dto.documents = c.documents.map((doc) => ({
        id: doc.id,
        documentType: doc.documentType,
        fileKey: doc.fileKey,
        fileName: doc.fileName,
        fileSize: doc.fileSize,
        createdAt: doc.createdAt,
      }));
    }


    if (c.histories) {
      dto.histories = c.histories.map((h) => ({
        id: h.id,
        status: h.status,
        action: h.action,
        comments: h.comments,
        createdById: h.createdById,
        createdAt: h.createdAt,
      }));
    }

    if (c.communications) {
      dto.communications = c.communications.map((comm) => ({
        id: comm.id,
        senderId: comm.senderId,
        recipient: comm.recipient,
        channel: comm.channel,
        subject: comm.subject,
        body: comm.body,
        sentAt: comm.sentAt,
      }));
    }

    return dto;
  }

  static toResponseList(claims: ClaimWithRelations[]): ClaimResponseDto[] {
    return claims.map((c) => this.toResponse(c));
  }
}
