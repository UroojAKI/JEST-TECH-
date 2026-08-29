import { Injectable } from '@nestjs/common';
import { Contact, Prisma } from '@prisma/client';

import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class ContactRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Contact code generation — produces codes like CONT-000001, CONT-000002, etc.
  // Uses fallback count + timestamp if database sequence is uninitialized.
  // ---------------------------------------------------------------------------
  async generateContactCode(): Promise<string> {
    try {
      const result = await this.prisma.$queryRaw<[{ nextval: bigint }]>`
        SELECT nextval('contact_number_seq')`;
      return `CONT-${result[0].nextval.toString().padStart(6, '0')}`;
    } catch {
      await this.prisma.$executeRawUnsafe(
        `CREATE SEQUENCE IF NOT EXISTS contact_number_seq START 1;`,
      );
      const retry = await this.prisma.$queryRaw<[{ nextval: bigint }]>`
        SELECT nextval('contact_number_seq')`;
      return `CONT-${retry[0].nextval.toString().padStart(6, '0')}`;
    }
  }

  async create(data: Prisma.ContactCreateInput): Promise<Contact> {
    return this.prisma.contact.create({ data });
  }

  async findAll(
    where?: Prisma.ContactWhereInput,
    skip?: number,
    take?: number,
    orderBy?: Prisma.ContactOrderByWithRelationInput,
  ): Promise<Contact[]> {
    return this.prisma.contact.findMany({
      where: { ...where, deletedAt: null },
      skip,
      take,
      orderBy: orderBy || { createdAt: 'desc' },
    });
  }

  async count(where?: Prisma.ContactWhereInput): Promise<number> {
    return this.prisma.contact.count({
      where: { ...where, deletedAt: null },
    });
  }

  async findById(id: string): Promise<Contact | null> {
    return this.prisma.contact.findFirst({
      where: { id, deletedAt: null },
    });
  }

  async findByPhone(phone: string): Promise<Contact | null> {
    return this.prisma.contact.findFirst({
      where: { phone, deletedAt: null },
    });
  }

  async findByEmail(email: string): Promise<Contact | null> {
    return this.prisma.contact.findFirst({
      where: { email, deletedAt: null },
    });
  }

  async update(id: string, data: Prisma.ContactUpdateInput): Promise<Contact> {
    return this.prisma.contact.update({
      where: { id },
      data,
    });
  }

  async softDelete(id: string, deletedById: string): Promise<Contact> {
    return this.prisma.contact.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedById: deletedById,
      },
    });
  }
}
