import { Injectable } from '@nestjs/common';
import { Contact, Prisma } from '@prisma/client';

import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class ContactRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Contact code generation — produces codes like CONT-000001, CONT-000002, etc.
  // Uses the total count (including soft-deleted) to avoid code collisions on delete.
  // ---------------------------------------------------------------------------
  async generateContactCode(): Promise<string> {
    const total = await this.prisma.contact.count();
    return `CONT-${(total + 1).toString().padStart(6, '0')}`;
  }

  async create(data: Prisma.ContactCreateInput): Promise<Contact> {
    return this.prisma.contact.create({ data });
  }

  async findAll(): Promise<Contact[]> {
    return this.prisma.contact.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string): Promise<Contact | null> {
    return this.prisma.contact.findUnique({
      where: { id },
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
