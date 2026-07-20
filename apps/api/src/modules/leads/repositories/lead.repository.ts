import { Injectable } from '@nestjs/common';
import { Prisma, Note, Activity } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import {
  BaseRepository,
  TransactionClient,
} from '../../../common/base/base.repository';
import { checkOptimisticLock } from '../../../common/utils/optimistic-lock';

export const leadBasicSelect = Prisma.validator<Prisma.LeadSelect>()({
  id: true,
  leadCode: true,
  title: true,
  description: true,
  status: true,
  source: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  deletedAt: true,
  contactId: true,
  accountId: true,
  assignedToId: true,
  createdById: true,
  updatedById: true,
  contact: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
    },
  },
  account: {
    select: {
      id: true,
      name: true,
      accountCode: true,
    },
  },
  assignedTo: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  },
});

export const leadDetailSelect = Prisma.validator<Prisma.LeadSelect>()({
  ...leadBasicSelect,
  description: true,
  notes: {
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      content: true,
      createdAt: true,
      createdById: true,
      createdBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  },
  activities: {
    where: { deletedAt: null },
    orderBy: { dueDate: 'asc' },
    select: {
      id: true,
      type: true,
      subject: true,
      description: true,
      dueDate: true,
      status: true,
      completedAt: true,
      assignedToId: true,
      createdById: true,
      createdAt: true,
    },
  },
});

export type LeadBasic = Prisma.LeadGetPayload<{
  select: typeof leadBasicSelect;
}>;
export type LeadDetail = Prisma.LeadGetPayload<{
  select: typeof leadDetailSelect;
}>;
// Backwards compatibility for existing code that uses LeadWithRelations
export type LeadWithRelations = LeadDetail;

@Injectable()
export class LeadRepository extends BaseRepository<
  Prisma.LeadDelegate,
  LeadBasic,
  LeadDetail
> {
  protected get basicArgs() {
    return { select: leadBasicSelect };
  }

  protected get detailArgs() {
    return { select: leadDetailSelect };
  }

  constructor(private readonly prismaService: PrismaService) {
    super(prismaService.lead);
  }

  async generateLeadCode(tx?: TransactionClient): Promise<string> {
    const result = await (tx || this.prismaService).$queryRaw<
      [{ nextval: bigint }]
    >`
      SELECT nextval('lead_number_seq')`;
    return `LEAD-${result[0].nextval.toString().padStart(6, '0')}`;
  }

  async create(
    data: Prisma.LeadCreateInput,
    tx?: TransactionClient,
  ): Promise<LeadDetail> {
    return this.getClient(tx).create({
      data,
      ...this.detailArgs,
    });
  }

  async update(
    id: string,
    data: Prisma.LeadUpdateInput,
    expectedVersion?: number,
    tx?: TransactionClient,
  ): Promise<LeadDetail> {
    if (expectedVersion !== undefined) {
      const nextVersion = await checkOptimisticLock(
        this.prismaService.lead,
        id,
        expectedVersion,
      );
      data.version = nextVersion;
    }
    return this.getClient(tx).update({
      where: { id },
      data,
      ...this.detailArgs,
    });
  }

  async findAll(
    where?: Prisma.LeadWhereInput,
    tx?: TransactionClient,
  ): Promise<LeadDetail[]> {
    return this.getClient(tx).findMany({
      where: {
        ...where,
        deletedAt: null,
      },
      ...this.detailArgs,
      orderBy: { createdAt: 'desc' },
    });
  }

  async addNote(
    leadId: string,
    content: string,
    createdById: string,
    tx?: TransactionClient,
  ): Promise<Note> {
    return (tx || this.prismaService).note.create({
      data: {
        content,
        lead: { connect: { id: leadId } },
        createdBy: { connect: { id: createdById } },
      },
    });
  }

  async createActivity(
    leadId: string,
    data: Prisma.ActivityCreateWithoutLeadInput,
    tx?: TransactionClient,
  ): Promise<Activity> {
    return (tx || this.prismaService).activity.create({
      data: {
        ...data,
        lead: { connect: { id: leadId } },
      },
    });
  }
}
