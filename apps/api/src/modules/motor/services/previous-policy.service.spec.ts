import { Test, TestingModule } from '@nestjs/testing';
import { PreviousPolicyService } from './previous-policy.service';
import { PrismaService } from '../../../database/prisma.service';
import { VehicleDataService } from './vehicle-data.service';

describe('PreviousPolicyService', () => {
  let service: PreviousPolicyService;
  let prisma: any;
  let vehicleDataService: any;

  beforeEach(async () => {
    prisma = {
      policy: {
        findFirst: jest.fn(),
      },
      vehicle: {
        findFirst: jest.fn(),
      },
    };

    vehicleDataService = {
      normalizeRegistrationNumber: jest
        .fn()
        .mockImplementation((raw: string) => ({
          normalized: raw ? raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : '',
        })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PreviousPolicyService,
        { provide: PrismaService, useValue: prisma },
        { provide: VehicleDataService, useValue: vehicleDataService },
      ],
    }).compile();

    service = module.get<PreviousPolicyService>(PreviousPolicyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns NOT_AVAILABLE when empty identifier is passed', async () => {
    const res = await service.fetchPreviousPolicy('');
    expect(res.status).toBe('NOT_AVAILABLE');
    expect(res.provenance).toBe('MANUAL');
  });

  it('returns AVAILABLE with PREVIOUS_POLICY provenance when policy exists', async () => {
    prisma.policy.findFirst.mockResolvedValue({
      id: 'pol-1',
      policyNumber: 'POL-2026-0001',
      actualPolicyNumber: 'ACT-999',
      policyType: 'PACKAGE',
      expiryDate: new Date('2027-01-01'),
      odExpiryDate: new Date('2027-01-01'),
      tpExpiryDate: new Date('2027-01-01'),
      claims: [],
      motorMetadata: { odPremium: 12000, tpPremium: 3500 },
      quotation: { insurerName: 'HDFC ERGO' },
      vehicle: {
        id: 'veh-1',
        registrationNumber: 'MH02CB1234',
        category: 'PRIVATE_CAR',
        makeModel: 'Hyundai Creta',
      },
      customer: {
        id: 'cust-1',
        customerCode: 'CUST-000001',
        firstName: 'Rahul',
        lastName: 'Sharma',
        mobile: '9876543210',
      },
    });

    const res = await service.fetchPreviousPolicy('MH-02-CB-1234');
    expect(res.status).toBe('AVAILABLE');
    expect(res.provenance).toBe('PREVIOUS_POLICY');
    expect(res.insurerName).toBe('HDFC ERGO');
    expect(res.hasClaims).toBe(false);
    expect(res.ncbPercentage).toBe(20);
    expect(res.previousOdPremium).toBe(12000);
    expect(res.vehicle?.registrationNumber).toBe('MH02CB1234');
  });

  it('sets ncbPercentage to 0 if claims were filed on previous policy', async () => {
    prisma.policy.findFirst.mockResolvedValue({
      id: 'pol-2',
      policyNumber: 'POL-2026-0002',
      claims: [{ id: 'clm-1', status: 'SETTLED' }],
      motorMetadata: {},
      quotation: { insurerName: 'ICICI Lombard' },
      vehicle: {
        id: 'v-1',
        registrationNumber: 'KA01AB1234',
        category: 'BIKE',
      },
    });

    const res = await service.fetchPreviousPolicy('KA01AB1234');
    expect(res.status).toBe('AVAILABLE');
    expect(res.hasClaims).toBe(true);
    expect(res.claimsCount).toBe(1);
    expect(res.ncbPercentage).toBe(0);
  });

  it('returns AVAILABLE with DATABASE provenance when only vehicle exists without policy', async () => {
    prisma.policy.findFirst.mockResolvedValue(null);
    prisma.vehicle.findFirst.mockResolvedValue({
      id: 'veh-2',
      registrationNumber: 'DL01XY9999',
      category: 'GCV',
      makeModel: 'Tata 407',
      customer: {
        id: 'c-2',
        customerCode: 'CUST-000002',
        firstName: 'Transport',
        lastName: 'Co',
        mobile: '9998887776',
      },
    });

    const res = await service.fetchPreviousPolicy('DL01XY9999');
    expect(res.status).toBe('AVAILABLE');
    expect(res.provenance).toBe('DATABASE');
    expect(res.vehicle?.makeModel).toBe('Tata 407');
    expect(res.ncbPercentage).toBe(0);
  });

  it('returns NOT_AVAILABLE gracefully when nothing matches', async () => {
    prisma.policy.findFirst.mockResolvedValue(null);
    prisma.vehicle.findFirst.mockResolvedValue(null);

    const res = await service.fetchPreviousPolicy('UNKNOWN123');
    expect(res.status).toBe('NOT_AVAILABLE');
    expect(res.provenance).toBe('MANUAL');
    expect(res.vehicle).toBeNull();
  });
});
