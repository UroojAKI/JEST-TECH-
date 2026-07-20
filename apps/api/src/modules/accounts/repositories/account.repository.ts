import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { BaseRepository, TransactionClient } from '../../../common/base/base.repository';

export const accountBasicSelect = Prisma.validator<Prisma.AccountSelect>()({
  id: true,
  accountCode: true,
  name: true,
  type: true,
  industry: true,
  email: true,
  phone: true,
  website: true,
  gstNumber: true,
  panNumber: true,
  annualRevenue: true,
  status: true,
  employeeCount: true,
  preferredCommunication: true,
  preferredLanguage: true,
  kycStatus: true,
  kycCompletedAt: true,
  createdById: true,
  updatedById: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const accountDetailSelect = Prisma.validator<Prisma.AccountSelect>()({
  ...accountBasicSelect,
  description: true,
  contacts: {
    where: { deletedAt: null },
    select: {
      id: true,
      contactCode: true,
      type: true,
      firstName: true,
      middleName: true,
      lastName: true,
      gender: true,
      dateOfBirth: true,
      companyName: true,
      email: true,
      phone: true,
      alternatePhone: true,
      whatsappNumber: true,
      occupation: true,
      panNumber: true,
      aadhaarNumber: true,
      gstNumber: true,
      accountId: true,
      createdById: true,
      updatedById: true,
      createdAt: true,
      updatedAt: true,
      deletedAt: true,
    },
  },
});

export type AccountBasic = Prisma.AccountGetPayload<{ select: typeof accountBasicSelect }>;
export type AccountDetail = Prisma.AccountGetPayload<{ select: typeof accountDetailSelect }>;
// Backwards compatibility for existing code that uses AccountWithContacts
export type AccountWithContacts = AccountDetail;

@Injectable()
export class AccountRepository extends BaseRepository<Prisma.AccountDelegate, AccountBasic, AccountDetail> {
  protected get basicArgs() {
    return { select: accountBasicSelect };
  }

  protected get detailArgs() {
    return { select: accountDetailSelect };
  }

  constructor(private readonly prismaService: PrismaService) {
    super(prismaService.account);
  }

  async generateAccountCode(tx?: TransactionClient): Promise<string> {
    const result = await (tx || this.prismaService).$queryRaw<[{ nextval: bigint }]>`
      SELECT nextval('account_number_seq')`;
    return `ACC-${result[0].nextval.toString().padStart(6, '0')}`;
  }

  async create(data: Prisma.AccountCreateInput, tx?: TransactionClient): Promise<AccountDetail> {
    return this.getClient(tx).create({
      data,
      ...this.detailArgs,
    });
  }

  async update(id: string, data: Prisma.AccountUpdateInput, tx?: TransactionClient): Promise<AccountDetail> {
    return this.getClient(tx).update({
      where: { id },
      data,
      ...this.detailArgs,
    });
  }

  async findAll(tx?: TransactionClient): Promise<AccountDetail[]> {
    return this.getClient(tx).findMany({
      where: { deletedAt: null },
      ...this.detailArgs,
      orderBy: { createdAt: 'desc' },
    });
  }

  // Find methods specific to Account
  async findByGstNumber(gstNumber: string, tx?: TransactionClient): Promise<AccountDetail | null> {
    return this.getClient(tx).findFirst({
      where: { gstNumber, deletedAt: null },
      ...this.detailArgs,
    });
  }

  async findByPanNumber(panNumber: string, tx?: TransactionClient): Promise<AccountDetail | null> {
    return this.getClient(tx).findFirst({
      where: { panNumber, deletedAt: null },
      ...this.detailArgs,
    });
  }

  async findByName(name: string, tx?: TransactionClient): Promise<AccountDetail | null> {
    return this.getClient(tx).findFirst({
      where: { name, deletedAt: null },
      ...this.detailArgs,
    });
  }
}
