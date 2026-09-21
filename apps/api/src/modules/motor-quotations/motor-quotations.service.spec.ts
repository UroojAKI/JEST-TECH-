import { Test, TestingModule } from '@nestjs/testing';
import { MotorQuotationsService } from './motor-quotations.service';
import { PrismaService } from '../../database/prisma.service';
import { LeadLifecycleService } from '../leads/services/lead-lifecycle.service';
import {
  RoleType,
  MotorQuotationStatus,
  LeadStatus,
  Prisma,
} from '@prisma/client';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

describe('MotorQuotationsService', () => {
  let service: MotorQuotationsService;
  let prisma: any;
  let leadLifecycleService: any;

  const mockLead = {
    id: 'lead-1',
    companyId: 'org-1',
    leadCode: 'LEAD-0001',
    status: LeadStatus.QUOTATION,
    customerId: 'cust-1',
    agentId: 'agent-1',
    agent: { id: 'agent-1', agentCode: 'AGT-0001' },
    deletedAt: null,
  };

  const mockVehicle = {
    id: 'veh-1',
    registrationNumber: 'MH02CB1234',
    category: 'PRIVATE_CAR',
    customerId: 'cust-1',
    deletedAt: null,
  };

  const mockQuotation = {
    id: 'quote-1',
    companyId: 'org-1',
    quotationNumber: 'MQT-000001',
    leadId: 'lead-1',
    vehicleId: 'veh-1',
    customerId: 'cust-1',
    agentId: 'agent-1',
    agentCodeSnapshot: 'AGT-0001',
    insurerName: 'HDFC ERGO',
    planName: 'Optima Secure Motor',
    status: MotorQuotationStatus.DRAFT,
    finalPremium: new Prisma.Decimal(18500),
    vehicle: mockVehicle,
    lead: mockLead,
    deletedAt: null,
  };

  beforeEach(async () => {
    prisma = {
      lead: { findUnique: jest.fn() },
      vehicle: { findUnique: jest.fn() },
      agent: { findUnique: jest.fn() },
      motorQuotation: {
        count: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ nextval: 1n }]),
      $executeRaw: jest.fn().mockResolvedValue(1),
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    leadLifecycleService = {
      transition: jest.fn().mockResolvedValue({ success: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MotorQuotationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: LeadLifecycleService, useValue: leadLifecycleService },
      ],
    }).compile();

    service = module.get<MotorQuotationsService>(MotorQuotationsService);
  });

  describe('create', () => {
    it('should create a motor quotation with auto-generated MQT-XXXXXX and agent snapshot', async () => {
      prisma.lead.findUnique.mockResolvedValue(mockLead);
      prisma.vehicle.findUnique.mockResolvedValue(mockVehicle);
      prisma.motorQuotation.count.mockResolvedValue(0);
      prisma.motorQuotation.findUnique.mockResolvedValue(null);
      prisma.motorQuotation.create.mockResolvedValue(mockQuotation);

      const result = await service.create(
        {
          leadId: 'lead-1',
          vehicleId: 'veh-1',
          insurerName: 'HDFC ERGO',
          finalPremium: 18500,
        },
        { id: 'user-1', role: RoleType.ADMIN, companyId: 'org-1' } as any,
      );

      expect(prisma.motorQuotation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            quotationNumber: 'MQT-000001',
            agentCodeSnapshot: 'AGT-0001',
            insurerName: 'HDFC ERGO',
          }),
        }),
      );
      expect(result).toEqual(mockQuotation);
    });

    it('should throw NotFoundException if lead does not exist', async () => {
      prisma.lead.findUnique.mockResolvedValue(null);

      await expect(
        service.create(
          {
            leadId: 'invalid',
            vehicleId: 'veh-1',
            insurerName: 'Tata AIG',
            finalPremium: 15000,
          },
          { id: 'user-1', role: RoleType.ADMIN, companyId: 'org-1' } as any,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('compareQuotes', () => {
    it('should calculate price comparison matrix for multi-insurer evaluation', async () => {
      prisma.motorQuotation.findMany.mockResolvedValue([
        {
          id: 'q-1',
          quotationNumber: 'MQT-000001',
          insurerName: 'Tata AIG',
          finalPremium: new Prisma.Decimal(12000),
        },
        {
          id: 'q-2',
          quotationNumber: 'MQT-000002',
          insurerName: 'HDFC ERGO',
          finalPremium: new Prisma.Decimal(15000),
        },
        {
          id: 'q-3',
          quotationNumber: 'MQT-000003',
          insurerName: 'ICICI Lombard',
          finalPremium: new Prisma.Decimal(18000),
        },
      ]);

      const result = await service.compareQuotes('veh-1', {
        id: 'user-1',
        role: RoleType.ADMIN,
        companyId: 'org-1',
      } as any);
      expect(result.count).toBe(3);
      expect(result.bestPrice).toBe(12000);
      expect(result.highestPrice).toBe(18000);
      expect(result.averagePrice).toBe(15000);
      expect(result.comparison[0].isLowest).toBe(true);
      expect(result.comparison[1].isLowest).toBe(false);
    });
  });

  describe('acceptQuotation', () => {
    it('should mark quote accepted, reject competing vehicle quotes, and transition lead', async () => {
      prisma.motorQuotation.findFirst.mockResolvedValue(mockQuotation);

      const result = await service.acceptQuotation('quote-1', {
        id: 'user-1',
        role: RoleType.ADMIN,
        companyId: 'org-1',
      } as any);

      expect(prisma.motorQuotation.update).toHaveBeenCalledWith({
        where: { id: 'quote-1' },
        data: { status: MotorQuotationStatus.ACCEPTED },
      });
      expect(prisma.motorQuotation.updateMany).toHaveBeenCalledWith({
        where: {
          companyId: 'org-1',
          vehicleId: 'veh-1',
          id: { not: 'quote-1' },
          status: {
            in: [MotorQuotationStatus.DRAFT, MotorQuotationStatus.SHARED],
          },
        },
        data: { status: MotorQuotationStatus.REJECTED },
      });
      expect(leadLifecycleService.transition).toHaveBeenCalledWith(
        'lead-1',
        LeadStatus.CUSTOMER_ACCEPTED,
        expect.any(Object),
        expect.any(String),
      );
      expect(result.success).toBe(true);
    });
  });
});
