import { BadRequestException } from '@nestjs/common';
import { MotorRulesEvaluateController } from './motor-rules-evaluate.controller';

describe('MotorRulesEvaluateController SAOD TP verification', () => {
  let controller: MotorRulesEvaluateController;
  let ruleEngine: { evaluateQuotation: jest.Mock };

  const validSaod = {
    newPolicyType: 'SAOD' as const,
    vehicleStatus: 'EXISTING' as const,
    activeTpInsurer: 'TATA AIG',
    activeTpPolicyNumber: 'TP-123456',
    activeTpStartDate: '2026-01-01',
    tpExpiryDate: '2027-12-31',
    activeTpVerificationMethod: 'POLICY_DOCUMENT',
    activeTpVerificationStatus: 'VERIFIED' as const,
    activeTpVerifiedByUserConfirmed: true,
  };

  beforeEach(() => {
    ruleEngine = {
      evaluateQuotation: jest.fn().mockReturnValue({
        inspectionRequired: false,
        inspectionReasons: [],
        ncb: 20,
        ncbReason: 'ELIGIBLE',
        eligibleNcb: 20,
        tpVerificationRequired: true,
        saodTpValid: true,
        policyTransferRequired: false,
        missingDocuments: [],
        nextStep: 'QUOTATION',
      }),
    };
    controller = new MotorRulesEvaluateController({} as any, ruleEngine as any);
  });

  it('rejects SAOD rule evaluation with missing TP fields before calling the rule engine', async () => {
    await expect(
      controller.evaluateRules(
        { newPolicyType: 'SAOD', vehicleStatus: 'EXISTING' } as any,
        { id: 'user-1', companyId: 'company-1' } as any,
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        errorCode: 'ACTIVE_TP_VERIFICATION_REQUIRED',
      }),
    });
    expect(ruleEngine.evaluateQuotation).not.toHaveBeenCalled();
  });

  it('rejects SAOD rule evaluation when TP confirmation is not verified', async () => {
    await expect(
      controller.evaluateRules(
        { ...validSaod, activeTpVerificationStatus: 'PENDING', activeTpVerifiedByUserConfirmed: false },
        { id: 'user-1', companyId: 'company-1' } as any,
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        errorCode: 'ACTIVE_TP_VERIFICATION_REQUIRED',
      }),
    });
    expect(ruleEngine.evaluateQuotation).not.toHaveBeenCalled();
  });

  it('rejects inconsistent TP policy dates', async () => {
    await expect(
      controller.evaluateRules(
        { ...validSaod, activeTpStartDate: '2027-12-31', tpExpiryDate: '2027-01-01' },
        { id: 'user-1', companyId: 'company-1' } as any,
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        errorCode: 'ACTIVE_TP_DATES_INVALID',
      }),
    });
    expect(ruleEngine.evaluateQuotation).not.toHaveBeenCalled();
  });

  it('accepts complete confirmed TP details and returns the rule engine outcome', async () => {
    const result = await controller.evaluateRules(
      validSaod,
      { id: 'user-1', companyId: 'company-1' } as any,
    );

    expect(ruleEngine.evaluateQuotation).toHaveBeenCalledWith(
      expect.objectContaining({
        newPolicyType: 'SAOD',
        vehicleStatus: 'EXISTING',
        tpExpiryDate: new Date('2027-12-31'),
      }),
    );
    expect(result.nextStep).toBe('QUOTATION');
    expect(result.saodTpValid).toBe(true);
  });
});
