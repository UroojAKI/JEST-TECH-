import { Test, TestingModule } from '@nestjs/testing';
import { LeadCompletionService } from './lead-completion.service';
import { PrismaService } from '../../../database/prisma.service';
import { VehicleCategory, VehicleStatus } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';

describe('LeadCompletionService (G019 Stage-Gate Enforcement)', () => {
  let service: LeadCompletionService;
  let prisma: PrismaService;

  const mockPrisma = {
    lead: { findUnique: jest.fn() },
    document: { count: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadCompletionService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<LeadCompletionService>(LeadCompletionService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('computes 100% completion for complete lead with vehicle and documents', async () => {
    const mockLead = {
      id: 'lead-1',
      leadCode: 'LD-001',
      title: 'Honda City Insurance',
      source: 'DIGITAL',
      assignedToId: 'agent-1',
      description: 'Previous policy expiring next week, NCB 20%',
      contactId: 'con-1',
      contact: {
        id: 'con-1',
        firstName: 'Amit',
        lastName: 'Patel',
        phone: '9820123456',
        email: 'amit@example.com',
        panNumber: 'ABCDE1234F',
        vehicles: [
          {
            id: 'veh-1',
            status: VehicleStatus.EXISTING,
            category: VehicleCategory.PRIVATE_CAR,
            registrationNumber: 'MH02CB1234',
            makeModel: 'Honda City ZX CVT',
            fuelType: 'PETROL',
            manufactureYearMonth: '2022-04',
          },
        ],
      },
      account: null,
      assignedTo: { id: 'agent-1', firstName: 'Agent', lastName: 'One' },
    };

    mockPrisma.lead.findUnique.mockResolvedValue(mockLead);
    mockPrisma.document.count.mockResolvedValue(2); // RC and Aadhaar uploaded

    const result = await service.computeCompletionStatus('lead-1');

    expect(result.totalScore).toBe(100);
    expect(result.isQualifiedForQuotation).toBe(true);
    expect(result.blockingReasons).toHaveLength(0);
    expect(result.stages).toHaveLength(5);
  });

  it('blocks qualification when vehicle data is missing', async () => {
    const mockLeadWithoutVehicle = {
      id: 'lead-2',
      leadCode: 'LD-002',
      title: 'New Lead Inquiry',
      source: 'WALK_IN',
      assignedToId: 'agent-1',
      description: '',
      contactId: 'con-2',
      contact: {
        id: 'con-2',
        firstName: 'Pooja',
        lastName: 'Sharma',
        phone: '9820987654',
        email: 'pooja@example.com',
        panNumber: null,
        vehicles: [], // No vehicle
      },
      account: null,
      assignedTo: { id: 'agent-1' },
    };

    mockPrisma.lead.findUnique.mockResolvedValue(mockLeadWithoutVehicle);
    mockPrisma.document.count.mockResolvedValue(0);

    const result = await service.computeCompletionStatus('lead-2');

    expect(result.isQualifiedForQuotation).toBe(false);
    expect(result.blockingReasons.some((r) => r.includes('vehicle'))).toBe(true);
    expect(result.stages.find((s) => s.stage === 3)?.isComplete).toBe(false);
  });

  it('throws NotFoundException for unknown lead', async () => {
    mockPrisma.lead.findUnique.mockResolvedValue(null);

    await expect(service.computeCompletionStatus('unknown-id')).rejects.toThrow(NotFoundException);
  });
});
