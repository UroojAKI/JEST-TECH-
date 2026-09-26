import { MotorRuleEngineService } from './motor-rule-engine.service';
import { MotorPolicyDateService } from './motor-policy-date.service';

describe('MotorRuleEngineService (Business Invariants)', () => {
  let service: MotorRuleEngineService;
  let dateService: MotorPolicyDateService;

  beforeEach(() => {
    dateService = new MotorPolicyDateService();
    service = new MotorRuleEngineService(dateService);
  });

  describe('MOTOR-REG-13: TP Inspection Bypass', () => {
    it('should NEVER require inspection for TP_ONLY policy, even if previous policy is expired > 90 days', () => {
      const today = dateService.getBusinessToday();
      const pastDate = dateService.addDays(today, -120);

      const result = service.evaluateQuotation({
        newPolicyType: 'TP_ONLY',
        vehicleStatus: 'EXISTING',
        policyExpiryDate: pastDate,
        expiredMoreThan90Days: true,
        claimInPreviousYear: false,
        ownershipTransfer: false,
      });

      expect(result.inspectionRequired).toBe(false);
      expect(result.inspectionReasons).toHaveLength(0);
      expect(result.nextStep).toBe('QUOTATION');
    });
  });

  describe('MOTOR-REG-14: TP NCB Bypass', () => {
    it('should force NCB to 0% for TP_ONLY policies', () => {
      const result = service.evaluateQuotation({
        newPolicyType: 'TP_ONLY',
        vehicleStatus: 'EXISTING',
        eligibleNcbPercentage: 50,
        expiredMoreThan90Days: false,
        claimInPreviousYear: false,
        ownershipTransfer: false,
      });

      expect(result.ncb).toBe(0);
      expect(result.eligibleNcb).toBe(0);
    });
  });

  describe('MOTOR-REG-04: NEW Vehicle NCB = 0', () => {
    it('should force NCB to 0% for NEW vehicle', () => {
      const result = service.evaluateQuotation({
        newPolicyType: 'PACKAGE',
        vehicleStatus: 'NEW',
        eligibleNcbPercentage: 50,
        expiredMoreThan90Days: false,
        claimInPreviousYear: false,
        ownershipTransfer: false,
      });

      expect(result.ncb).toBe(0);
      expect(result.eligibleNcb).toBe(0);
    });
  });

  describe('MOTOR-REG-09: Same-day Expiry Semantics', () => {
    it('should treat policy expiring TODAY as ACTIVE (no inspection required for continuous renewal)', () => {
      const today = dateService.getBusinessToday();

      const result = service.evaluateQuotation({
        newPolicyType: 'PACKAGE',
        vehicleStatus: 'EXISTING',
        policyExpiryDate: today,
        expiredMoreThan90Days: false,
        claimInPreviousYear: false,
        ownershipTransfer: false,
        eligibleNcbPercentage: 20,
      });

      expect(result.inspectionRequired).toBe(false);
      expect(result.ncb).toBe(20);
    });
  });

  describe('Break-in & Expired Policy Inspection', () => {
    it('should require inspection when package policy expired yesterday', () => {
      const today = dateService.getBusinessToday();
      const yesterday = dateService.addDays(today, -1);

      const result = service.evaluateQuotation({
        newPolicyType: 'PACKAGE',
        vehicleStatus: 'EXISTING',
        policyExpiryDate: yesterday,
        expiredMoreThan90Days: false,
        claimInPreviousYear: false,
        ownershipTransfer: false,
        eligibleNcbPercentage: 20,
      });

      expect(result.inspectionRequired).toBe(true);
      expect(result.inspectionReasons).toContain('POLICY_EXPIRED');
    });

    it('should reset NCB to 0 when policy expired > 90 days', () => {
      const today = dateService.getBusinessToday();
      const past = dateService.addDays(today, -95);

      const result = service.evaluateQuotation({
        newPolicyType: 'PACKAGE',
        vehicleStatus: 'EXISTING',
        policyExpiryDate: past,
        claimInPreviousYear: false,
        ownershipTransfer: false,
        eligibleNcbPercentage: 35,
      });

      expect(result.inspectionRequired).toBe(true);
      expect(result.ncb).toBe(0);
      expect(result.ncbReason).toBe('POLICY_EXPIRED_MORE_THAN_90_DAYS');
    });
  });
});
