import { Test, TestingModule } from '@nestjs/testing';
import { RenewalWorker } from './renewal.worker';
import { PrismaService } from '../../../../database/prisma.service';
import { Job } from 'bullmq';

describe('RenewalWorker Spec', () => {
  let worker: RenewalWorker;
  let prisma: PrismaService;

  const mockPrisma = {
    policy: {
      findUnique: jest.fn(),
    },
    notification: {
      create: jest.fn(),
    },
    communicationLog: {
      create: jest.fn(),
    },
    renewalJob: {
      updateMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RenewalWorker,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    worker = module.get<RenewalWorker>(RenewalWorker);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(worker).toBeDefined();
  });

  it('should skip job if policy is not found', async () => {
    mockPrisma.policy.findUnique.mockResolvedValue(null);

    const job = {
      id: 'job-renewal-1',
      data: { policyId: 'non-existent' },
    } as unknown as Job;

    const result = await worker.process(job);
    expect(result).toEqual({ skipped: true, reason: 'POLICY_NOT_FOUND' });
  });

  it('should dispatch alert and mark renewal job completed when policy is valid', async () => {
    const mockPolicy = {
      id: 'pol-100',
      policyNumber: 'POL-2026-000100',
      createdById: 'agent-1',
      contactId: 'contact-1',
      expiryDate: new Date('2026-10-31'),
      contact: { email: 'customer@example.com' },
      quotation: { createdById: 'agent-1' },
    };

    mockPrisma.policy.findUnique.mockResolvedValue(mockPolicy);
    mockPrisma.notification.create.mockResolvedValue({ id: 'notif-1' });
    mockPrisma.communicationLog.create.mockResolvedValue({ id: 'comm-1' });
    mockPrisma.renewalJob.updateMany.mockResolvedValue({ count: 1 });

    const job = {
      id: 'job-renewal-2',
      data: {
        policyId: 'pol-100',
        offsetDays: 30,
        policyNumber: 'POL-2026-000100',
      },
    } as unknown as Job;

    const result = await worker.process(job);

    expect(result.success).toBe(true);
    expect(mockPrisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'agent-1',
          entityId: 'pol-100',
        }),
      }),
    );
    expect(mockPrisma.communicationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          contactId: 'contact-1',
          channel: 'EMAIL',
        }),
      }),
    );
    expect(mockPrisma.renewalJob.updateMany).toHaveBeenCalledWith({
      where: {
        policyId: 'pol-100',
        offsetDays: 30,
        status: { in: ['PENDING', 'PROCESSING'] },
      },
      data: expect.objectContaining({
        status: 'COMPLETED',
        providerJobId: 'job-renewal-2',
      }),
    });
  });
});
