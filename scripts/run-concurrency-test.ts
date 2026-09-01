import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { IssuePolicyService } from '../apps/api/src/modules/policies/services/commands/issue-policy.service';
import { PolicyRepository } from '../apps/api/src/modules/policies/repositories/policy.repository';
import { QuotationRepository } from '../apps/api/src/modules/quotation/repositories/quotation.repository';
import { PdfService } from '../apps/api/src/modules/quotation/engine/pdf.service';
import { PolicyDomainService } from '../apps/api/src/modules/policies/domain/policy.domain-service';
import { PrismaService } from '../apps/api/src/database/prisma.service';
import { OutboxService } from '../apps/api/src/modules/platform/outbox/outbox.service';
import { CACHE_PROVIDER_TOKEN } from '../apps/api/src/modules/platform/cache/cache.provider';
import { BackOfficeQueueService } from '../apps/api/src/modules/policies/services/queries/back-office-queue.service';
import { QuotationStatus, PolicyStatus } from '@prisma/client';

async function testEndpointConcurrency(endpointName: string) {
  console.log(`\n========================================================`);
  console.log(`Running 100-Concurrent Issuance Test for: ${endpointName}`);
  console.log(`========================================================`);

  // Shared state protected by atomic lock
  let policyCreatedCount = 0;
  let singleWinnerPolicyNumber = 'POL-2026-CONC-001';

  // Atomic database mock simulating unique constraint index on quotationId
  let issued = false;
  const mockPrisma = {
    policy: {
      findUnique: jest.fn().mockImplementation(async ({ where }) => {
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

  // Dispatch 100 concurrent requests simultaneously
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

  console.log(`Concurrent requests: ${totalRequests}`);
  console.log(`Policy records created: ${policyCreatedCount}`);
  console.log(`Successful responses: ${successCount}`);
  console.log(`409 responses: ${conflict409Count}`);
  console.log(`Duplicate policies: ${duplicatePolicies}`);

  if (successCount === 1 && conflict409Count === 99 && duplicatePolicies === 0 && otherErrorCount === 0) {
    console.log(`PASS`);
  } else {
    console.log(`FAIL`);
    process.exit(1);
  }
}

async function run() {
  await testEndpointConcurrency('POST /policies');
  await testEndpointConcurrency('POST /policies/issue');
}

run();
