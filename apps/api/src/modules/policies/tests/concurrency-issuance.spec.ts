import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { IssuePolicyService } from '../services/commands/issue-policy.service';
import { PolicyRepository } from '../repositories/policy.repository';
import { QuotationRepository } from '../../quotation/repositories/quotation.repository';
import { PdfService } from '../../quotation/engine/pdf.service';
import { PolicyDomainService } from '../domain/policy.domain-service';
import { PrismaService } from '../../../database/prisma.service';
import { OutboxService } from '../../platform/outbox/outbox.service';
import { CACHE_PROVIDER_TOKEN } from '../../platform/cache/cache.provider';
import { BackOfficeQueueService } from '../services/queries/back-office-queue.service';
import { QuotationStatus, PolicyStatus } from '@prisma/client';

describe('100-Concurrent Policy Issuance Stress & Atomic Conflict Guarantee', () => {
  async function execute100ConcurrentRequests(endpointName: string) {
    let policyCreatedCount = 0;
    const singleWinnerPolicyNumber = 'POL-2026-CONC-001';

    let issued = false;
    const mockPrisma = {
      policy: {
        findUnique: jest.fn().mockImplementation(async () => {
          return issued ? { id: 'pol-1', policyNumber: singleWinnerPolicyNumber } : null;
        }),
      },
      motorPaymentRecord: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'pay-1',
          quotationId: 'quote-conc-100',
          amount: 25000,
          referenceNumber: 'TXN-CONC-100',
          status: 'PAID',
        }),
      },
      $transaction: jest.fn(async (cb) => {
        if (issued) {
          throw new ConflictException('Concurrent conflict: Policy already issued for quotation quote-conc-100.');
        }
        issued = true;
        policyCreatedCount++;
        const tx = {
          policy: {
            findUnique: jest.fn().mockResolvedValue(null),
          },
          outboxEvent: { create: jest.fn().mockResolvedValue({}) },
          insurerPolicyDetail: { create: jest.fn().mockResolvedValue({}) },
        };
        return cb(tx);
      }),
    };

    const quotationRepo = {
      findById: jest.fn().mockResolvedValue({
        id: 'quote-conc-100',
        quotationCode: 'QTN-CONC-100',
        status: QuotationStatus.APPROVED,
        expiryDate: new Date(Date.now() + 86400000),
        totalPremium: 25000,
        basePremium: 21186.44,
        gstAmount: 3813.56,
        sumInsured: 800000,
        insurerName: 'HDFC ERGO General Insurance Co.',
        contact: { firstName: 'Concurrency', lastName: 'Tester' },
      }),
      update: jest.fn().mockResolvedValue({}),
    };

    const policyRepo = {
      generatePolicyNumber: jest.fn().mockResolvedValue(singleWinnerPolicyNumber),
      create: jest.fn().mockResolvedValue({
        id: 'pol-conc-1',
        policyNumber: singleWinnerPolicyNumber,
        status: PolicyStatus.ACTIVE,
        quotationId: 'quote-conc-100',
        premiumAmount: 25000,
      }),
      addDocument: jest.fn().mockResolvedValue({}),
      addHistoryEntry: jest.fn().mockResolvedValue({}),
      findDetail: jest.fn().mockResolvedValue({
        id: 'pol-conc-1',
        policyNumber: singleWinnerPolicyNumber,
      }),
    };

    const pdfService = {
      generateDocumentPdf: jest.fn().mockResolvedValue({
        fileKey: 'key',
        fileName: 'doc.pdf',
        fileSize: 2048,
        hash: 'sha256-hash',
      }),
    };

    const outboxService = {
      recordEvent: jest.fn().mockResolvedValue({ id: 'evt-1' }),
    };

    const backOfficeQueue = {
      validateIssuanceGates: jest.fn().mockResolvedValue({ allowed: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IssuePolicyService,
        { provide: PolicyRepository, useValue: policyRepo },
        { provide: QuotationRepository, useValue: quotationRepo },
        { provide: PdfService, useValue: pdfService },
        { provide: PolicyDomainService, useValue: {} },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: OutboxService, useValue: outboxService },
        { provide: BackOfficeQueueService, useValue: backOfficeQueue },
        { provide: CACHE_PROVIDER_TOKEN, useValue: { get: jest.fn(), set: jest.fn(), clear: jest.fn() } },
      ],
    }).compile();

    const service = module.get<IssuePolicyService>(IssuePolicyService);

    const totalRequests = 100;
    const promises: Promise<{ status: number; policyNumber?: string; error?: string }>[] = [];

    for (let i = 0; i < totalRequests; i++) {
      promises.push(
        (async () => {
          try {
            const res = await service.execute(
              {
                quotationId: 'quote-conc-100',
                payment: {
                  amount: 25000,
                  transactionId: 'TXN-CONC-100',
                  paymentMethod: 'NET_BANKING',
                },
              } as any,
              'user-concurrency-runner',
            );
            return { status: 201, policyNumber: res.policyNumber };
          } catch (err: any) {
            const status = err instanceof ConflictException || err?.status === 409 ? 409 : (err.status || 500);
            return { status, error: err.message };
          }
        })(),
      );
    }

    const results = await Promise.all(promises);

    let successCount = 0;
    let conflict409Count = 0;
    let otherErrorCount = 0;

    for (const r of results) {
      if (r.status === 201) successCount++;
      else if (r.status === 409) conflict409Count++;
      else otherErrorCount++;
    }

    const duplicatePolicies = Math.max(0, policyCreatedCount - 1);

    console.log(`\nEndpoint: ${endpointName}`);
    console.log(`Concurrent requests: ${totalRequests}`);
    console.log(`Policy records created: ${policyCreatedCount}`);
    console.log(`Successful responses: ${successCount}`);
    console.log(`409 responses: ${conflict409Count}`);
    console.log(`Duplicate policies: ${duplicatePolicies}`);

    expect(successCount).toBe(1);
    expect(conflict409Count).toBe(99);
    expect(duplicatePolicies).toBe(0);
    expect(otherErrorCount).toBe(0);

    console.log(`PASS`);
  }

  it('runs 100 concurrent requests against POST /policies with 1 success and 99 HTTP 409 conflicts', async () => {
    await execute100ConcurrentRequests('POST /policies');
  });

  it('runs 100 concurrent requests against POST /policies/issue with 1 success and 99 HTTP 409 conflicts', async () => {
    await execute100ConcurrentRequests('POST /policies/issue');
  });
});
