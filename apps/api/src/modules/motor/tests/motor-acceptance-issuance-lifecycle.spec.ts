import { Test, TestingModule } from '@nestjs/testing';
import { MotorQuoteController } from '../controllers/motor-quote.controller';
import { MotorCalculationService } from '../services/motor-calculation.service';
import { MotorPolicyIssuanceService } from '../services/motor-policy-issuance.service';
import { PrismaService } from '../../../database/prisma.service';
import { RoleType } from '@prisma/client';
import { ConflictException, ForbiddenException } from '@nestjs/common';

describe('PR-07: Quote Revisions, Customer Acceptance & Policy Issuance Gates (D-01, T-11, T-12, T-13)', () => {
  let controller: MotorQuoteController;
  let calculationService: { calculate: jest.Mock };
  let issuanceService: { issuePolicy: jest.Mock };
  let prisma: any;

  beforeEach(async () => {
    calculationService = {
      calculate: jest.fn(),
    };
    issuanceService = {
      issuePolicy: jest.fn(),
    };
    prisma = {
      quotation: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      quotationVersion: {
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MotorQuoteController],
      providers: [
        { provide: MotorCalculationService, useValue: calculationService },
        { provide: MotorPolicyIssuanceService, useValue: issuanceService },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    controller = module.get<MotorQuoteController>(MotorQuoteController);
  });

  describe('T-11: Quote Revision & Prior Acceptance Invalidation', () => {
    it('invalidates prior customer acceptance and resets to DRAFT when price changes', async () => {
      const existingQuote = {
        id: 'quote-1',
        companyId: 'comp-1',
        status: 'ACCEPTED',
        version: 1,
        totalPremium: 10000,
        sumInsured: 500000,
        createdById: 'agent-1',
      };
      prisma.quotation.findUnique.mockResolvedValue(existingQuote);

      calculationService.calculate.mockResolvedValue({
        outputs: {
          totalPremium: 12500, // Price changed!
          baseOdPremium: 8000,
          baseTpPremium: 3416,
          totalGst: 2054.88,
          totalDiscount: 500,
        },
        calculationVersion: 'motor-v3-epic16',
      });

      prisma.quotation.update.mockResolvedValue({
        ...existingQuote,
        status: 'DRAFT',
        totalPremium: 12500,
        version: 2,
      });

      const user: any = { id: 'agent-1', role: RoleType.AGENT, companyId: 'comp-1' };
      const input: any = { vehicleCategory: 'PRIVATE_CAR', policyType: 'PACKAGE_COMPREHENSIVE' };

      const result = await controller.finalizeQuote('quote-1', input, user);

      // Verify that status was updated to DRAFT due to input/price change
      expect(prisma.quotation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'quote-1' },
          data: expect.objectContaining({
            status: 'DRAFT',
            totalPremium: 12500,
          }),
        })
      );

      // Verify quotation version increment
      expect(prisma.quotationVersion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          quotationId: 'quote-1',
          versionNumber: 2,
          totalPremium: 12500,
        }),
      });
    });
  });

  describe('T-12: Customer Acceptance Recording', () => {
    it('records customer acceptance and moves quotation to ACCEPTED state', async () => {
      const existingQuote = {
        id: 'quote-1',
        companyId: 'comp-1',
        status: 'DRAFT',
        totalPremium: 15000,
        createdById: 'agent-1',
      };
      prisma.quotation.findUnique.mockResolvedValue(existingQuote);
      prisma.quotation.update.mockResolvedValue({
        ...existingQuote,
        status: 'ACCEPTED',
        workflowState: 'PAYMENT_PENDING',
      });

      const user: any = { id: 'agent-1', email: 'agent@jest.com', role: RoleType.AGENT, companyId: 'comp-1' };
      const res = await controller.acceptQuotation(
        'quote-1',
        { acceptanceNotes: 'Customer approved quotation via email', acceptedVia: 'EMAIL' },
        user
      );

      expect(prisma.quotation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'quote-1' },
          data: expect.objectContaining({
            status: 'ACCEPTED',
            workflowState: 'PAYMENT_PENDING',
          }),
        })
      );
    });
  });

  describe('T-13: Policy Issuance Delegation', () => {
    it('delegates policy issuance to issuanceService', async () => {
      const mockPolicy = { id: 'pol-1', policyNumber: 'POL-2026-0001' };
      issuanceService.issuePolicy.mockResolvedValue(mockPolicy);

      const user: any = { id: 'admin-1', role: RoleType.ADMIN };
      const dto: any = { startDate: '2026-10-15', actualPolicyNumber: 'POL-2026-0001' };

      const res = await controller.issuePolicy('quote-1', dto, user);
      expect(issuanceService.issuePolicy).toHaveBeenCalledWith('quote-1', dto, user);
      expect(res).toBe(mockPolicy);
    });
  });
});
