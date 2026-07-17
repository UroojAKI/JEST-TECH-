import { Injectable } from '@nestjs/common';
import { Prisma, Account } from '@prisma/client';

import { PrismaService } from '../../../database/prisma.service';

const accountWithContacts = Prisma.validator<Prisma.AccountDefaultArgs>()({
  include: {
    contacts: {
      where: {
        deletedAt: null,
      },
    },
  },
});

export type AccountWithContacts = Prisma.AccountGetPayload<typeof accountWithContacts>;

@Injectable()
export class AccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  async generateAccountCode(): Promise<string> {
    const total = await this.prisma.account.count();
    return `ACC-${(total + 1).toString().padStart(6, '0')}`;
  }

  async create(data: Prisma.AccountCreateInput): Promise<AccountWithContacts> {
    return this.prisma.account.create({
      data,
      include: {
        contacts: {
          where: {
            deletedAt: null,
          },
        },
      },
    });
  }

  async findAll(): Promise<AccountWithContacts[]> {
    return this.prisma.account.findMany({
      where: {
        deletedAt: null,
      },
      include: {
        contacts: {
          where: {
            deletedAt: null,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findById(id: string): Promise<AccountWithContacts | null> {
    return this.prisma.account.findUnique({
      where: { id },
      include: {
        contacts: {
          where: {
            deletedAt: null,
          },
        },
      },
    });
  }

  async findByGstNumber(gstNumber: string): Promise<AccountWithContacts | null> {
    return this.prisma.account.findFirst({
      where: { gstNumber, deletedAt: null },
      include: {
        contacts: {
          where: {
            deletedAt: null,
          },
        },
      },
    });
  }

  async findByPanNumber(panNumber: string): Promise<AccountWithContacts | null> {
    return this.prisma.account.findFirst({
      where: { panNumber, deletedAt: null },
      include: {
        contacts: {
          where: {
            deletedAt: null,
          },
        },
      },
    });
  }

  async findByName(name: string): Promise<AccountWithContacts | null> {
    return this.prisma.account.findFirst({
      where: { name, deletedAt: null },
      include: {
        contacts: {
          where: {
            deletedAt: null,
          },
        },
      },
    });
  }

  async update(id: string, data: Prisma.AccountUpdateInput): Promise<AccountWithContacts> {
    return this.prisma.account.update({
      where: { id },
      data,
      include: {
        contacts: {
          where: {
            deletedAt: null,
          },
        },
      },
    });
  }

  async softDelete(id: string, deletedById: string): Promise<AccountWithContacts> {
    return this.prisma.account.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedById: deletedById,
      },
      include: {
        contacts: {
          where: {
            deletedAt: null,
          },
        },
      },
    });
  }
}
