import { ProductType } from '@prisma/client';
import { PremiumService } from './premium.service';

describe('PremiumService', () => {
  it('rounds the OD premium half-up without binary float drift', () => {
    const result = new PremiumService().calculateMotorPremium(
      ProductType.PACKAGE_COMPREHENSIVE,
      3_000_000,
      1200,
    );

    expect(result.odPremium).toBe(107_882);
  });
});
