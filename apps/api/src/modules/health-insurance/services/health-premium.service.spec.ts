import { HealthPremiumService } from './health-premium.service';

describe('HealthPremiumService', () => {
  const service = new HealthPremiumService();
  const hospitalCash = { rider: 'HOSPITAL_CASH', sumInsured: 100000, premium: 2000 };

  it('adds 18% GST on base + rider premium', () => {
    const result = service.calculate({ basePremium: 10000, riders: [hospitalCash] });

    expect(result.riderPremium).toBe(2000);
    expect(result.netPremium).toBe(12000);
    expect(result.gstAmount).toBe(2160);
    expect(result.totalPremium).toBe(14160);
  });

  it('treats no riders as zero rider premium (renewal form)', () => {
    const result = service.calculate({ basePremium: 18000 });

    expect(result.riderPremium).toBe(0);
    expect(result.totalPremium).toBe(21240);
  });

  it('calculates commission on the pre-GST premium and net payable', () => {
    const result = service.calculate({ basePremium: 10000, riders: [hospitalCash], commissionPercent: 15 });

    expect(result.commissionAmount).toBe(1800);
    expect(result.netPayable).toBe(12360);
  });

  it('net payable equals total when no commission is given', () => {
    const result = service.calculate({ basePremium: 10000 });

    expect(result.commissionAmount).toBe(0);
    expect(result.netPayable).toBe(result.totalPremium);
  });

  it('sums several riders and reports rider GST total (Form iii)', () => {
    const result = service.calculate({
      basePremium: 10000,
      riders: [hospitalCash, { rider: 'OPD_COVER', sumInsured: 25000, premium: 1500 }],
      commissionPercent: 15,
      riderCommissionPercent: 10,
    });

    expect(result.riders.riderPremium).toBe(3500);
    expect(result.riders.riderGstAmount).toBe(630);
    expect(result.riders.riderTotalPremium).toBe(4130);
    expect(result.riders.riderCommissionAmount).toBe(350);
  });

  it('rider commission defaults to the main commission percent', () => {
    const result = service.calculate({ basePremium: 10000, riders: [hospitalCash], commissionPercent: 15 });

    expect(result.riders.riderCommissionAmount).toBe(300);
  });

  it('rounds to two decimals', () => {
    const result = service.calculate({ basePremium: 999.99 });

    expect(result.gstAmount).toBe(180);
    expect(result.totalPremium).toBe(1179.99);
  });
});
