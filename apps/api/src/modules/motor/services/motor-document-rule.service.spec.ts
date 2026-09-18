import { Test, TestingModule } from '@nestjs/testing';
import { MotorDocumentRuleService } from './motor-document-rule.service';
import { PrismaService } from '../../../database/prisma.service';

describe('MotorDocumentRuleService', () => {
  let service: MotorDocumentRuleService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      lead: {
        findUnique: jest.fn(),
      },
      document: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MotorDocumentRuleService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<MotorDocumentRuleService>(MotorDocumentRuleService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('computes correct required documents for NEW PRIVATE_CAR PACKAGE', () => {
    const res = service.getRequiredDocuments({
      vehicleCategory: 'PRIVATE_CAR',
      vehicleStatus: 'NEW',
      policyType: 'PACKAGE',
    });

    expect(res.vehicleCategory).toBe('PRIVATE_CAR');
    const docCodes = res.requiredDocuments.map((d) => d.code);
    expect(docCodes).toContain('KYC_PAN');
    expect(docCodes).toContain('KYC_ADDRESS');
    expect(docCodes).toContain('VEH_INVOICE');
    expect(docCodes).toContain('VEH_FORM_21');
    expect(docCodes).not.toContain('VEH_RC_COPY');
    expect(docCodes).not.toContain('COMM_FITNESS_CERT');
  });

  it('computes correct required documents for EXISTING GCV with INSPECTION', () => {
    const res = service.getRequiredDocuments({
      vehicleCategory: 'GCV',
      vehicleStatus: 'EXISTING',
      policyType: 'PACKAGE',
      inspectionRequired: true,
    });

    const docCodes = res.requiredDocuments.map((d) => d.code);
    expect(docCodes).toContain('KYC_PAN');
    expect(docCodes).toContain('VEH_RC_COPY');
    expect(docCodes).toContain('PREV_POLICY_COPY');
    expect(docCodes).toContain('COMM_FITNESS_CERT');
    expect(docCodes).toContain('COMM_PERMIT');
    expect(docCodes).toContain('INSPECTION_REPORT_7_PHOTO');
  });

  it('checks lead document completion correctly when documents are verified', async () => {
    prisma.lead.findUnique.mockResolvedValue({
      id: 'lead-1',
      vehicles: [{ category: 'PRIVATE_CAR', status: 'NEW' }],
      motorQuotations: [{ policyType: 'PACKAGE', status: 'ACCEPTED' }],
    });
    prisma.document.findMany.mockResolvedValue([
      { name: 'KYC_PAN', verificationStatus: 'VERIFIED' },
      { name: 'KYC_ADDRESS', verificationStatus: 'VERIFIED' },
      { name: 'VEH_INVOICE', verificationStatus: 'VERIFIED' },
      { name: 'VEH_FORM_21', verificationStatus: 'VERIFIED' },
    ]);

    const audit = await service.checkLeadDocumentCompletion('lead-1');
    expect(audit.complete).toBe(true);
    expect(audit.completionPercentage).toBe(100);
    expect(audit.missingDocuments.length).toBe(0);
  });

  it('flags incomplete lead when documents are unverified or missing', async () => {
    prisma.lead.findUnique.mockResolvedValue({
      id: 'lead-2',
      vehicles: [{ category: 'PRIVATE_CAR', status: 'NEW' }],
      motorQuotations: [{ policyType: 'PACKAGE', status: 'ACCEPTED' }],
    });
    prisma.document.findMany.mockResolvedValue([
      { name: 'KYC_PAN', verificationStatus: 'VERIFIED' },
      { name: 'KYC_ADDRESS', verificationStatus: 'PENDING' }, // not verified
    ]);

    const audit = await service.checkLeadDocumentCompletion('lead-2');
    expect(audit.complete).toBe(false);
    expect(audit.completionPercentage).toBeLessThan(100);
    expect(audit.missingDocuments.map((d) => d.code)).toContain('KYC_ADDRESS');
    expect(audit.missingDocuments.map((d) => d.code)).toContain('VEH_INVOICE');
    expect(audit.missingDocuments.map((d) => d.code)).toContain('VEH_FORM_21');
  });
});
