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
      expect(() => service.assertImmutableOperation('update')).toThrow(ForbiddenException);
      expect(() => service.assertImmutableOperation('updateMany')).toThrow(ForbiddenException);
      expect(() => service.assertImmutableOperation('delete')).toThrow(ForbiddenException);
      expect(() => service.assertImmutableOperation('deleteMany')).toThrow(ForbiddenException);
      expect(() => service.assertImmutableOperation('upsert')).toThrow(ForbiddenException);
    });

    it('allows append operations (create)', () => {
      expect(() => service.assertImmutableOperation('create')).not.toThrow();
    });
  });

  describe('getAuditLogs', () => {
    it('retrieves paginated audit trail logs', async () => {
      mockPrisma.auditLog.count.mockResolvedValue(1);
      mockPrisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'aud-1',
          action: AuditAction.UPDATE,
          entity: 'Policy',
          entityId: 'pol-1',
          createdAt: new Date(),
          user: { id: 'u-1', firstName: 'Admin', email: 'admin@jest.com' },
        },
      ]);

      const result = await service.getAuditLogs({ entity: 'Policy' });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ entity: 'Policy' }),
        }),
      );
    });
  });
});
