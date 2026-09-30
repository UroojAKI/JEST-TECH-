import { Test, TestingModule } from '@nestjs/testing';
import { QuotationCompletionService } from './quotation-completion.service';
import { PrismaService } from '../../../../database/prisma.service';
import { MotorWorkflowState, QuotationStatus } from '@prisma/client';

describe('QuotationCompletionService', () => {
  let service: QuotationCompletionService;
  let prisma: PrismaService;

  const mockPrisma = {
    quotation: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    contact: {
      update: jest.fn(),
    },
    vehicle: {
      update: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    },
    motorPreviousPolicy: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuotationCompletionService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<QuotationCompletionService>(QuotationCompletionService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('evaluateQuotationCompletion', () => {
    const baseQuotation = {
      id: 'quote-1',
      quotationCode: 'Q-2026-001',
      title: 'Motor Insurance',
      policyType: 'PACKAGE',
      sumInsured: 500000,
      totalPremium: 15000,
      status: QuotationStatus.DRAFT,
      workflowState: MotorWorkflowState.READY_FOR_PROPOSAL,
      registrationNumber: 'MH02CB1234',
      contact: {
        firstName: 'Rahul',
        lastName: 'Sharma',
        phone: '9876543210',
        email: 'rahul@example.com',
        dateOfBirth: new Date('1990-01-01'),
        panNumber: 'ABCDE1234F',
      },
      vehicle: {
        make: 'Hyundai',
        model: 'Creta',
        status: 'EXISTING',
        registrationNumber: 'MH02CB1234',
        engineNumber: 'ENG123456',
        chassisNumber: 'CHS12345678901234',
        dateOfRegistration: new Date('2021-05-10'),
      },
      motorPreviousPolicy: {
        previousPolicyNumber: 'POL-9999',
        previousInsurerName: 'HDFC ERGO',
        previousPolicyExpiryDate: new Date('2026-08-01'),
      },
      motorInspection: null,
      motorPaymentRecord: { status: 'PAID' },
      documents: [],
    };

    it('evaluates vehicle technical details with correct dateOfRegistration field', () => {
      const result = service.evaluateQuotationCompletion(baseQuotation);
      const vehicleSection = result.sections.find((s) => s.section === 'vehicle');

      expect(vehicleSection).toBeDefined();
      expect(vehicleSection!.complete).toBe(true);
      expect(vehicleSection!.completedCount).toBe(5);
      expect(vehicleSection!.missing).toHaveLength(0);
    });

    it('flags makeModel as missing when vehicle make/model are empty, rejecting title fallback', () => {
      const quoteNoMake = {
        ...baseQuotation,
        title: 'Custom Motor Title For Customer',
        vehicle: {
          ...baseQuotation.vehicle,
          make: null,
          model: null,
        },
      };

      const result = service.evaluateQuotationCompletion(quoteNoMake);
      const vehicleSection = result.sections.find((s) => s.section === 'vehicle');

      expect(vehicleSection!.complete).toBe(false);
      expect(vehicleSection!.missing.some((m) => m.field === 'makeModel')).toBe(true);
    });

    it('suppresses previous insurance section when vehicle status is NEW', () => {
      const newVehicleQuote = {
        ...baseQuotation,
        vehicle: {
          ...baseQuotation.vehicle,
          status: 'NEW',
          registrationNumber: 'NEW',
        },
        motorMetadata: {
          vehicleDetails: { vehicleStatus: 'NEW' },
        },
        motorPreviousPolicy: null,
      };

      const result = service.evaluateQuotationCompletion(newVehicleQuote);
      const prevSection = result.sections.find((s) => s.section === 'previousInsurance');

      expect(prevSection).toBeUndefined();
    });

    it('suppresses previous insurance section when previousPolicyType is NOT_AVAILABLE', () => {
      const notAvailableQuote = {
        ...baseQuotation,
        motorMetadata: {
          vehicleDetails: { vehicleStatus: 'EXISTING' },
          previousPolicyDetails: { previousPolicyType: 'NOT_AVAILABLE' },
        },
        motorPreviousPolicy: null,
      };

      const result = service.evaluateQuotationCompletion(notAvailableQuote);
      const prevSection = result.sections.find((s) => s.section === 'previousInsurance');

      expect(prevSection).toBeUndefined();
    });

    it('includes and verifies previous insurance section for existing vehicle with available policy', () => {
      const result = service.evaluateQuotationCompletion(baseQuotation);
      const prevSection = result.sections.find((s) => s.section === 'previousInsurance');

      expect(prevSection).toBeDefined();
      expect(prevSection!.complete).toBe(true);
      expect(prevSection!.applicableCount).toBe(3);
      expect(prevSection!.completedCount).toBe(3);
    });
  });

  describe('updateDetails', () => {
    it('symmetrically deletes motorPreviousPolicy and clears metadata when updating to NOT_AVAILABLE', async () => {
      const quotation = {
        id: 'quote-1',
        quotationCode: 'Q-2026-001',
        companyId: 'comp-1',
        contactId: 'con-1',
        vehicleId: 'veh-1',
        title: 'Motor Quote',
        policyType: 'PACKAGE',
        sumInsured: 500000,
        totalPremium: 12000,
        status: QuotationStatus.DRAFT,
        workflowState: MotorWorkflowState.READY_FOR_PROPOSAL,
        motorMetadata: {
          previousPolicyDetails: { previousPolicyNumber: 'OLD-123' },
        },
        contact: { firstName: 'Test', lastName: 'User', phone: '9999999999' },
        vehicle: { make: 'Maruti', model: 'Swift', registrationNumber: 'MH01AB1234', dateOfRegistration: new Date() },
        motorPreviousPolicy: { previousPolicyNumber: 'OLD-123' },
        motorInspection: null,
        motorPaymentRecord: { status: 'PAID' },
        documents: [],
      };

      mockPrisma.quotation.findUnique.mockResolvedValue(quotation);
      mockPrisma.quotation.findFirst.mockResolvedValue({
        ...quotation,
        motorPreviousPolicy: null,
        motorMetadata: {
          previousPolicyDetails: { previousPolicyType: 'NOT_AVAILABLE' },
        },
      });
      mockPrisma.motorPreviousPolicy.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.quotation.update.mockResolvedValue({});

      const result = await service.updateDetails('quote-1', {
        previousPolicyType: 'NOT_AVAILABLE',
      });

      expect(mockPrisma.motorPreviousPolicy.deleteMany).toHaveBeenCalledWith({
        where: { quotationId: 'quote-1' },
      });
      expect(mockPrisma.quotation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'quote-1' },
          data: expect.objectContaining({
            motorMetadata: expect.objectContaining({
              previousPolicyDetails: expect.objectContaining({
                previousPolicyType: 'NOT_AVAILABLE',
              }),
            }),
          }),
        }),
      );
    });
  });
});
