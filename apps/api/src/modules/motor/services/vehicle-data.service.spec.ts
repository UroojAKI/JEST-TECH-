import { Test, TestingModule } from '@nestjs/testing';
import { VehicleDataService } from './vehicle-data.service';
import { PrismaService } from '../../../database/prisma.service';
import { VehicleCategory } from '@prisma/client';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('VehicleDataService (R4 Integrity)', () => {
  let service: VehicleDataService;
  let prisma: PrismaService;

  const mockPrisma = {
    contact: { findUnique: jest.fn() },
    vehicle: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VehicleDataService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<VehicleDataService>(VehicleDataService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('normalizeRegistrationNumber', () => {
    it('normalizes standard plate with spaces and lowercase', () => {
      const result = service.normalizeRegistrationNumber('mh 02 cb 1234');
      expect(result.isValid).toBe(true);
      expect(result.normalized).toBe('MH02CB1234');
      expect(result.stateCode).toBe('MH');
      expect(result.rtoCode).toBe('MH02');
      expect(result.seriesType).toBe('STANDARD');
    });

    it('normalizes standard plate with single-digit RTO (e.g. DL 1 C 1234)', () => {
      const result = service.normalizeRegistrationNumber('DL1C1234');
      expect(result.isValid).toBe(true);
      expect(result.normalized).toBe('DL01C1234');
      expect(result.rtoCode).toBe('DL01');
    });

    it('normalizes Bharat (BH) Series plate', () => {
      const result = service.normalizeRegistrationNumber('22 bh 1234 aa');
      expect(result.isValid).toBe(true);
      expect(result.normalized).toBe('22BH1234AA');
      expect(result.seriesType).toBe('BH_SERIES');
    });

    it('handles brand new unregistered vehicle', () => {
      const result = service.normalizeRegistrationNumber('NEW');
      expect(result.isValid).toBe(true);
      expect(result.isNewVehicle).toBe(true);
      expect(result.normalized).toBe('NEW');
    });

    it('marks invalid registration plates as invalid', () => {
      const result = service.normalizeRegistrationNumber('12345ABC');
      expect(result.isValid).toBe(false);
      expect(result.seriesType).toBe('INVALID');
      expect(result.errorMessage).toBeDefined();
    });
  });

  describe('validateVehicleSpecs (8 IRDAI Categories)', () => {
    it('validates PRIVATE_CAR with complete specs', () => {
      const result = service.validateVehicleSpecs(VehicleCategory.PRIVATE_CAR, {
        vehicleSubType: 'Sedan',
        engineCapacityCcOrKw: 1498,
        seatingCapacity: 5,
      });

      expect(result.isValid).toBe(true);
      expect(result.missingFields).toHaveLength(0);
    });

    it('rejects PRIVATE_CAR missing required vehicleSubType', () => {
      const result = service.validateVehicleSpecs(VehicleCategory.PRIVATE_CAR, {
        engineCapacityCcOrKw: 1498,
      });

      expect(result.isValid).toBe(false);
      expect(result.missingFields[0]).toContain('vehicleSubType');
    });

    it('validates BIKE with complete specs', () => {
      const result = service.validateVehicleSpecs(VehicleCategory.BIKE, {
        vehicleSubType: 'Motorcycle',
        engineCapacityCcOrKw: 350,
      });

      expect(result.isValid).toBe(true);
    });

    it('validates GCV with weight attributes', () => {
      const result = service.validateVehicleSpecs(VehicleCategory.GCV, {
        grossVehicleWeightKg: 12000,
        carryingCapacityTonnes: 7.5,
      });

      expect(result.isValid).toBe(true);
    });

    it('validates TAXI with permit and seating capacity', () => {
      const result = service.validateVehicleSpecs(VehicleCategory.TAXI, {
        seatingCapacity: 4,
        permitType: 'All India Permit',
      });

      expect(result.isValid).toBe(true);
    });

    it('validates TRACTOR with horsePower', () => {
      const result = service.validateVehicleSpecs(VehicleCategory.TRACTOR, {
        horsePowerHp: 45,
      });

      expect(result.isValid).toBe(true);
    });
  });

  describe('upsertVehicle', () => {
    it('creates new vehicle under contact when none exists', async () => {
      mockPrisma.contact.findUnique.mockResolvedValue({ id: 'con-1' });
      mockPrisma.vehicle.findFirst.mockResolvedValue(null);
      mockPrisma.vehicle.count.mockResolvedValue(41);
      mockPrisma.vehicle.create.mockResolvedValue({
        id: 'veh-new-1',
        vehicleCode: 'VEH-2026-000042',
        registrationNumber: 'MH02CB1234',
        contactId: 'con-1',
      });

      const result = await service.upsertVehicle({
        contactId: 'con-1',
        category: VehicleCategory.PRIVATE_CAR,
        registrationNumber: 'mh 02 cb 1234',
        makeModel: 'Honda City',
        categorySpecificData: {
          vehicleSubType: 'Sedan',
          engineCapacityCcOrKw: 1500,
        },
      });

      expect(result.id).toBe('veh-new-1');
      expect(mockPrisma.vehicle.create).toHaveBeenCalled();
    });

    it('throws NotFoundException if contact does not exist', async () => {
      mockPrisma.contact.findUnique.mockResolvedValue(null);

      await expect(
        service.upsertVehicle({
          contactId: 'invalid-con',
          category: VehicleCategory.BIKE,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
