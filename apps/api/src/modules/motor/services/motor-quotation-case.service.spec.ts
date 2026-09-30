import { Test, TestingModule } from '@nestjs/testing';
import { MotorQuotationCaseService } from './motor-quotation-case.service';
import { PrismaService } from '../../../database/prisma.service';
import { TenantResourceAuthorizationService } from '../../auth/services/tenant-resource-authorization.service';
import { NumberingEngineService } from '../../administration/services/numbering-engine/numbering-engine.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { VehicleCategory, VehicleStatus } from '@prisma/client';

describe('MotorQuotationCaseService', () => {
  let service: MotorQuotationCaseService;

  const mockPrisma = {
    motorQuotationCase: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    quotation: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrisma)),
  };

  const mockTenantAuth = {
    assertTenantResource: jest.fn(),
  };

  const mockNumberingEngine = {
    generateNext: jest.fn().mockResolvedValue('MQC-2026-00001'),
  };

  const mockUser = {
    id: 'user-1',
    companyId: 'comp-1',
    role: 'AGENT',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MotorQuotationCaseService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: TenantResourceAuthorizationService, useValue: mockTenantAuth },
        { provide: NumberingEngineService, useValue: mockNumberingEngine },
      ],
    }).compile();

    service = module.get<MotorQuotationCaseService>(MotorQuotationCaseService);
  });

  describe('createCase', () => {
    it('creates a new MotorQuotationCase with baseline snapshots and caseCode', async () => {
      const dto = {
        category: VehicleCategory.PRIVATE_CAR,
        vehicleStatus: VehicleStatus.EXISTING,
        registrationNumber: 'MH02CB1234',
        contactId: 'con-1',
        leadId: 'lead-1',
        vehicleId: 'veh-1',
        customerSnapshot: { name: 'Customer Test', phone: '9999999999' },
        vehicleSnapshot: { make: 'Hyundai', model: 'Creta' },
      };

      const expectedCase = {
        id: 'case-1',
        caseCode: 'MQC-2026-00001',
        ...dto,
        companyId: 'comp-1',
      };

      mockPrisma.motorQuotationCase.create.mockResolvedValue(expectedCase);

      const result = await service.createCase(dto, mockUser as any);

      expect(mockTenantAuth.assertTenantResource).toHaveBeenCalledWith('Contact', 'con-1', mockUser);
      expect(mockTenantAuth.assertTenantResource).toHaveBeenCalledWith('Lead', 'lead-1', mockUser);
      expect(mockTenantAuth.assertTenantResource).toHaveBeenCalledWith('Vehicle', 'veh-1', mockUser);
      expect(mockNumberingEngine.generateNext).toHaveBeenCalledWith('MOTOR_CASE');
      expect(result).toEqual(expectedCase);
    });
  });

  describe('getCase', () => {
    it('returns the case when found and tenant matches', async () => {
      const mockCase = {
        id: 'case-1',
        companyId: 'comp-1',
        caseCode: 'MQC-2026-00001',
        quotations: [],
      };

      mockPrisma.motorQuotationCase.findFirst.mockResolvedValue(mockCase);

      const result = await service.getCase('case-1', mockUser as any);

      expect(mockPrisma.motorQuotationCase.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'case-1', companyId: 'comp-1' },
        }),
      );
      expect(result).toEqual(mockCase);
    });

    it('throws NotFoundException when case does not exist or tenant mismatch', async () => {
      mockPrisma.motorQuotationCase.findFirst.mockResolvedValue(null);

      await expect(service.getCase('case-unknown', mockUser as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('selectQuotation', () => {
    it('binds selectedQuoteId and marks quote as ACCEPTED', async () => {
      const mockCase = { id: 'case-1', companyId: 'comp-1', status: 'QUOTED' };
      const mockQuote = { id: 'quote-1', caseId: 'case-1', companyId: 'comp-1' };

      mockPrisma.motorQuotationCase.findFirst.mockResolvedValue(mockCase);
      mockPrisma.quotation.findFirst.mockResolvedValue(mockQuote);
      mockPrisma.motorQuotationCase.update.mockResolvedValue({ ...mockCase, selectedQuoteId: 'quote-1', status: 'SELECTED' });

      const result = await service.selectQuotation('case-1', 'quote-1', mockUser as any);

      expect(mockPrisma.motorQuotationCase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'case-1' },
          data: { selectedQuoteId: 'quote-1', status: 'SELECTED' },
        }),
      );
      expect(mockPrisma.quotation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'quote-1' },
          data: expect.objectContaining({
            workflowState: 'READY_FOR_PROPOSAL',
          }),
        }),
      );
      expect(result.status).toBe('SELECTED');
    });

    it('throws BadRequestException if quotation does not belong to case', async () => {
      mockPrisma.motorQuotationCase.findFirst.mockResolvedValue({ id: 'case-1', companyId: 'comp-1' });
      mockPrisma.quotation.findFirst.mockResolvedValue(null);

      await expect(service.selectQuotation('case-1', 'quote-foreign', mockUser as any)).rejects.toThrow(BadRequestException);
    });
  });

  describe('compareCaseQuotations', () => {
    it('returns structured side-by-side comparison matrix', async () => {
      const mockCaseWithQuotes = {
        id: 'case-1',
        caseCode: 'MQC-2026-00001',
        companyId: 'comp-1',
        category: 'PRIVATE_CAR',
        registrationNumber: 'MH02CB1234',
        selectedQuoteId: 'quote-1',
        status: 'SELECTED',
        quotations: [
          {
            id: 'quote-1',
            quotationCode: 'QT-001',
            insurerName: 'HDFC ERGO',
            policyType: 'PACKAGE',
            sumInsured: 500000,
            ncbPercentage: 20,
            gstAmount: 1800,
            totalPremium: 11800,
            workflowState: 'READY_FOR_PROPOSAL',
            status: 'ACCEPTED',
            calculationSnapshot: {
              outputs: {
                baseOdPremium: 5000,
                netOdPremium: 4000,
                baseTpPremium: 3416,
                netTpPremium: 3416,
                totalGst: 1800,
                totalPremium: 11800,
                inspectionRequired: false,
              },
            },
            createdAt: new Date(),
          },
          {
            id: 'quote-2',
            quotationCode: 'QT-002',
            insurerName: 'ICICI Lombard',
            policyType: 'PACKAGE',
            sumInsured: 500000,
            ncbPercentage: 20,
            gstAmount: 1750,
            totalPremium: 11500,
            workflowState: 'READY_FOR_PROPOSAL',
            status: 'DRAFT',
            calculationSnapshot: {
              outputs: {
                baseOdPremium: 4800,
                netOdPremium: 3800,
                baseTpPremium: 3416,
                netTpPremium: 3416,
                totalGst: 1750,
                totalPremium: 11500,
                inspectionRequired: false,
              },
            },
            createdAt: new Date(),
          },
        ],
      };

      mockPrisma.motorQuotationCase.findFirst.mockResolvedValue(mockCaseWithQuotes);

      const comparison = await service.compareCaseQuotations('case-1', mockUser as any);

      expect(comparison.totalQuotes).toBe(2);
      expect(comparison.quotes[0].insurerName).toBe('HDFC ERGO');
      expect(comparison.quotes[0].isSelected).toBe(true);
      expect(comparison.quotes[1].insurerName).toBe('ICICI Lombard');
      expect(comparison.quotes[1].isSelected).toBe(false);
    });
  });

  describe('Lifecycle State Machine (MOTOR-0010)', () => {
    it('allows valid transitions: OPEN -> QUOTED -> SELECTED -> COMPLETED', () => {
      expect(() => service.validateCaseTransition(VehicleStatus.EXISTING as any, VehicleStatus.EXISTING as any)).not.toThrow();
      expect(() => service.validateCaseTransition('OPEN' as any, 'QUOTED' as any)).not.toThrow();
      expect(() => service.validateCaseTransition('QUOTED' as any, 'SELECTED' as any)).not.toThrow();
      expect(() => service.validateCaseTransition('SELECTED' as any, 'COMPLETED' as any)).not.toThrow();
    });

    it('allows cancellation from OPEN or QUOTED', () => {
      expect(() => service.validateCaseTransition('OPEN' as any, 'CANCELLED' as any)).not.toThrow();
      expect(() => service.validateCaseTransition('QUOTED' as any, 'CANCELLED' as any)).not.toThrow();
    });

    it('rejects invalid or backwards transitions', () => {
      expect(() => service.validateCaseTransition('COMPLETED' as any, 'OPEN' as any)).toThrow(BadRequestException);
      expect(() => service.validateCaseTransition('CANCELLED' as any, 'SELECTED' as any)).toThrow(BadRequestException);
      expect(() => service.validateCaseTransition('OPEN' as any, 'COMPLETED' as any)).toThrow(BadRequestException);
      expect(() => service.validateCaseTransition('SELECTED' as any, 'CANCELLED' as any)).toThrow(BadRequestException);
    });

    it('transitions case status via transitionCaseStatus', async () => {
      const mockCase = { id: 'case-1', companyId: 'comp-1', status: 'OPEN' };
      mockPrisma.motorQuotationCase.findFirst.mockResolvedValue(mockCase);
      mockPrisma.motorQuotationCase.update.mockResolvedValue({ ...mockCase, status: 'QUOTED' });

      const res = await service.transitionCaseStatus('case-1', 'QUOTED' as any, mockUser as any);
      expect(mockPrisma.motorQuotationCase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'case-1' },
          data: { status: 'QUOTED' },
        }),
      );
      expect(res.status).toBe('QUOTED');
    });

    it('cancels case via cancelCase', async () => {
      const mockCase = { id: 'case-1', companyId: 'comp-1', status: 'QUOTED' };
      mockPrisma.motorQuotationCase.findFirst.mockResolvedValue(mockCase);
      mockPrisma.motorQuotationCase.update.mockResolvedValue({ ...mockCase, status: 'CANCELLED' });

      const res = await service.cancelCase('case-1', 'Customer dropped out', mockUser as any);
      expect(mockPrisma.motorQuotationCase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'case-1' },
          data: { status: 'CANCELLED' },
        }),
      );
      expect(res.status).toBe('CANCELLED');
    });
  });
});