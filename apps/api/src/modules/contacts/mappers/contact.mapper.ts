import { Contact } from '@prisma/client';
import { ContactResponseDto } from '../dto/contact-response.dto';

/**
 * ContactMapper — the only place that converts a Prisma Contact entity
 * into the public-facing ContactResponseDto.
 *
 * Rule: No Prisma model is ever returned directly from a controller.
 * All data must pass through this mapper first.
 *
 * When Contact gains relations (leads, policies, etc.), add them to
 * ContactWithRelations and extend toResponse() accordingly.
 */
export class ContactMapper {
  static toResponse(contact: Contact): ContactResponseDto {
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
      panNumber: contact.panNumber,
      aadhaarNumber: contact.aadhaarNumber,
      gstNumber: contact.gstNumber,
      createdById: contact.createdById,
      updatedById: contact.updatedById,
      accountId: contact.accountId,
      createdAt: contact.createdAt,
      updatedAt: contact.updatedAt,
    };
  }

  static toResponseList(contacts: Contact[]): ContactResponseDto[] {
    return contacts.map((c) => this.toResponse(c));
  }
}
