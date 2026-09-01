import { Contact } from '@prisma/client';
import { ContactResponseDto } from '../dto/contact-response.dto';
import { EncryptionUtil } from '../../../common/utils/encryption.util';

export class ContactMapper {
  static toResponse(contact: Contact & { createdBy?: { branch?: { id: string; name: string; code: string } | null } | null }, options?: { unmaskSensitive?: boolean }): ContactResponseDto {
    const shouldUnmask = options?.unmaskSensitive ?? false;
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
      panNumber: shouldUnmask ? contact.panNumber : EncryptionUtil.maskPan(contact.panNumber),
      aadhaarNumber: shouldUnmask ? contact.aadhaarNumber : EncryptionUtil.maskAadhaar(contact.aadhaarNumber),
      gstNumber: contact.gstNumber,
      createdById: contact.createdById,
      updatedById: contact.updatedById,
      accountId: contact.accountId,
      branch: contact.createdBy?.branch ?? null,
      createdAt: contact.createdAt,
      updatedAt: contact.updatedAt,
    };
  }

  static toResponseList(contacts: Array<Contact & { createdBy?: { branch?: { id: string; name: string; code: string } | null } | null }>, options?: { unmaskSensitive?: boolean }): ContactResponseDto[] {
    return contacts.map((contact) => this.toResponse(contact, options));
  }
}
