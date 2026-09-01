import { Injectable } from '@nestjs/common';
import { Contact, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

const contactOwnerInclude = {
  createdBy: {
    include: {
      branch: {
        include: { zone: { include: { region: { include: { company: true } } } } },
      },
      team: true,
    },
  },
} as const;

type ContactWithOwner = Prisma.ContactGetPayload<{ include: typeof contactOwnerInclude }>;

@Injectable()
export class ContactRepository {
  constructor(private readonly prisma: PrismaService) {}

  async generateContactCode(): Promise<string> {
    try {
      const result = await this.prisma.$queryRaw<[{ nextval: bigint }]>`SELECT nextval('contact_number_seq')`;
      return `CONT-${result[0].nextval.toString().padStart(6, '0')}`;
    } catch {
      await this.prisma.$executeRawUnsafe(`CREATE SEQUENCE IF NOT EXISTS contact_number_seq START 1;`);
      const retry = await this.prisma.$queryRaw<[{ nextval: bigint }]>`SELECT nextval('contact_number_seq')`;
      return `CONT-${retry[0].nextval.toString().padStart(6, '0')}`;
    }
  }

  async create(data: Prisma.ContactCreateInput): Promise<ContactWithOwner> {
    return this.prisma.contact.create({ data, include: contactOwnerInclude });
  }

  async findAll(where?: Prisma.ContactWhereInput, skip?: number, take?: number, orderBy?: Prisma.ContactOrderByWithRelationInput): Promise<ContactWithOwner[]> {
    return this.prisma.contact.findMany({ where: { ...where, deletedAt: null }, skip, take, orderBy: orderBy || { createdAt: 'desc' }, include: contactOwnerInclude });
  }

  async count(where?: Prisma.ContactWhereInput): Promise<number> {
    return this.prisma.contact.count({ where: { ...where, deletedAt: null } });
  }

  async findById(id: string): Promise<ContactWithOwner | null> {
    return this.prisma.contact.findFirst({ where: { id, deletedAt: null }, include: contactOwnerInclude });
  }

  async findByPhone(phone: string): Promise<Contact | null> {
    return this.prisma.contact.findFirst({ where: { phone, deletedAt: null } });
  }

  async findByEmail(email: string): Promise<Contact | null> {
    return this.prisma.contact.findFirst({ where: { email, deletedAt: null } });
  }

  async update(id: string, data: Prisma.ContactUpdateInput): Promise<ContactWithOwner> {
    return this.prisma.contact.update({ where: { id, deletedAt: null }, data, include: contactOwnerInclude });
  }

  async softDelete(id: string, deletedById: string): Promise<Contact> {
    return this.prisma.contact.update({ where: { id, deletedAt: null }, data: { deletedAt: new Date(), updatedById: deletedById } });
  }
}
