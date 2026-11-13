import { Contact } from '@prisma/client';
import { ContactResponseDto } from '../dto/contact-response.dto';
import { EncryptionUtil } from '../../../common/utils/encryption.util';

export class ContactMapper {
  static toResponse(
    contact: any,
    options?: { unmaskSensitive?: boolean },
  ): ContactResponseDto {
    const shouldUnmask = options?.unmaskSensitive ?? false;
    const displayAgentCode =
      contact.assignedExternalCode?.externalCode ||
      (contact.agentCode && !/^AGT-/i.test(contact.agentCode) ? contact.agentCode : null);
    return {
      id: contact.id,
      contactCode: contact.contactCode,
      type: contact.type,
      firstName: contact.firstName,
      middleName: contact.middleName,
      lastName: contact.lastName,
      gender: contact.gender,
      dateOfBirth: contact.dateOfBirth,
      companyName: contact.companyName,
      email: contact.email,
      phone: contact.phone,
      alternatePhone: contact.alternatePhone,
      whatsappNumber: contact.whatsappNumber,
      occupation: contact.occupation,
      panNumber: shouldUnmask
        ? contact.panNumber
        : EncryptionUtil.maskPan(contact.panNumber),
      aadhaarNumber: shouldUnmask
        ? contact.aadhaarNumber
        : EncryptionUtil.maskAadhaar(contact.aadhaarNumber),
      gstNumber: contact.gstNumber,
      createdById: contact.createdById,
      updatedById: contact.updatedById,
      accountId: contact.accountId,
      assignedAgentId: contact.assignedAgentId ?? null,
      assignedExternalCodeId: contact.assignedExternalCodeId ?? null,
      branchId:
        contact.branchId ??
        contact.branch?.id ??
        contact.createdBy?.branch?.id ??
        null,
      companyId: contact.companyId ?? contact.company?.id ?? null,
      branch: contact.branch ?? contact.createdBy?.branch ?? null,
      agentCode: displayAgentCode,
      agent: contact.assignedAgent
        ? `${contact.assignedAgent.user?.firstName || ''} ${contact.assignedAgent.user?.lastName || ''}`.trim() +
          (displayAgentCode ? ` (${displayAgentCode})` : '')
        : contact.createdBy
          ? `${contact.createdBy.firstName || ''} ${contact.createdBy.lastName || ''}`.trim()
          : null,
      status: contact.deletedAt ? 'INACTIVE' : contact.status || 'ACTIVE',
      isOldCustomer: Boolean(contact.isOldCustomer),
      createdAt: contact.createdAt,
      updatedAt: contact.updatedAt,
    };
  }

  static toResponseList(
    contacts: any[],
    options?: { unmaskSensitive?: boolean },
  ): ContactResponseDto[] {
    return (contacts || []).map((contact) => this.toResponse(contact, options));
  }
}
