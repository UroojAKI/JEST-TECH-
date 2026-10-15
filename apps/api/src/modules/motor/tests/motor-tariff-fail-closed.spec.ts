import { Test, TestingModule } from '@nestjs/testing';
import { MotorCalculationService } from '../services/motor-calculation.service';
import { MotorTariffService } from '../services/motor-tariff.service';
import { MotorPolicyDateService } from '../services/motor-policy-date.service';
import { PrismaService } from '../../../database/prisma.service';
import { BadRequestException } from '@nestjs/common';
import { VehicleCategory } from '@prisma/client';

describe('PR-04: Versioned Tariff Master & Fail-Closed Enforcement (D-04, T-06)', () => {
  let service: MotorCalculationService;
  let tariffService: { lookupTpTariff: jest.Mock };

  beforeEach(async () => {
    tariffService = {
      lookupTpTariff: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MotorCalculationService,
        MotorPolicyDateService,
        {
          provide: PrismaService,
          useValue: {
            systemConfig: { findFirst: jest.fn().mockResolvedValue(null) },
            ratingEngineRule: { findFirst: jest.fn().mockResolvedValue(null) },
            productAddonRate: { findMany: jest.fn().mockResolvedValue([]) },
          },
        },
        {
          provide: MotorTariffService,
          useValue: tariffService,
        },
      ],
    }).compile();

    service = module.get<MotorCalculationService>(MotorCalculationService);
  });

  it('T-06 verification: throws CONFIGURATION_ERROR when TP tariff is missing (fail-closed)', async () => {
    tariffService.lookupTpTariff.mockResolvedValue({
      found: false,
      annualPremium: 0,
      isVerified: false,
      warning: 'No active IRDAI TP tariff configuration found',
    });

    let thrownError: any = null;
    try {
      await service.calculate({
        vehicleCategory: VehicleCategory.PRIVATE_CAR,
        vehicleStatus: 'EXISTING',
        policyType: 'PACKAGE_COMPREHENSIVE',
        idv: 500000,
        ncbPercent: 20,
      });
    } catch (err) {
      thrownError = err;
    }

    expect(thrownError).toBeInstanceOf(BadRequestException);
    const response = thrownError.getResponse();
    expect(response).toMatchObject({
      errorCode: 'CONFIGURATION_ERROR',
      missingEntity: 'TP_TARIFF',
      vehicleCategory: 'PRIVATE_CAR',
      policyType: 'PACKAGE_COMPREHENSIVE',
    });
    expect(response.message).toContain('No active regulatory TP tariff found');
  });

  it('T-06 verification: throws CONFIGURATION_ERROR when tariff lookup throws unexpected error', async () => {
    tariffService.lookupTpTariff.mockRejectedValue(new Error('Database connection timeout'));

    let thrownError: any = null;
    try {
      await service.calculate({
        vehicleCategory: VehicleCategory.PRIVATE_CAR,
        vehicleStatus: 'EXISTING',
        policyType: 'THIRD_PARTY_ONLY',
        policyTenure: 1,
      });
    } catch (err) {
      thrownError = err;
    }

    expect(thrownError).toBeInstanceOf(BadRequestException);
    const response = thrownError.getResponse();
    expect(response).toMatchObject({
      errorCode: 'CONFIGURATION_ERROR',
      missingEntity: 'TP_TARIFF',
      vehicleCategory: 'PRIVATE_CAR',
    });
    expect(response.message).toContain('Tariff lookup failed');
  });

  it('permits STANDALONE_OD calculation without looking up TP tariff', async () => {
    const result = await service.calculate({
      vehicleCategory: VehicleCategory.PRIVATE_CAR,
      vehicleStatus: 'EXISTING',
      policyType: 'STANDALONE_OD',
      idv: 500000,
      ncbPercent: 20,
      activeTpPolicyNumber: 'TP-123456789',
      activeTpExpiryDate: '2027-12-31',
    });

    expect(tariffService.lookupTpTariff).not.toHaveBeenCalled();
    expect(result.outputs.baseTpPremium).toBe(0);
    expect(result.outputs.netOdPremium).toBeGreaterThan(0);
  });

  it('succeeds when an approved, verified regulatory tariff is present', async () => {
    tariffService.lookupTpTariff.mockResolvedValue({
      found: true,
      annualPremium: 3416,
      tariffId: 'tariff-pc-approved-2026',
      isVerified: true,
      source: 'IRDAI_TARIFF_CIRCULAR_2026',
    });

    const result = await service.calculate({
      vehicleCategory: VehicleCategory.PRIVATE_CAR,
      vehicleStatus: 'EXISTING',
      policyType: 'PACKAGE_COMPREHENSIVE',
      idv: 500000,
      ncbPercent: 20,
      paCover: true,
    });

    expect(result.outputs.baseTpPremium).toBe(3416);
    expect(result.rateConfig.tpTariffId).toBe('tariff-pc-approved-2026');
    expect(result.rateConfig.tpSource).toBe('IRDAI_TARIFF_CIRCULAR_2026');
  });
});
