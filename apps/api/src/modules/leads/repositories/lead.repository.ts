import { Injectable } from '@nestjs/common';
import { Prisma, Lead, Note, Activity } from '@prisma/client';

import { PrismaService } from '../../../database/prisma.service';

import { checkOptimisticLock } from '../../../common/utils/optimistic-lock';

const leadWithRelations = Prisma.validator<Prisma.LeadDefaultArgs>()({
  include: {
    contact: true,
    account: true,
    assignedTo: true,
    notes: {
      where: {
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    },
    activities: {
      where: {
        deletedAt: null,
      },
      orderBy: {
        dueDate: 'asc',
      },
    },
  },
});

export type LeadWithRelations = Prisma.LeadGetPayload<typeof leadWithRelations>;

@Injectable()
export class LeadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async generateLeadCode(): Promise<string> {
    const result = await this.prisma.$queryRaw<[{ nextval: bigint }]>`
      SELECT nextval('lead_number_seq')`;
    return `LEAD-${result[0].nextval.toString().padStart(6, '0')}`;
  }

  async create(data: Prisma.LeadCreateInput): Promise<LeadWithRelations> {
    return this.prisma.lead.create({
      data,
      include: {
        contact: true,
        account: true,
        assignedTo: true,
        notes: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
        },
        activities: {
          where: { deletedAt: null },
          orderBy: { dueDate: 'asc' },
        },
      },
    });
  }

  async findAll(where?: Prisma.LeadWhereInput): Promise<LeadWithRelations[]> {
    return this.prisma.lead.findMany({
      where: {
        ...where,
        deletedAt: null,
      },
      include: {
        contact: true,
        account: true,
        assignedTo: true,
        notes: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
        },
        activities: {
          where: { deletedAt: null },
          orderBy: { dueDate: 'asc' },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findById(id: string): Promise<LeadWithRelations | null> {
    return this.prisma.lead.findFirst({
      where: { id, deletedAt: null },
      include: {
        contact: true,
        account: true,
        assignedTo: true,
        notes: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
        },
        activities: {
          where: { deletedAt: null },
          orderBy: { dueDate: 'asc' },
        },
      },
    });
  }

  async update(id: string, data: Prisma.LeadUpdateInput, expectedVersion?: number): Promise<LeadWithRelations> {
    if (expectedVersion !== undefined) {
      const nextVersion = await checkOptimisticLock(this.prisma.lead, id, expectedVersion);
      data.version = nextVersion;
    }
    return this.prisma.lead.update({
      where: { id },
      data,
      include: {
        contact: true,
        account: true,
        assignedTo: true,
        notes: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
        },
        activities: {
          where: { deletedAt: null },
          orderBy: { dueDate: 'asc' },
        },
      },
    });
  }

  async softDelete(id: string, deletedById: string): Promise<LeadWithRelations> {
    return this.prisma.lead.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedById: deletedById,
      },
      include: {
        contact: true,
        account: true,
        assignedTo: true,
        notes: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
        },
        activities: {
          where: { deletedAt: null },
          orderBy: { dueDate: 'asc' },
        },
      },
    });
  }

  async addNote(leadId: string, content: string, createdById: string): Promise<Note> {
    return this.prisma.note.create({
      data: {
        content,
        lead: { connect: { id: leadId } },
        createdBy: { connect: { id: createdById } },
      },
    });
  }

  async createActivity(leadId: string, data: Prisma.ActivityCreateWithoutLeadInput): Promise<Activity> {
    return this.prisma.activity.create({
      data: {
        ...data,
        lead: { connect: { id: leadId } },
      },
    });
  }
}
