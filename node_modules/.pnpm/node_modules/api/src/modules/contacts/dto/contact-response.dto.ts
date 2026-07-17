import { ContactType, Gender } from '@prisma/client';

export class ContactResponseDto {
  id: string;

  contactCode: string;

  type: ContactType;

  firstName: string;

  middleName: string | null;

  lastName: string;

  gender: Gender | null;

  dateOfBirth: Date | null;

  companyName: string | null;

  email: string | null;

  phone: string;

  alternatePhone: string | null;

  whatsappNumber: string | null;

  occupation: string | null;

  panNumber: string | null;

  aadhaarNumber: string | null;

  gstNumber: string | null;

  createdById: string | null;

  updatedById: string | null;

  accountId: string | null;

  createdAt: Date;

  updatedAt: Date;
}
