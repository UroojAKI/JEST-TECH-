import { Test, TestingModule } from '@nestjs/testing';
import { CommissionEngineService } from './commission-engine.service';
import { PrismaService } from '../../../../../database/prisma.service';
import { ForbiddenException, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { RoleType, AuditAction } from '@prisma/client';

describe('CommissionEngineService', () => {
  let service: CommissionEngineService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const mockTx: any = {
      $executeRaw: jest.fn().mockResolvedValue(undefined),
      commission: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([
            { roleTier: 'AGENT', amount: '5000' },
            { roleTier: 'BRANCH_MANAGER', amount: '1000' },
            { roleTier: 'ZONAL_MANAGER', amount: '250' },
          ]),
        createMany: jest.fn().mockResolvedValue({ count: 3 }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommissionEngineService,
        {
          provide: PrismaService,
          useValue: {
            commissionPlan: {
              findUnique: jest.fn(),
            },
            user: {
              findUnique: jest
                .fn()
                .mockResolvedValue({ id: 'u-1', status: 'ACTIVE' }),
            },
            commission: {
              createMany: jest.fn(),
              updateMany: jest.fn(),
            },
            $transaction: jest
              .fn()
              .mockImplementation(async (cb) => cb(mockTx)),
          },
        },
      ],
    }).compile();

    service = module.get<CommissionEngineService>(CommissionEngineService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('accrueCommissions', () => {
    it('should calculate agent commission and manager overrides correctly', async () => {
      jest.spyOn(prisma.commissionPlan, 'findUnique').mockResolvedValue({
        id: 'plan-1',
        isActive: true,
        rules: JSON.stringify({
          agentPercent: 10,
          overrides: [
            { roleTier: 'BRANCH_MANAGER', percent: 2, userId: 'bm-1' },
            { roleTier: 'ZONAL_MANAGER', percent: 0.5, userId: 'zm-1' },
          ],
        }),
      } as any);

      const result = await service.accrueCommissions(
        'pol-1',
        'agent-1',
        '50000',
        'plan-1',
      );

      // We know there are 3 items: agent (10%), bm (2%), zm (0.5%) of 50,000
      // Agent = 5000, BM = 1000, ZM = 250
      expect(result.length).toBe(3);

      expect(result[0].roleTier).toBe('AGENT');
      expect(Number(result[0].amount)).toBe(5000);

      expect(result[1].roleTier).toBe('BRANCH_MANAGER');
      expect(Number(result[1].amount)).toBe(1000);

      expect(result[2].roleTier).toBe('ZONAL_MANAGER');
      expect(Number(result[2].amount)).toBe(250);
    });

    it('T-05: throws structured COMMISSION_CONFIG_PENDING when no active commission plan matches', async () => {
      jest.spyOn(prisma.commissionPlan, 'findUnique').mockResolvedValue(null);

      let thrown: any = null;
      try {
        await service.accrueCommissions('pol-1', 'agent-1', '50000', 'missing-plan-id');
      } catch (err) {
        thrown = err;
      }

      expect(thrown).toBeDefined();
      expect(thrown.getResponse()).toMatchObject({
        errorCode: 'COMMISSION_CONFIG_PENDING',
        missingEntity: 'COMMISSION_CONFIG',
        planId: 'missing-plan-id',
      });
    });
  });

  describe('realizeCommissions', () => {
    it('should update status from APPROVED to REALIZED', async () => {
      jest
        .spyOn(prisma.commission, 'updateMany')
        .mockResolvedValue({ count: 2 });

      const count = await service.realizeCommissions('pol-1');

      expect(count).toBe(2);
      expect(prisma.commission.updateMany).toHaveBeenCalledWith({
        where: { policyId: 'pol-1', status: 'APPROVED' },
        data: { status: 'REALIZED' },
      });
    });
  });

  describe('approveCommission (6.5)', () => {
    const actor = { id: 'admin-1', companyId: 'comp-1', roles: [RoleType.ADMIN] };

    it('rejects approval when company context is missing', async () => {
      await expect(
        service.approveCommission('comm-1', { id: 'admin-1' } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects approval when commission record does not exist', async () => {
      const mockTx: any = {
        commission: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
      };
      jest.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(mockTx));

      await expect(
        service.approveCommission('missing-id', actor as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects approval when commission belongs to another company', async () => {
      const mockTx: any = {
        commission: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'comm-1',
            companyId: 'comp-2',
            status: 'ACCRUED',
          }),
        },
      };
      jest.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(mockTx));

      await expect(
        service.approveCommission('comm-1', actor as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects approval when commission is already approved or paid', async () => {
      const mockTxApproved: any = {
        commission: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'comm-1',
            companyId: 'comp-1',
            status: 'APPROVED',
          }),
        },
      };
      jest.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(mockTxApproved));

      await expect(
        service.approveCommission('comm-1', actor as any),
      ).rejects.toThrow(ConflictException);

      const mockTxPaid: any = {
        commission: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'comm-1',
            companyId: 'comp-1',
            status: 'PAID',
          }),
        },
      };
      jest.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(mockTxPaid));

      await expect(
        service.approveCommission('comm-1', actor as any),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects approval for cancelled commissions', async () => {
      const mockTxCancelled: any = {
        commission: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'comm-1',
            companyId: 'comp-1',
            status: 'CANCELLED',
          }),
        },
      };
      jest.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(mockTxCancelled));

      await expect(
        service.approveCommission('comm-1', actor as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('atomically updates commission to APPROVED and logs audit event in same transaction', async () => {
      const mockTx: any = {
        commission: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'comm-1',
            companyId: 'comp-1',
            userId: 'agent-1',
            policyId: 'pol-1',
            amount: '2500',
            roleTier: 'AGENT',
            status: 'ACCRUED',
          }),
          update: jest.fn().mockResolvedValue({
            id: 'comm-1',
            status: 'APPROVED',
            companyId: 'comp-1',
          }),
        },
        auditLog: {
          create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
        },
      };
      jest.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(mockTx));

      const updated = await service.approveCommission('comm-1', actor as any);

      expect(updated.status).toBe('APPROVED');
      expect(mockTx.commission.update).toHaveBeenCalledWith({
        where: { id: 'comm-1' },
        data: { status: 'APPROVED', companyId: 'comp-1' },
      });
      expect(mockTx.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: AuditAction.APPROVE,
          entity: 'Commission',
          entityId: 'comm-1',
          module: 'FINANCE',
          userId: 'admin-1',
          newValue: { status: 'APPROVED' },
        }),
      });
    });
  });

  describe('bulkApproveCommissions (6.6)', () => {
    const actor = { id: 'admin-1', companyId: 'comp-1', roles: [RoleType.ADMIN] };

    it('returns exact itemized per-record outcome without swallowing errors', async () => {
      jest.spyOn(service, 'approveCommission')
        .mockResolvedValueOnce({ id: 'c1', status: 'APPROVED' } as any)
        .mockRejectedValueOnce(new ConflictException('Commission is already approved'))
        .mockRejectedValueOnce(new NotFoundException('Commission record not found'));

      const result = await service.bulkApproveCommissions(['c1', 'c2', 'c3'], actor as any);

      expect(result.totalSelected).toBe(3);
      expect(result.successfulCount).toBe(1);
      expect(result.alreadyProcessedCount).toBe(1);
      expect(result.failedCount).toBe(1);
      expect(result.results).toHaveLength(3);
      expect(result.results[0].status).toBe('SUCCESS');
      expect(result.results[1].status).toBe('ALREADY_PROCESSED');
      expect(result.results[2].status).toBe('NOT_FOUND');
    });
  });

});
