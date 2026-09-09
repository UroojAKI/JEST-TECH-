import { Account } from '@prisma/client';
import { AccountWithContacts } from '../repositories/account.repository';
import { AccountResponseDto } from '../dto/account-response.dto';
import { ContactMapper } from '../../contacts/mappers/contact.mapper';
import { EncryptionUtil } from '../../../common/utils/encryption.util';

export class AccountMapper {
  static toResponse(
    account: AccountWithContacts | Account,
    options?: { unmaskPii?: boolean },
  ): AccountResponseDto {
    const shouldUnmask = options?.unmaskPii === true;
    const response = new AccountResponseDto();
    response.id = account.id;
    response.accountCode = account.accountCode;
    response.name = account.name;
    response.type = account.type;
    response.industry = account.industry;
    response.website = account.website;
    response.email = account.email;
    response.phone = account.phone;
    response.gstNumber = account.gstNumber;
    // EPIC-34: Mask PAN in API responses to prevent PII exposure.
    // Full PAN is only returned to privileged roles via unmasked endpoint.
    response.panNumber = shouldUnmask
      ? account.panNumber
      : EncryptionUtil.maskPan(account.panNumber);
    response.annualRevenue = account.annualRevenue
      ? Number(account.annualRevenue)
      : null;
    response.employeeCount = account.employeeCount;
    response.description = account.description;
    response.status = account.status;
    response.preferredCommunication = account.preferredCommunication;
    response.preferredLanguage = account.preferredLanguage;
    response.kycStatus = account.kycStatus;
    response.kycCompletedAt = account.kycCompletedAt;
    response.createdById = account.createdById;
    response.updatedById = account.updatedById;
    response.createdAt = account.createdAt;
    response.updatedAt = account.updatedAt;

    if ('contacts' in account && account.contacts) {
      response.contacts = ContactMapper.toResponseList(account.contacts);
    }

    return response;
  }

  static toResponseList(
    accounts: (AccountWithContacts | Account)[],
    options?: { unmaskPii?: boolean },
  ): AccountResponseDto[] {
    return accounts.map((a) => this.toResponse(a, options));
  }
}
