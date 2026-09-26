import { Test, TestingModule } from '@nestjs/testing';
import { ReportsController } from '../controllers/reports.controller';
import { SchedulerService } from '../services/scheduler.service';
import { PrismaService } from '../../../../database/prisma.service';
import { ReportCommandsService } from '../commands/report-commands.service';
import { ReportQueriesService } from '../queries/report-queries.service';
import { ReportDataProviderRegistry } from '../services/report-data-provider-registry.service';
import { ExportService } from '../services/export.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RoleType } from '@prisma/client';

describe('Reporting Tenancy & Database Persistence (Phases 18, 19, 20)', () => {
  let controller: ReportsController;
  let scheduler: SchedulerService;
  let mockPrisma: any;
  let mockCommands: any;
  let mockQueries: any;

  const mockUserTenantA = {
    id: 'user-a',
    email: 'user-a@org-a.com',
    companyId: 'org-a',
    organizationId: 'org-a',
    role: RoleType.ADMIN,
  };

  const mockUserTenantB = {
    id: 'user-b',
    email: 'user-b@org-b.com',
    companyId: 'org-b',
    organizationId: 'org-b',
    role: RoleType.ADMIN,
  };

  beforeEach(async () => {
    mockPrisma = {
      report: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
      reportSchedule: {
        findMany: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
        update: jest.fn(),
      },
      reportExecution: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
    };

    mockCommands = {
      handleCreateSchedule: jest.fn(),
      handleDeleteSchedule: jest.fn().mockResolvedValue({ success: true }),
      handleExecuteReport: jest.fn(),
    };

    mockQueries = {
      handleGetReports: jest.fn(),
      handleGetReport: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        SchedulerService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ReportCommandsService, useValue: mockCommands },
        { provide: ReportQueriesService, useValue: mockQueries },
        { provide: ReportDataProviderRegistry, useValue: {} },
        { provide: ExportService, useValue: {} },
      ],
    }).compile();

    controller = module.get<ReportsController>(ReportsController);
    scheduler = module.get<SchedulerService>(SchedulerService);
  });

  describe('PHASE 20: Removal of Fake Data & Full Database Persistence', () => {
    it('persists and returns schedules strictly from the database', async () => {
      mockPrisma.reportSchedule.findMany.mockResolvedValue([
        {
          id: 'sch-db-101',
          reportId: 'rep-1',
          companyId: 'org-a',
          frequency: 'WEEKLY',
          cronExpression: '0 0 * * 1',
          timezone: 'UTC',
          active: true,
          nextRun: new Date('2026-10-01'),
          report: { name: 'DB Persisted Report' },
        },
      ]);

      const result = await controller.getAllSchedules(mockUserTenantA as any);

      expect(mockPrisma.reportSchedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: 'org-a' },
        }),
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('sch-db-101');
      expect(result[0].reportName).toBe('DB Persisted Report');
    });

    it('creates persistent schedule with companyId in database instead of returning fake SCH-', async () => {
      mockPrisma.report.findFirst.mockResolvedValue({
        id: 'rep-1',
        name: 'Weekly Settlement',
        companyId: 'org-a',
      });
      mockPrisma.reportSchedule.create.mockResolvedValue({
        id: 'sch-persisted-1',
        reportId: 'rep-1',
        companyId: 'org-a',
        frequency: 'WEEKLY',
        cronExpression: '0 0 * * 1',
        active: true,
        report: { name: 'Weekly Settlement' },
      });

      const result = await controller.createTopLevelSchedule(
        { reportName: 'Weekly Settlement', frequency: 'WEEKLY' },
        mockUserTenantA as any,
      );

      expect(mockPrisma.reportSchedule.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: 'org-a',
            frequency: 'WEEKLY',
          }),
        }),
      );
      expect(result.id).toBe('sch-persisted-1');
      expect(result.id).not.toMatch(/^SCH-\d+/);
    });

    it('persists and returns execution history from database filtered by tenant', async () => {
      mockPrisma.reportExecution.findMany.mockResolvedValue([
        {
          id: 'exec-1',
          reportId: 'rep-1',
          companyId: 'org-a',
          status: 'COMPLETED',
          startedAt: new Date('2026-09-26T10:00:00Z'),
          duration: 120,
          recordCount: 50,
          report: { name: 'Sales Report' },
        },
      ]);

      const result = await controller.getAllHistory(mockUserTenantA as any);

      expect(mockPrisma.reportExecution.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: 'org-a' },
        }),
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('exec-1');
      expect(result[0].status).toBe('SUCCESS');
    });
  });

  describe('PHASE 18 & 20: Cross-Tenant Schedule Isolation & Deletion', () => {
    it('blocks cross-tenant schedule deletion with HTTP 403 Forbidden', async () => {
      mockPrisma.reportSchedule.findUnique.mockResolvedValue({
        id: 'sch-tenant-b',
        companyId: 'org-b', // Belongs to Tenant B
      });

      // Tenant A attempts to delete Tenant B's schedule
      await expect(
        controller.deleteSchedule('sch-tenant-b', mockUserTenantA as any),
      ).rejects.toThrow(ForbiddenException);

      expect(mockCommands.handleDeleteSchedule).not.toHaveBeenCalled();
    });

    it('allows deleting schedule belonging to same tenant', async () => {
      mockPrisma.reportSchedule.findUnique.mockResolvedValue({
        id: 'sch-tenant-a',
        companyId: 'org-a',
      });

      await controller.deleteSchedule(
        'sch-tenant-a',
        mockUserTenantA as any,
      );

      expect(mockCommands.handleDeleteSchedule).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'sch-tenant-a' }),
      );
    });
  });

  describe('PHASE 19: Scheduled Report Tenant Context Security', () => {
    it('injects companyId tenant context into ExecuteReportCommand during scheduled execution', async () => {
      mockPrisma.reportSchedule.findMany.mockResolvedValue([
        {
          id: 'sch-1',
          reportId: 'rep-1',
          companyId: 'org-a',
          frequency: 'DAILY',
          report: { id: 'rep-1', name: 'Tenant Daily Report', isSystem: false, companyId: 'org-a' },
        },
      ]);

      await scheduler.runScheduledReports();

      expect(mockCommands.handleExecuteReport).toHaveBeenCalledWith(
        expect.objectContaining({
          reportId: 'rep-1',
          companyId: 'org-a',
        }),
        'csv',
      );
    });

    it('rejects execution of non-system report when tenant company context is missing', async () => {
      mockPrisma.reportSchedule.findMany.mockResolvedValue([
        {
          id: 'sch-orphan',
          reportId: 'rep-orphan',
          companyId: null, // Missing tenant context
          frequency: 'DAILY',
          report: { id: 'rep-orphan', name: 'Orphan Custom Report', isSystem: false, companyId: null },
        },
      ]);

      await scheduler.runScheduledReports();

      expect(mockCommands.handleExecuteReport).not.toHaveBeenCalled();
    });
  });
});
