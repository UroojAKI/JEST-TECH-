import { BadRequestException } from '@nestjs/common';
import { HealthPlanValidationService, MemberFacts } from './health-plan-validation.service';

describe('HealthPlanValidationService', () => {
  const service = new HealthPlanValidationService();
  const member = (overrides: Partial<MemberFacts> = {}): MemberFacts => ({
    dateOfBirth: '1990-05-14',
    relation: 'SELF',
    heightCm: 160,
    weightKg: 64,
    preExistingDiseases: 'None',
    isSmoker: false,
    ...overrides,
  });
  const identity = { planName: 'Optima Secure', uin: 'HDFHLIP23071V052223', sumInsured: 500000 };

  const messages = (fn: () => unknown): string[] => {
    try {
      fn();
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      return (e as BadRequestException).getResponse()['message'];
    }
    throw new Error('expected BadRequestException');
  };

  describe('Section A per category', () => {
    it('accepts a complete Individual plan and derives member facts', () => {
      const result = service.validatePlanDetails(
        'INDIVIDUAL',
        { ...identity, indemnityType: 'INDEMNITY', roomRentCategory: 'NO_CAPPING' },
        [member()],
      );

      expect(result.derived.memberCount).toBe(1);
      expect(result.derived.anyPreExistingDisease).toBe(false);
      expect(result.derived.bmi[0]).toBe(25);
    });

    it('rejects an Individual plan missing room rent and indemnity type', () => {
      const errors = messages(() => service.validatePlanDetails('INDIVIDUAL', { ...identity }, [member()]));

      expect(errors.join(' ')).toContain('planDetails.indemnityType');
      expect(errors.join(' ')).toContain('planDetails.roomRentCategory');
    });

    it('rejects unknown fields', () => {
      const errors = messages(() =>
        service.validatePlanDetails(
          'INDIVIDUAL',
          { ...identity, indemnityType: 'INDEMNITY', roomRentCategory: 'NO_CAPPING', foo: 1 },
          [member()],
        ),
      );

      expect(errors.join(' ')).toContain('foo');
    });

    it('requires co-payment and medical tests for Senior Citizen and warns on age < 60', () => {
      expect(() => service.validatePlanDetails('SENIOR_CITIZEN', { ...identity }, [member()])).toThrow(
        BadRequestException,
      );

      const result = service.validatePlanDetails(
        'SENIOR_CITIZEN',
        { ...identity, coPaymentPercent: 20, prePolicyMedicalTests: ['ECG'], existingChronicIllness: ['NONE'] },
        [member()],
      );
      expect(result.warnings[0]).toContain('senior citizen');
    });

    it('sets the fixed 90-day first diagnosis waiting period for Critical Illness', () => {
      const result = service.validatePlanDetails(
        'CRITICAL_ILLNESS',
        { ...identity, illnessesCovered: ['CANCER'], survivalPeriodDays: 30, familyHistoryOfCriticalIllness: false },
        [member()],
      );

      expect(result.firstDiagnosisWaitingDays).toBe(90);
    });

    it('rejects a Top-up deductible larger than the base policy sum insured', () => {
      expect(() =>
        service.validatePlanDetails(
          'TOP_UP',
          { ...identity, deductibleAmount: 600000, basePolicySumInsured: 500000, deductibleBasis: 'AGGREGATE_ANNUAL' },
          [member()],
        ),
      ).toThrow('deductible');
    });

    it('requires grade-wise sum insured only for graded Group schemes', () => {
      const group = {
        schemeType: 'EMPLOYER_EMPLOYEE',
        memberStrength: 120,
        sumInsured: 300000,
        masterPolicyholderName: 'Acme Pvt Ltd',
        policyEffectiveDate: '2026-11-01',
      };

      expect(() =>
        service.validatePlanDetails('GROUP_CORPORATE', { ...group, sumInsuredBasis: 'FLAT' }, [member()]),
      ).not.toThrow();
      expect(() =>
        service.validatePlanDetails('GROUP_CORPORATE', { ...group, sumInsuredBasis: 'GRADED' }, [member()]),
      ).toThrow(BadRequestException);
    });

    it('requires travel fields only for Travel Health in Miscellaneous', () => {
      expect(() =>
        service.validatePlanDetails('MISCELLANEOUS', { planType: 'OPD_COVER', sumInsured: 50000 }, [member()]),
      ).not.toThrow();

      const errors = messages(() =>
        service.validatePlanDetails('MISCELLANEOUS', { planType: 'TRAVEL_HEALTH', sumInsured: 50000 }, [member()]),
      );
      expect(errors.join(' ')).toContain('travelDestination');
      expect(errors.join(' ')).toContain('coverageTerritory');
    });
  });

  describe('Renewal / Portability (Form ii)', () => {
    const renewal = {
      renewalType: 'RENEWAL',
      previousInsurerName: 'Star Health',
      previousPolicyNumber: 'P/123',
      sumInsuredContinuation: 'CONTINUED',
      cumulativeBonusPercent: 20,
      claimInExpiringPolicy: false,
    };

    it('is skipped for a new policy', () => {
      expect(service.validateRenewal('NEW_POLICY', undefined)).toBeUndefined();
    });

    it('is required for renewal / portability', () => {
      expect(() => service.validateRenewal('RENEWAL_PORTABILITY', undefined)).toThrow(BadRequestException);
      expect(service.validateRenewal('RENEWAL_PORTABILITY', renewal)).toMatchObject(renewal);
    });

    it('requires waiting period credit only for port-in', () => {
      const errors = messages(() =>
        service.validateRenewal('RENEWAL_PORTABILITY', { ...renewal, renewalType: 'PORTABILITY' }),
      );
      expect(errors.join(' ')).toContain('waitingPeriodCredit');
    });
  });
});
