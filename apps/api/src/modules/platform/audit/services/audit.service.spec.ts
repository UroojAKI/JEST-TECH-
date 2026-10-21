import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { PrismaService } from '../../../../database/prisma.service';
import { AuditAction } from '@prisma/client';
import { ForbiddenException } from '@nestjs/common';

describe('AuditService (G022 Transactional & G023 Immutable Audit Trails)', () => {
  let service: AuditService;
  let prisma: PrismaService;

  const mockPrisma = {
    auditLog: {
      create: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('logInTransaction (G022)', () => {
    it('executes audit creation inside the provided transaction client', async () => {
      const mockTx = {
        auditLog: {
          create: jest.fn().mockResolvedValue({ id: 'aud-1' }),
        },
      };

      await service.logInTransaction(mockTx as any, {
        userId: 'u-1',
        module: 'POLICIES',
        entity: 'Policy',
        entityId: 'pol-100',
        action: AuditAction.CREATE,
        newValue: { status: 'ACTIVE', policyNumber: 'POL-100' },
      });

      expect(mockTx.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'u-1',
            module: 'POLICIES',
            entity: 'Policy',
            entityId: 'pol-100',
            action: AuditAction.CREATE,
          }),
        }),
      );
    });
  });

  describe('assertImmutableOperation (G023)', () => {
    it('throws ForbiddenException when attempting update or delete operations on audit logs', () => {
      expect(() => service.assertImmutableOperation('update')).toThrow(
        ForbiddenException,
      );
      expect(() => service.assertImmutableOperation('updateMany')).toThrow(
        ForbiddenException,
      );
      expect(() => service.assertImmutableOperation('delete')).toThrow(
        ForbiddenException,
      );
      expect(() => service.assertImmutableOperation('deleteMany')).toThrow(
        ForbiddenException,
      );
      expect(() => service.assertImmutableOperation('upsert')).toThrow(
        ForbiddenException,
      );
    });

    it('allows append operations (create)', () => {
      expect(() => service.assertImmutableOperation('create')).not.toThrow();
    });
  });

  describe('getAuditLogs & exportAuditLogs Multi-Tenant Isolation (Phase 1 / DEF-024)', () => {
    const tenantA = { scope: 'TENANT' as const, companyId: 'tenant-a-uuid' };
    const tenantB = { scope: 'TENANT' as const, companyId: 'tenant-b-uuid' };
    const globalAccess = { scope: 'GLOBAL' as const, actorId: 'super-admin-uuid' };

    it('rejects direct service call with missing access context', async () => {
      await expect(service.getAuditLogs(undefined as any)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.exportAuditLogs(undefined as any)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rejects tenant scope with empty or blank companyId', async () => {
      await expect(
        service.getAuditLogs({ scope: 'TENANT', companyId: '' }),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.getAuditLogs({ scope: 'TENANT', companyId: '   ' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects global scope with empty actorId', async () => {
      await expect(
        service.getAuditLogs({ scope: 'GLOBAL', actorId: '' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('strictly constrains query to tenant A when called by Tenant A', async () => {
      mockPrisma.auditLog.count.mockResolvedValue(1);
      mockPrisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'aud-a1',
          action: AuditAction.CREATE,
          entity: 'Policy',
          entityId: 'pol-a1',
          createdAt: new Date(),
          user: { id: 'user-a', companyId: 'tenant-a-uuid' },
        },
      ]);

      const res = await service.getAuditLogs(tenantA, { entity: 'Policy' });

      expect(res.data).toHaveLength(1);
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            user: { companyId: 'tenant-a-uuid' },
            entity: 'Policy',
          }),
        }),
      );
    });

    it('strictly constrains search query to tenant A and does not allow OR to bypass companyId', async () => {
      mockPrisma.auditLog.count.mockResolvedValue(0);
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      await service.getAuditLogs(tenantA, { search: 'secret' });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            user: { companyId: 'tenant-a-uuid' },
            AND: [
              { user: { companyId: 'tenant-a-uuid' } },
              expect.objectContaining({ OR: expect.any(Array) }),
            ],
          }),
        }),
      );
    });

    it('returns only Tenant A records on CSV export for Tenant A', async () => {
      mockPrisma.auditLog.count.mockResolvedValue(1);
      mockPrisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'aud-a1',
          action: AuditAction.CREATE,
          entity: 'Policy',
          entityId: 'pol-a1',
          createdAt: new Date('2026-10-19T10:00:00Z'),
          user: { email: 'agent@tenant-a.com', companyId: 'tenant-a-uuid' },
        },
      ]);

      const csv = await service.exportAuditLogs(tenantA, { format: 'csv' });
      expect(csv).toContain('agent@tenant-a.com');
      expect(csv).not.toContain('tenant-b.com');
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            user: { companyId: 'tenant-a-uuid' },
          }),
          take: 1000,
        }),
      );
    });

    it('returns only Tenant A records on JSON export for Tenant A', async () => {
      mockPrisma.auditLog.count.mockResolvedValue(1);
      mockPrisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'aud-a1',
          action: AuditAction.CREATE,
          entity: 'Policy',
          entityId: 'pol-a1',
          createdAt: new Date(),
          user: { email: 'agent@tenant-a.com', companyId: 'tenant-a-uuid' },
        },
      ]);

      const json = await service.exportAuditLogs(tenantA, { format: 'json' });
      expect(Array.isArray(json)).toBe(true);
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            user: { companyId: 'tenant-a-uuid' },
          }),
        }),
      );
    });

    it('does not expose Tenant B data when Tenant A filters by Tenant B entity ID', async () => {
      mockPrisma.auditLog.count.mockResolvedValue(0);
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      const res = await service.getAuditLogs(tenantA, { entity: 'Policy', search: 'tenant-b-policy-id' });
      expect(res.data).toHaveLength(0);
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            user: { companyId: 'tenant-a-uuid' },
          }),
        }),
      );
    });

    it('allows global access only when explicit GLOBAL access scope is provided', async () => {
      mockPrisma.auditLog.count.mockResolvedValue(2);
      mockPrisma.auditLog.findMany.mockResolvedValue([
        { id: 'aud-a1', user: { companyId: 'tenant-a-uuid' } },
        { id: 'aud-b1', user: { companyId: 'tenant-b-uuid' } },
      ]);

      const res = await service.getAuditLogs(globalAccess);
      expect(res.data).toHaveLength(2);
      // In GLOBAL scope, user companyId filter is NOT attached
      const lastCall = mockPrisma.auditLog.findMany.mock.calls[mockPrisma.auditLog.findMany.mock.calls.length - 1][0];
      expect(lastCall.where.user).toBeUndefined();
    });

    it('handles negative or invalid pagination safely without bypassing tenant filter', async () => {
      mockPrisma.auditLog.count.mockResolvedValue(0);
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      const res = await service.getAuditLogs(tenantA, { page: -5, limit: -100 });
      expect(res.meta.page).toBe(1);
      expect(res.meta.limit).toBe(1);
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            user: { companyId: 'tenant-a-uuid' },
          }),
          skip: 0,
          take: 1,
        }),
      );
    });
  });
});
