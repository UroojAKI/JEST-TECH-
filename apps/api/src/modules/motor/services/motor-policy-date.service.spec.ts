import { MotorPolicyDateService } from './motor-policy-date.service';

describe('MotorPolicyDateService', () => {
  let service: MotorPolicyDateService;

  beforeEach(() => {
    service = new MotorPolicyDateService();
  });

  it('should return today formatted as YYYY-MM-DD in Asia/Kolkata', () => {
    const today = service.getBusinessToday();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('should format dates properly to Asia/Kolkata YYYY-MM-DD', () => {
    const date = new Date('2026-09-26T00:00:00Z');
    const formatted = service.toBusinessDate(date);
    expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('MOTOR-REG-09: Policy expiring today must be evaluated as ACTIVE / NOT EXPIRED', () => {
    const today = service.getBusinessToday();
    // Expiry date is today
    const isExpired = service.isExpired(today);
    expect(isExpired).toBe(false);

    // Policy active today
    const isActive = service.isPolicyActive(today, today);
    expect(isActive).toBe(true);
  });

  it('should calculate 1-year minus 1 day correctly', () => {
    const end = service.addYearsMinusOneDay('2026-09-26', 1);
    expect(end).toBe('2027-09-25');
  });

  it('should calculate 3-years minus 1 day correctly for new cars', () => {
    const end = service.addYearsMinusOneDay('2026-09-26', 3);
    expect(end).toBe('2029-09-25');
  });

  it('should compute authoritative dates for a NEW car with 3y TP', () => {
    const dates = service.calculateMotorDates({
      vehicleStatus: 'NEW',
      vehicleCategory: 'PRIVATE_CAR',
      policyType: 'PACKAGE_COMPREHENSIVE',
      requestedStartDate: '2026-10-01',
    });

    expect(dates.effectiveStartDate).toBe('2026-10-01');
    expect(dates.odStartDate).toBe('2026-10-01');
    expect(dates.odEndDate).toBe('2027-09-30');
    expect(dates.tpStartDate).toBe('2026-10-01');
    expect(dates.tpEndDate).toBe('2029-09-30');
    expect(dates.effectiveEndDate).toBe('2029-09-30');
  });

  it('should compute continuous renewal starting day after previous expiry if previous expiry is future/today', () => {
    const today = service.getBusinessToday();
    const dates = service.calculateMotorDates({
      vehicleStatus: 'EXISTING',
      vehicleCategory: 'PRIVATE_CAR',
      policyType: 'PACKAGE_COMPREHENSIVE',
      previousExpiryDate: today,
    });

    const expectedStart = service.addDays(today, 1);
    expect(dates.effectiveStartDate).toBe(expectedStart);
  });
});
