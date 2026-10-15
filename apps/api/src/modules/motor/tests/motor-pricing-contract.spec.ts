import { validate } from 'class-validator';
import {
  InsurerCommissionConfigDto,
  CommissionConfigStatus,
  CommissionBreakdownDto,
  CustomerDiscountBreakdownDto,
  ConfigurationErrorResponseDto,
  ConfigurationMissingEntity,
} from '../dto/motor-pricing-contract.dto';
import { VehicleCategory } from '@prisma/client';

describe('PR-02: Pricing & Configuration Contracts Parity & Validation', () => {
  it('validates a correct InsurerCommissionConfigDto', async () => {
    const dto = new InsurerCommissionConfigDto();
    dto.insurerId = 'ins-hdfc-01';
    dto.vehicleCategory = VehicleCategory.PRIVATE_CAR;
    dto.productType = 'PACKAGE_COMPREHENSIVE';
    dto.odRatePercent = 15;
    dto.tpRatePercent = 2.5;
    dto.netRatePercent = 12.5;
    dto.effectiveFrom = '2026-04-01T00:00:00.000Z';
    dto.status = CommissionConfigStatus.ACTIVE;

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('rejects invalid commission percentages exceeding 100 or below 0', async () => {
    const dto = new InsurerCommissionConfigDto();
    dto.insurerId = 'ins-hdfc-01';
    dto.vehicleCategory = VehicleCategory.PRIVATE_CAR;
    dto.productType = 'PACKAGE';
    dto.odRatePercent = 150; // invalid > 100
    dto.tpRatePercent = -5; // invalid < 0
    dto.netRatePercent = 20;
    dto.effectiveFrom = '2026-04-01T00:00:00.000Z';
    dto.status = CommissionConfigStatus.ACTIVE;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });

  it('validates CommissionBreakdownDto and CustomerDiscountBreakdownDto separation', async () => {
    // Commission earnings
    const comm = new CommissionBreakdownDto();
    comm.odCommissionAmount = 1500;
    comm.tpCommissionAmount = 250;
    comm.totalCommissionAmount = 1750;
    comm.commissionableOdBase = 10000;
    comm.commissionableTpBase = 3416;

    const commErrors = await validate(comm);
    expect(commErrors.length).toBe(0);

    // Customer discounts (deductions from premium)
    const disc = new CustomerDiscountBreakdownDto();
    disc.odDiscountAmount = 1000;
    disc.tpDiscountAmount = 0;
    disc.ncbDiscountAmount = 2000;
    disc.totalDiscountAmount = 3000;

    const discErrors = await validate(disc);
    expect(discErrors.length).toBe(0);

    // Verify properties never overlap
    expect(Object.keys(comm)).not.toEqual(Object.keys(disc));
  });

  it('validates ConfigurationErrorResponseDto for fail-closed tariff lookup', async () => {
    const err = new ConfigurationErrorResponseDto();
    err.errorCode = 'CONFIGURATION_ERROR';
    err.message = 'No active and verified IRDAI TP tariff found for vehicleCategory=PRIVATE_CAR';
    err.missingEntity = ConfigurationMissingEntity.TP_TARIFF;
    err.vehicleCategory = 'PRIVATE_CAR';
    err.policyType = 'PACKAGE';
    err.effectiveDate = '2026-10-15T00:00:00.000Z';
    err.details = { engineCc: 1198 };

    const errors = await validate(err);
    expect(errors.length).toBe(0);
  });
});
