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

  describe('MOTOR-0060: Dedicated Server-Side SAOD Validator', () => {
    it('rejects SAOD for NEW vehicle', () => {
      expect(() =>
        service.validateSaodEligibility({
          vehicleStatus: 'NEW',
          activeTpPolicyNumber: 'TP-123',
          activeTpExpiryDate: dateService.addDays(dateService.getBusinessToday(), 180),
        }),
      ).toThrow('Standalone OD is not applicable for new vehicles');
    });

    it('rejects SAOD when activeTpPolicyNumber is missing or empty', () => {
      expect(() =>
        service.validateSaodEligibility({
          vehicleStatus: 'EXISTING',
          activeTpPolicyNumber: '',
          activeTpExpiryDate: dateService.addDays(dateService.getBusinessToday(), 180),
        }),
      ).toThrow('Active TP Policy Number is required');
    });

    it('rejects SAOD when activeTpExpiryDate is missing', () => {
      expect(() =>
        service.validateSaodEligibility({
          vehicleStatus: 'EXISTING',
          activeTpPolicyNumber: 'TP-123456',
        }),
      ).toThrow('Active TP Policy Expiry Date is required');
    });

    it('rejects SAOD when active TP policy has expired', () => {
      const expiredYesterday = dateService.addDays(dateService.getBusinessToday(), -1);
      expect(() =>
        service.validateSaodEligibility({
          vehicleStatus: 'EXISTING',
          activeTpPolicyNumber: 'TP-123456',
          activeTpExpiryDate: expiredYesterday,
        }),
      ).toThrow('Active TP Policy has expired');
    });

    it('passes SAOD validation when active TP policy is valid and in force', () => {
      const futureExpiry = dateService.addDays(dateService.getBusinessToday(), 180);
      const res = service.validateSaodEligibility({
        vehicleStatus: 'EXISTING',
        activeTpPolicyNumber: 'TP-123456',
        activeTpInsurer: 'New India Assurance',
        activeTpExpiryDate: futureExpiry,
      });
      expect(res.valid).toBe(true);
    });
  });

  describe('REQ-1: Mandatory Vehicle Inspection Rules', () => {
    it('triggers inspection when previous policy details are not entered or unavailable for existing vehicle', () => {
      const result = service.evaluateQuotation({
        newPolicyType: 'PACKAGE',
        vehicleStatus: 'EXISTING',
        eligibleNcbPercentage: 20,
      });

      expect(result.inspectionRequired).toBe(true);
      expect(result.inspectionReasons).toContain('PREVIOUS_POLICY_DETAILS_UNAVAILABLE');
      expect(result.nextStep).toBe('INSPECTION');
      expect(result.missingDocuments).toContain('PREVIOUS_POLICY_COPY');
    });

    it('triggers inspection when previousPolicyType is NOT_AVAILABLE', () => {
      const result = service.evaluateQuotation({
        newPolicyType: 'PACKAGE',
        vehicleStatus: 'EXISTING',
        previousPolicyType: 'NOT_AVAILABLE',
        eligibleNcbPercentage: 20,
      });

      expect(result.inspectionRequired).toBe(true);
      expect(result.inspectionReasons).toContain('PREVIOUS_POLICY_DETAILS_UNAVAILABLE');
    });

    it('triggers inspection when package explicitly requires it', () => {
      const today = dateService.getBusinessToday();
      const result = service.evaluateQuotation({
        newPolicyType: 'PACKAGE',
        vehicleStatus: 'EXISTING',
        policyExpiryDate: today,
        previousPolicyType: 'COMPREHENSIVE',
        packageRequiresInspection: true,
      });

      expect(result.inspectionRequired).toBe(true);
      expect(result.inspectionReasons).toContain('PACKAGE_REQUIRES_INSPECTION');
    });

    it('does NOT trigger inspection for TP_ONLY statutory bypass even if previous details are unavailable', () => {
      const result = service.evaluateQuotation({
        newPolicyType: 'TP_ONLY',
        vehicleStatus: 'EXISTING',
      });

      expect(result.inspectionRequired).toBe(false);
      expect(result.inspectionReasons).toHaveLength(0);
    });
  });

  describe('Old Customer inspection bypass', () => {
    it('bypasses expiry inspection when isOldCustomer=true even if policy expired <= 90 days', () => {
      const today = dateService.getBusinessToday();
      const expiredYesterday = dateService.addDays(today, -5);

      const result = service.evaluateQuotation({
        newPolicyType: 'PACKAGE',
        vehicleStatus: 'EXISTING',
        previousPolicyType: 'COMPREHENSIVE',
        policyExpiryDate: expiredYesterday,
        eligibleNcbPercentage: 25,
        isOldCustomer: true,
      });

      expect(result.inspectionRequired).toBe(false);
      expect(result.inspectionReasons).toHaveLength(0);
      expect(result.nextStep).toBe('QUOTATION');
      expect(result.ncb).toBe(25);
      expect(result.missingDocuments).toContain('PREVIOUS_POLICY_COPY');
    });

    it('bypasses expiry inspection when isOldCustomer=true and policy expired > 90 days while keeping NCB reset and missing document checks unchanged', () => {
      const today = dateService.getBusinessToday();
      const expiredLongAgo = dateService.addDays(today, -120);

      const result = service.evaluateQuotation({
        newPolicyType: 'PACKAGE',
        vehicleStatus: 'EXISTING',
        previousPolicyType: 'COMPREHENSIVE',
        policyExpiryDate: expiredLongAgo,
        eligibleNcbPercentage: 35,
        isOldCustomer: true,
      });

      expect(result.inspectionRequired).toBe(false);
      expect(result.inspectionReasons).toHaveLength(0);
      expect(result.nextStep).toBe('QUOTATION');
      expect(result.ncb).toBe(0);
      expect(result.ncbReason).toBe('POLICY_EXPIRED_MORE_THAN_90_DAYS');
      expect(result.missingDocuments).toContain('PREVIOUS_POLICY_COPY');
    });

    it('bypasses SAOD expired OD inspection when isOldCustomer=true and TP is active', () => {
      const today = dateService.getBusinessToday();
      const activeTpExpiry = dateService.addDays(today, 180);
      const expiredOd = dateService.addDays(today, -30);

      const result = service.evaluateQuotation({
        newPolicyType: 'SAOD',
        vehicleStatus: 'EXISTING',
        previousPolicyType: 'SAOD',
        policyExpiryDate: expiredOd,
        odExpiryDate: expiredOd,
        tpExpiryDate: activeTpExpiry,
        eligibleNcbPercentage: 20,
        isOldCustomer: true,
      });

      expect(result.inspectionRequired).toBe(false);
      expect(result.inspectionReasons).toHaveLength(0);
      expect(result.nextStep).toBe('QUOTATION');
    });

    it('still requires inspection for non-expiry rules even when isOldCustomer=true', () => {
      const today = dateService.getBusinessToday();
      const activeExpiry = dateService.addDays(today, 10);

      const tpUpgrade = service.evaluateQuotation({
        newPolicyType: 'PACKAGE',
        vehicleStatus: 'EXISTING',
        previousPolicyType: 'THIRD_PARTY',
        policyExpiryDate: activeExpiry,
        isOldCustomer: true,
      });
      expect(tpUpgrade.inspectionRequired).toBe(true);
      expect(tpUpgrade.inspectionReasons).toContain('TP_TO_PACKAGE_UPGRADE');

      const transferNotTransferred = service.evaluateQuotation({
        newPolicyType: 'PACKAGE',
        vehicleStatus: 'EXISTING',
        previousPolicyType: 'COMPREHENSIVE',
        policyExpiryDate: activeExpiry,
        ownershipTransfer: true,
        previousPolicyTransferred: false,
        isOldCustomer: true,
      });
      expect(transferNotTransferred.inspectionRequired).toBe(true);
      expect(transferNotTransferred.inspectionReasons).toContain('OWNERSHIP_TRANSFER_POLICY_NOT_TRANSFERRED');

      const missingPrevPolicy = service.evaluateQuotation({
        newPolicyType: 'PACKAGE',
        vehicleStatus: 'EXISTING',
        previousPolicyType: 'NOT_AVAILABLE',
        isOldCustomer: true,
      });
      expect(missingPrevPolicy.inspectionRequired).toBe(true);
      expect(missingPrevPolicy.inspectionReasons).toContain('PREVIOUS_POLICY_DETAILS_UNAVAILABLE');
    });
  });
});
