import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PolicyStatus, QuotationStatus, PaymentStatus } from '@prisma/client';
import { IssuePolicyService } from './issue-policy.service';
import { PolicyRepository } from '../../repositories/policy.repository';
import { QuotationRepository } from '../../../quotation/repositories/quotation.repository';
import { PdfService } from '../../../quotation/engine/pdf.service';
import { PolicyDomainService } from '../../domain/policy.domain-service';
import { PrismaService } from '../../../../database/prisma.service';
import { OutboxService } from '../../../platform/outbox/outbox.service';
import { CACHE_PROVIDER_TOKEN } from '../../../platform/cache/cache.provider';

describe('IssuePolicyService', () => {
  let service: IssuePolicyService;
  let quotationRepo: jest.Mocked<any>;
  let policyRepo: jest.Mocked<any>;
  let outboxService: jest.Mocked<any>;

  const mockQuotation = {
    id: 'quote-123',
    status: QuotationStatus.APPROVED,
    totalPremium: 15000,
    contactId: 'contact-123',
    expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
  };

  const mockCreatedPolicy = {
    id: 'pol-123',
    policyNumber: 'POL-2026-000001',
    status: PolicyStatus.ACTIVE,
    contactId: 'contact-123',
    effectiveDate: new Date(),
    expiryDate: mockQuotation.expiryDate,
    premiumAmount: 15000,
  };

  beforeEach(async () => {
    quotationRepo = {
      findById: jest.fn().mockResolvedValue(mockQuotation),
      update: jest.fn().mockResolvedValue({}),
    };

    policyRepo = {
      generatePolicyNumber: jest.fn().mockResolvedValue('POL-2026-000001'),
      create: jest.fn().mockResolvedValue(mockCreatedPolicy),
      addDocument: jest.fn().mockResolvedValue({}),
      addHistoryEntry: jest.fn().mockResolvedValue({}),
      findDetail: jest.fn().mockResolvedValue(mockCreatedPolicy),
    };

    outboxService = {
      recordEvent: jest.fn().mockResolvedValue({ id: 'evt-1' }),
    };

    const mockPrisma = {
      motorPaymentRecord: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'pay-1',
          quotationId: 'quote-123',
          amount: 15000,
          referenceNumber: 'TXN-1',
          status: 'PAID',
        }),
      },
      $transaction: jest.fn(async (cb) => {
        const tx = {
          outboxEvent: { create: jest.fn() },
          insurerPolicyDetail: { create: jest.fn() },
        };
        return cb(tx);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IssuePolicyService,
        { provide: PolicyRepository, useValue: policyRepo },
        { provide: QuotationRepository, useValue: quotationRepo },
        {
          provide: PdfService,
          useValue: {
            generatePdfStub: jest.fn().mockReturnValue({
              fileKey: 'key',
              fileName: 'doc.pdf',
              fileSize: 1024,
            }),
          },
        },
        { provide: PolicyDomainService, useValue: {} },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: OutboxService, useValue: outboxService },
        {
          provide: CACHE_PROVIDER_TOKEN,
          useValue: { get: jest.fn(), set: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<IssuePolicyService>(IssuePolicyService);
  });

  it('should throw BadRequestException if quotationId is missing', async () => {
    await expect(service.execute({} as any, 'user-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should throw NotFoundException if quotation is not found', async () => {
    quotationRepo.findById.mockResolvedValueOnce(null);
    await expect(
      service.execute({ quotationId: 'quote-404' } as any, 'user-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw BadRequestException if quotation is in DRAFT status', async () => {
    quotationRepo.findById.mockResolvedValueOnce({
      ...mockQuotation,
      status: QuotationStatus.DRAFT,
    });
    await expect(
      service.execute({ quotationId: 'quote-123' } as any, 'user-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException on payment mismatch', async () => {
    (service as any).prisma.motorPaymentRecord.findUnique.mockResolvedValueOnce(
      {
        id: 'pay-1',
        quotationId: 'quote-123',
        amount: 10000,
        referenceNumber: 'TXN-1',
        status: 'PAID',
      },
    );
    await expect(
      service.execute(
        {
          quotationId: 'quote-123',
          payment: {
            amount: 10000,
            transactionId: 'TXN-1',
            paymentMethod: 'UPI',
          },
        } as any,
        'user-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should issue policy, create outbox event, and return mapped policy response', async () => {
    const result = await service.execute(
      {
        quotationId: 'quote-123',
        payment: {
          amount: 15000,
          transactionId: 'TXN-1',
          paymentMethod: 'UPI',
        },
        insurerPolicyNumber: 'INS-POL-999',
        insurerQuoteId: 'INS-Q-888',
      },
      'user-1',
    );

    expect(policyRepo.generatePolicyNumber).toHaveBeenCalled();
    expect(policyRepo.create).toHaveBeenCalled();
    expect(quotationRepo.update).toHaveBeenCalledWith(
      'quote-123',
      { status: QuotationStatus.CONVERTED_TO_POLICY },
      expect.anything(),
    );
    expect(outboxService.recordEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        aggregateType: 'POLICY',
        eventType: 'POLICY_ISSUED',
      }),
    );
    expect(result).toBeDefined();
    expect(result.policyNumber).toBe('POL-2026-000001');
  });
});
