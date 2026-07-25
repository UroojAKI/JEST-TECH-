import { Contact } from '@prisma/client';
import { ContactResponseDto } from '../dto/contact-response.dto';
import { EncryptionUtil } from '../../../common/utils/encryption.util';

export class ContactMapper {
  static toResponse(
    contact: Contact,
    options?: { unmaskSensitive?: boolean },
  ): ContactResponseDto {
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
      // Enforce data masking for Aadhaar and PAN unless explicitly authorized
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
      createdAt: contact.createdAt,
      updatedAt: contact.updatedAt,
    };
  }

  static toResponseList(
    contacts: Contact[],
    options?: { unmaskSensitive?: boolean },
  ): ContactResponseDto[] {
    return contacts.map((c) => this.toResponse(c, options));
  }
}
