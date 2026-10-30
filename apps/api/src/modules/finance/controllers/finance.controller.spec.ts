import { Test, TestingModule } from '@nestjs/testing';
import { FinanceController } from './finance.controller';
import { LedgerService } from '../accounting/services/ledger/ledger.service';
import { CommissionEngineService } from '../commission/services/commission-engine/commission-engine.service';
import { PaymentService } from '../revenue/services/payment/payment.service';
import { FinanceReconciliationService } from '../services/finance-reconciliation.service';
import { SettlementService } from '../services/settlement.service';
import { PrismaService } from '../../../database/prisma.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RoleType } from '@prisma/client';

describe('FinanceController', () => {
  let controller: FinanceController;
  let prisma: PrismaService;
  let settlementService: SettlementService;

  const mockUser = {
    id: 'user-1',
    companyId: 'comp-1',
    roles: [RoleType.ADMIN],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FinanceController],
      providers: [
        {
          provide: LedgerService,
          useValue: {
            getLedgerEntries: jest.fn(),
            postEntry: jest.fn(),
          },
        },
        {
          provide: CommissionEngineService,
          useValue: {},
        },
        {
          provide: PaymentService,
          useValue: {
            processPayment: jest.fn(),
          },
        },
        {
          provide: FinanceReconciliationService,
          useValue: {},
        },
        {
          provide: SettlementService,
          useValue: {
            createBatch: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            chartOfAccount: {
              findMany: jest.fn(),
            },
            commission: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
            },
            motorPaymentRecord: {
              findMany: jest.fn(),
            },
            settlement: {
              findMany: jest.fn(),
            },
            claim: {
              findMany: jest.fn(),
            },
            policy: {
              findMany: jest.fn(),
            },
            customer: {
              findMany: jest.fn(),
            },
            salesTarget: {
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    controller = module.get<FinanceController>(FinanceController);
    prisma = module.get<PrismaService>(PrismaService);
    settlementService = module.get<SettlementService>(SettlementService);
  });

  describe('getChartOfAccounts', () => {
    it('returns active chart of accounts', async () => {
      jest.spyOn(prisma.chartOfAccount, 'findMany').mockResolvedValue([
        { id: 'acc-1', code: '1010', name: 'Cash at Bank', type: 'ASSET' },
        { id: 'acc-2', code: '2010', name: 'Premium Clearing', type: 'LIABILITY' },
      ] as any);

      const accounts = await controller.getChartOfAccounts();
      expect(accounts).toHaveLength(2);
      expect(prisma.chartOfAccount.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        select: { id: true, code: true, name: true, type: true },
        orderBy: [{ type: 'asc' }, { code: 'asc' }],
      });
    });
  });

  describe('approveCommission', () => {
    it('updates commission status to APPROVED (not REALIZED)', async () => {
      jest.spyOn(prisma.commission, 'findUnique').mockResolvedValue({
        id: 'comm-1',
        user: { companyId: 'comp-1' },
      } as any);

      jest.spyOn(prisma.commission, 'update').mockResolvedValue({
        id: 'comm-1',
        status: 'APPROVED',
      } as any);

      const result = await controller.approveCommission('comm-1', mockUser as any);
      expect(result.status).toBe('APPROVED');
      expect(prisma.commission.update).toHaveBeenCalledWith({
        where: { id: 'comm-1' },
        data: { status: 'APPROVED' },
      });
    });

    it('rejects cross-tenant commission approval', async () => {
      jest.spyOn(prisma.commission, 'findUnique').mockResolvedValue({
        id: 'comm-1',
        user: { companyId: 'other-comp' },
      } as any);

      await expect(
        controller.approveCommission('comm-1', mockUser as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getPayments', () => {
    it('returns MOTOR_PREMIUM payment type and respects query filter', async () => {
      jest.spyOn(prisma.motorPaymentRecord, 'findMany').mockResolvedValue([
        {
          id: 'rec-1',
          referenceNumber: 'PAY-1234',
          amount: '5000',
          paymentMethod: 'UPI',
          status: 'PAID',
          createdAt: new Date('2026-10-13T10:00:00Z'),
          quotation: { insurerName: 'Tata AIG' },
        },
      ] as any);

      const payments = await controller.getPayments(mockUser as any, 'UPI');
      expect(payments).toHaveLength(1);
      expect(payments[0].type).toBe('MOTOR_PREMIUM');
      expect(payments[0].status).toBe('COMPLETED');
      expect(prisma.motorPaymentRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { quotation: { companyId: 'comp-1' }, paymentMethod: 'UPI' },
        }),
      );
    });
  });

  describe('createSettlementBatch', () => {
    it('delegates to settlementService with companyId and actorId', async () => {
      const dto = {
        insurerName: 'HDFC ERGO',
        period: '2026-10',
      };

      jest.spyOn(settlementService, 'createBatch').mockResolvedValue({
        id: 'stl-1',
        batchNumber: 'STL-00000001',
        insurerName: 'HDFC ERGO',
        period: '2026-10',
        status: 'PENDING',
        grossPremiumCollected: 50000,
        commissionRetained: 7500,
        netPayable: 42500,
        policyCount: 5,
        createdAt: '2026-10-13T10:00:00Z',
      });

      const res = await controller.createSettlementBatch(dto, mockUser as any);
      expect(res.batchNumber).toBe('STL-00000001');
      expect(res.netPayable).toBe(42500);
      expect(settlementService.createBatch).toHaveBeenCalledWith(
        dto,
        'comp-1',
        'user-1',
      );
    });

    it('rejects settlement creation without companyId', async () => {
      await expect(
        controller.createSettlementBatch(
          { insurerName: 'HDFC ERGO', period: '2026-10' },
          { id: 'user-1' } as any,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getMyCommissions', () => {
    it('scopes query strictly to authenticated employee and company', async () => {
      const actor = {
        userId: 'agent-42',
        id: 'agent-42',
        companyId: 'comp-1',
        roles: [RoleType.AGENT],
      };

      jest.spyOn(prisma.commission, 'findMany').mockResolvedValue([
        {
          id: 'comm-10',
          policyId: 'pol-10',
          amount: '1500',
          roleTier: 'AGENT',
          status: 'ACCRUED',
          createdAt: new Date('2026-10-25T10:00:00Z'),
          user: { firstName: 'Agent', lastName: 'FortyTwo' },
        },
      ] as any);

      jest.spyOn(prisma.policy, 'findMany').mockResolvedValue([
        {
          id: 'pol-10',
          policyNumber: 'POL-202610-0010',
          premiumAmount: '15000',
          contact: { firstName: 'Customer', lastName: 'One' },
        },
      ] as any);

      const result = await controller.getMyCommissions(actor as any);

      expect(prisma.commission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'agent-42',
            OR: [{ companyId: 'comp-1' }, { user: { companyId: 'comp-1' } }],
          }),
        }),
      );
      expect(result).toHaveLength(1);
      expect(result[0].amount).toBe(1500);
      expect(result[0].commissionAmount).toBe(1500);
      expect(result[0].policyNumber).toBe('POL-202610-0010');
      expect(result[0].customerName).toBe('Customer One');
    });

    it('rejects employee commission request when company context is missing', async () => {
      await expect(
        controller.getMyCommissions({ userId: 'agent-1' } as any),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getCommissions (Admin)', () => {
    it('returns both amount and commissionAmount in canonical shape', async () => {
      jest.spyOn(prisma.commission, 'findMany').mockResolvedValue([
        {
          id: 'comm-1',
          policyId: 'pol-1',
          amount: '2000',
          roleTier: 'AGENT',
          status: 'APPROVED',
          createdAt: new Date('2026-10-20T10:00:00Z'),
          user: { firstName: 'Agent', lastName: 'Smith' },
        },
      ] as any);

      jest.spyOn(prisma.policy, 'findMany').mockResolvedValue([
        {
          id: 'pol-1',
          policyNumber: 'POL-1001',
          premiumAmount: '20000',
          contact: { firstName: 'John', lastName: 'Doe' },
        },
      ] as any);

      const result = await controller.getCommissions(mockUser as any);
      expect(result).toHaveLength(1);
      expect(result[0].amount).toBe(2000);
      expect(result[0].commissionAmount).toBe(2000);
      expect(result[0].payoutStatus).toBe('APPROVED');
    });
  });

  describe('getIncentives', () => {
    it('returns targets with null incentiveAmount and POLICY_PENDING status without inventing formulas', async () => {
      jest.spyOn(prisma.salesTarget, 'findMany').mockResolvedValue([
        {
          id: 'tgt-1',
          targetGwp: '500000',
          achievedGwp: '300000',
          user: { firstName: 'Sales', lastName: 'Rep' },
        },
      ] as any);

      const result = await controller.getIncentives(mockUser as any);
      expect(result).toHaveLength(1);
      expect(result[0].targetAmount).toBe(500000);
      expect(result[0].achievedAmount).toBe(300000);
      expect(result[0].incentiveAmount).toBeNull();
      expect(result[0].status).toBe('POLICY_PENDING');
      expect(result[0].policyStatus).toBe('PENDING_APPROVAL');
    });
  });
});
