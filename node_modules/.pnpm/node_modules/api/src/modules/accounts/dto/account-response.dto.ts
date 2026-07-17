import { AccountType, CommunicationChannel, KycStatus } from '@prisma/client';
import { ContactResponseDto } from '../../contacts/dto/contact-response.dto';

export class AccountResponseDto {
  id: string;

  accountCode: string;

  name: string;

  type: AccountType;

  industry: string | null;

  website: string | null;

  email: string | null;

  phone: string | null;

  gstNumber: string | null;

  panNumber: string | null;

  annualRevenue: number | null;

  employeeCount: number | null;

  description: string | null;

  status: boolean;

  preferredCommunication: CommunicationChannel;

  preferredLanguage: string | null;

  kycStatus: KycStatus;

  kycCompletedAt: Date | null;

  createdById: string | null;

  updatedById: string | null;

  createdAt: Date;

  updatedAt: Date;

  contacts?: ContactResponseDto[];
}
