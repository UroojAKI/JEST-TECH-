import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Report, ReportColumn, ReportFilter, ReportExecution, ReportSchedule } from '@prisma/client';
import { PrismaService } from '../../../../database/prisma.service';

const reportWithRelations = Prisma.validator<Prisma.ReportDefaultArgs>()({
  include: {
    columns: { orderBy: { order: 'asc' } },
    filters: true,
    schedules: true,
  },
});

export type ReportWithRelations = Prisma.ReportGetPayload<typeof reportWithRelations>;

@Injectable()
export class ReportsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    name: string;
    code: string;
    description?: string;
    category: any;
    module: any;
    type?: any;
    status?: any;
    isSystem?: boolean;
    shared?: boolean;
    parentId?: string;
    createdById?: string;
    columns: { field: string; label: string; type: string; sortable?: boolean; filterable?: boolean; visible?: boolean; order?: number; configuration?: any }[];
    filters?: { field: string; operator: any; defaultValue?: any; required?: boolean }[];
  }): Promise<ReportWithRelations> {
    return this.prisma.$transaction(async (tx) => {
      const report = await tx.report.create({
        data: {
          name: data.name,
          code: data.code,
          description: data.description,
          category: data.category,
          module: data.module,
          type: data.type || 'TABULAR',
          status: data.status || 'ACTIVE',
          isSystem: data.isSystem || false,
          shared: data.shared || false,
          parentId: data.parentId,
          createdById: data.createdById,
          columns: {
            create: data.columns.map((c) => ({
              field: c.field,
              label: c.label,
              type: c.type,
              sortable: c.sortable !== undefined ? c.sortable : true,
              filterable: c.filterable !== undefined ? c.filterable : true,
              visible: c.visible !== undefined ? c.visible : true,
              order: c.order || 0,
              configuration: c.configuration || Prisma.JsonNull,
            })),
          },
          filters: {
            create: (data.filters || []).map((f) => ({
              field: f.field,
              operator: f.operator,
              defaultValue: f.defaultValue !== undefined ? f.defaultValue : Prisma.JsonNull,
              required: f.required || false,
            })),
          },
        },
        include: {
          columns: { orderBy: { order: 'asc' } },
          filters: true,
          schedules: true,
        },
      });
      return report;
    });
  }

  async update(
    id: string,
    data: {
      name?: string;
      description?: string;
      category?: any;
      module?: any;
      type?: any;
      status?: any;
      shared?: boolean;
      parentId?: string;
      updatedById?: string;
      columns?: { field: string; label: string; type: string; sortable?: boolean; filterable?: boolean; visible?: boolean; order?: number; configuration?: any }[];
      filters?: { field: string; operator: any; defaultValue?: any; required?: boolean }[];
    },
  ): Promise<ReportWithRelations> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.report.findUnique({
        where: { id },
      });
      if (!existing) throw new NotFoundException(`Report with ID ${id} not found`);

      // Update basic fields
      const updateData: Prisma.ReportUpdateInput = {
        name: data.name,
        description: data.description,
        category: data.category,
        module: data.module,
        type: data.type,
        status: data.status,
        shared: data.shared,
        parent: data.parentId === null ? { disconnect: true } : (data.parentId ? { connect: { id: data.parentId } } : undefined),
        version: { increment: 1 },
        updatedBy: data.updatedById ? { connect: { id: data.updatedById } } : undefined,
      };

      if (data.columns) {
        // Drop old columns and insert new ones
        await tx.reportColumn.deleteMany({ where: { reportId: id } });
        updateData.columns = {
          create: data.columns.map((c) => ({
            field: c.field,
            label: c.label,
            type: c.type,
            sortable: c.sortable !== undefined ? c.sortable : true,
            filterable: c.filterable !== undefined ? c.filterable : true,
            visible: c.visible !== undefined ? c.visible : true,
            order: c.order || 0,
            configuration: c.configuration || Prisma.JsonNull,
          })),
        };
      }

      if (data.filters) {
        // Drop old filters and insert new ones
        await tx.reportFilter.deleteMany({ where: { reportId: id } });
        updateData.filters = {
          create: data.filters.map((f) => ({
            field: f.field,
            operator: f.operator,
            defaultValue: f.defaultValue !== undefined ? f.defaultValue : Prisma.JsonNull,
            required: f.required || false,
          })),
        };
      }

      return tx.report.update({
        where: { id },
        data: updateData,
        include: {
          columns: { orderBy: { order: 'asc' } },
          filters: true,
          schedules: true,
        },
      });
    });
  }

  async findById(id: string): Promise<ReportWithRelations | null> {
    return this.prisma.report.findUnique({
      where: { id, deletedAt: null },
      include: {
        columns: { orderBy: { order: 'asc' } },
        filters: true,
        schedules: true,
      },
    });
  }

  async findByCode(code: string): Promise<ReportWithRelations | null> {
    return this.prisma.report.findUnique({
      where: { code, deletedAt: null },
      include: {
        columns: { orderBy: { order: 'asc' } },
        filters: true,
        schedules: true,
      },
    });
  }

  async findAll(params: {
    category?: any;
    module?: any;
    status?: any;
    search?: string;
    isSystem?: boolean;
  }): Promise<ReportWithRelations[]> {
    return this.prisma.report.findMany({
      where: {
        deletedAt: null,
        category: params.category,
        module: params.module,
        status: params.status,
        isSystem: params.isSystem,
        ...(params.search && {
          OR: [
            { name: { contains: params.search, mode: 'insensitive' } },
            { code: { contains: params.search, mode: 'insensitive' } },
            { description: { contains: params.search, mode: 'insensitive' } },
          ],
        }),
      },
      include: {
        columns: { orderBy: { order: 'asc' } },
        filters: true,
        schedules: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async softDelete(id: string): Promise<void> {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) throw new NotFoundException(`Report with ID ${id} not found`);
    if (report.isSystem) throw new Error('Cannot delete a system-defined report template.');
    await this.prisma.report.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // --- Report Execution ---

  async createExecution(data: {
    reportId: string;
    requestedById?: string | null;
    status: any;
    parameters?: any;
  }): Promise<ReportExecution> {
    return this.prisma.reportExecution.create({
      data: {
        reportId: data.reportId,
        requestedById: data.requestedById,
        status: data.status,
        parameters: data.parameters || Prisma.JsonNull,
      },
    });
  }

  async updateExecution(
    id: string,
    data: {
      status?: any;
      duration?: number;
      filePath?: string;
      recordCount?: number;
      completedAt?: Date;
    },
  ): Promise<ReportExecution> {
    return this.prisma.reportExecution.update({
      where: { id },
      data,
    });
  }

  async getExecution(id: string): Promise<ReportExecution | null> {
    return this.prisma.reportExecution.findUnique({
      where: { id },
      include: { report: true },
    });
  }

  async getExecutions(reportId: string): Promise<ReportExecution[]> {
    return this.prisma.reportExecution.findMany({
      where: { reportId },
      orderBy: { startedAt: 'desc' },
      take: 50,
    });
  }

  // --- Report Schedules ---

  async createSchedule(data: {
    reportId: string;
    cronExpression: string;
    frequency: any;
    timezone?: string;
  }): Promise<ReportSchedule> {
    return this.prisma.reportSchedule.create({
      data: {
        reportId: data.reportId,
        cronExpression: data.cronExpression,
        frequency: data.frequency,
        timezone: data.timezone || 'UTC',
      },
    });
  }

  async updateSchedule(
    id: string,
    data: {
      cronExpression?: string;
      frequency?: any;
      timezone?: string;
      active?: boolean;
    },
  ): Promise<ReportSchedule> {
    return this.prisma.reportSchedule.update({
      where: { id },
      data,
    });
  }

  async deleteSchedule(id: string): Promise<void> {
    await this.prisma.reportSchedule.delete({ where: { id } });
  }

  async updateStats(reportId: string, duration: number): Promise<void> {
    const report = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (!report) return;

    const count = report.executionCount + 1;
    const newAverage = (report.averageDuration * report.executionCount + duration) / count;

    await this.prisma.report.update({
      where: { id: reportId },
      data: {
        executionCount: count,
        lastExecutedAt: new Date(),
        averageDuration: newAverage,
      },
    });
  }

  // --- Favorites ---
  async favorite(reportId: string, userId: string) {
    return this.prisma.favoriteReport.upsert({
      where: {
        userId_reportId: { userId, reportId },
      },
      create: { userId, reportId },
      update: {},
    });
  }

  async unfavorite(reportId: string, userId: string): Promise<void> {
    await this.prisma.favoriteReport.deleteMany({
      where: { userId, reportId },
    });
  }

  async isFavorite(reportId: string, userId: string): Promise<boolean> {
    const fav = await this.prisma.favoriteReport.findUnique({
      where: {
        userId_reportId: { userId, reportId },
      },
    });
    return !!fav;
  }

  async getFavorites(userId: string) {
    return this.prisma.report.findMany({
      where: {
        favorites: {
          some: { userId },
        },
      },
      include: {
        columns: { orderBy: { order: 'asc' } },
        filters: true,
      },
    });
  }

  // --- Saved Filters ---
  async saveFilter(reportId: string, userId: string, name: string, filters: any) {
    return this.prisma.savedFilter.upsert({
      where: {
        userId_name_reportId: { userId, name, reportId },
      },
      create: {
        userId,
        reportId,
        name,
        filters,
      },
      update: {
        filters,
      },
    });
  }

  async getSavedFilters(reportId: string, userId: string) {
    return this.prisma.savedFilter.findMany({
      where: { reportId, userId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async deleteSavedFilter(filterId: string, userId: string): Promise<void> {
    const filter = await this.prisma.savedFilter.findUnique({
      where: { id: filterId },
    });
    if (!filter) throw new NotFoundException(`Saved filter with ID ${filterId} not found`);
    if (filter.userId !== userId) throw new NotFoundException(`Saved filter with ID ${filterId} not found`);

    await this.prisma.savedFilter.delete({
      where: { id: filterId },
    });
  }
}
