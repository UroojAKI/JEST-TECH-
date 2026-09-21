import { Test, TestingModule } from '@nestjs/testing';
import { MotorController } from './motor.controller';
import { MotorTariffService } from './services/motor-tariff.service';
import { SaodVerificationService } from './services/saod-verification.service';
import { VehicleDataService } from './services/vehicle-data.service';
import { PreviousPolicyService } from './services/previous-policy.service';
import { MotorDocumentRuleService } from './services/motor-document-rule.service';

describe('MotorController', () => {
  let controller: MotorController;
  let previousPolicyService: any;
  let motorDocumentRuleService: any;

  beforeEach(async () => {
    previousPolicyService = {
      fetchPreviousPolicy: jest.fn().mockResolvedValue({
        status: 'AVAILABLE',
        provenance: 'PREVIOUS_POLICY',
        previousPolicyNumber: 'POL-1234',
        insurerName: 'HDFC ERGO',
        hasClaims: false,
        ncbPercentage: 20,
      }),
    };

    motorDocumentRuleService = {
      getRequiredDocuments: jest.fn().mockReturnValue({
        vehicleCategory: 'PRIVATE_CAR',
        vehicleStatus: 'NEW',
        policyType: 'PACKAGE',
        requiredDocuments: [
          { code: 'KYC_PAN', name: 'PAN Card', isMandatory: true },
        ],
        mandatoryCount: 1,
      }),
      checkLeadDocumentCompletion: jest.fn().mockResolvedValue({
        complete: true,
        completionPercentage: 100,
        missingDocuments: [],
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MotorController],
      providers: [
        { provide: MotorTariffService, useValue: {} },
        { provide: SaodVerificationService, useValue: {} },
        { provide: VehicleDataService, useValue: {} },
        { provide: PreviousPolicyService, useValue: previousPolicyService },
        {
          provide: MotorDocumentRuleService,
          useValue: motorDocumentRuleService,
        },
      ],
    }).compile();

    controller = module.get<MotorController>(MotorController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('calls fetchPreviousPolicy on PreviousPolicyService', async () => {
    const res = await controller.getPreviousPolicy('MH02CB1234');
    expect(previousPolicyService.fetchPreviousPolicy).toHaveBeenCalledWith(
      'MH02CB1234',
    );
    expect(res.status).toBe('AVAILABLE');
    expect(res.insurerName).toBe('HDFC ERGO');
  });

  it('calls getRequiredDocuments with formatted parameters', () => {
    const res = controller.getRequiredDocuments(
      'PRIVATE_CAR',
      'NEW',
      'PACKAGE',
      'false',
      'false',
      'true',
    );
    expect(motorDocumentRuleService.getRequiredDocuments).toHaveBeenCalledWith({
      vehicleCategory: 'PRIVATE_CAR',
      vehicleStatus: 'NEW',
      policyType: 'PACKAGE',
      inspectionRequired: false,
      isHypothecated: false,
      hasPreviousPolicy: true,
    });
    expect(res.mandatoryCount).toBe(1);
  });

  it('calls checkLeadDocumentCompletion for leadId', async () => {
    const res = await controller.checkLeadDocumentCompletion('lead-123');
    expect(
      motorDocumentRuleService.checkLeadDocumentCompletion,
    ).toHaveBeenCalledWith('lead-123');
    expect(res.complete).toBe(true);
  });
});
