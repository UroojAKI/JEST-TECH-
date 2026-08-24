import { BadRequestException } from '@nestjs/common';
import { MotorPaymentTrackingService } from './motor-payment-tracking.service';

describe('MotorPaymentTrackingService', () => {
  const prisma = {
    quotation: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    motorPaymentRecord: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    motorInspection: {
      findUnique: jest.fn(),
    },
    motorRuleEvaluation: {
      findUnique: jest.fn(),
    },
  } as any;

  let service: MotorPaymentTrackingService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MotorPaymentTrackingService(prisma);
  });

  it('rejects PAID without amount', async () => {
    prisma.quotation.findUnique.mockResolvedValue({ id: 'q1' });
    prisma.motorPaymentRecord.findUnique.mockResolvedValue(null);

    await expect(service.recordPayment({
      quotationId: 'q1',
      status: 'PAID',
      referenceNumber: 'UTR-1',
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects backwards payment transitions', async () => {
    prisma.quotation.findUnique.mockResolvedValue({ id: 'q1' });
    prisma.motorPaymentRecord.findUnique.mockResolvedValue({ status: 'PAID' });

    await expect(service.recordPayment({
      quotationId: 'q1',
      status: 'UNDER_PROCESS',
      quotationId: 'q1',
    } as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks issuance when inspection is required but incomplete', async () => {
    prisma.quotation.findUnique.mockResolvedValue({
      id: 'q1',
      calculationSnapshot: { outputs: { totalPremium: 1000 } },
      issuanceStatus: 'ISSUANCE_PENDING',
      workflowState: 'PAYMENT_DONE',
      motorMetadata: { vehicleDetails: { vehicleStatus: 'EXISTING' } },
    });
    prisma.motorInspection.findUnique.mockResolvedValue({ status: 'IN_PROGRESS' });
    prisma.motorPaymentRecord.findUnique.mockResolvedValue({ status: 'PAID' });
    prisma.motorRuleEvaluation.findUnique.mockResolvedValue({ inspectionRequired: true });

    await expect(service.canProceedToPolicy('q1')).resolves.toEqual({
      allowed: false,
      blockers: ['INSPECTION_IN_PROGRESS'],
    });
  });
});
