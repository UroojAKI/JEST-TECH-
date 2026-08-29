import { Test, TestingModule } from '@nestjs/testing';
import { RenewalReminderProcessor } from './renewal-reminder.processor';
import { PrismaService } from '../../../database/prisma.service';
import {
  NotificationType,
  NotificationPriority,
  PolicyStatus,
} from '@prisma/client';

describe('RenewalReminderProcessor (Iteration 12)', () => {
  let processor: RenewalReminderProcessor;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      auditLog: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      notification: {
        create: jest.fn(),
      },
      contact: {
        findUnique: jest.fn(),
      },
      communicationLog: {
        create: jest.fn(),
      },
      policy: {
        updateMany: jest.fn(),
      },
      renewalTask: {
        updateMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RenewalReminderProcessor,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    processor = module.get<RenewalReminderProcessor>(RenewalReminderProcessor);
  });

  const mockJob = (daysBefore: number, policyId = 'pol-101') => ({
    name: 'send-renewal-reminder',
    data: {
      policyId,
      policyNumber: 'POL-MTR-2026-001',
      expiryDate: new Date('2026-10-01'),
      customerId: 'cust-1',
      agentId: 'agent-1',
      daysBefore,
    },
  });

  it('should dispatch 45-day reminder, create agent notification and customer communication log', async () => {
    prisma.auditLog.findFirst.mockResolvedValue(null); // No previous reminder within 24h
    prisma.contact.findUnique.mockResolvedValue({
      id: 'cust-1',
      firstName: 'Rajesh',
      lastName: 'Kumar',
    });

    const job = mockJob(45);
    const result = await processor.process(job as any);

    expect(result.success).toBe(true);

    // Agent Notification
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: NotificationType.POLICY_RENEWAL_45,
        priority: NotificationPriority.MEDIUM,
        userId: 'agent-1',
        actionUrl: '/renewals?policyId=pol-101',
      }),
    });

    // Customer Communication Log
    expect(prisma.communicationLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        contactId: 'cust-1',
        channel: 'EMAIL',
        direction: 'OUTBOUND',
        subject: expect.stringContaining('POL-MTR-2026-001'),
      }),
    });
  });

  it('should transition policy status to PENDING_RENEWAL when daysBefore is 30', async () => {
    prisma.auditLog.findFirst.mockResolvedValue(null);
    prisma.contact.findUnique.mockResolvedValue({
      id: 'cust-1',
      firstName: 'Anita',
    });

    const job = mockJob(30);
    await processor.process(job as any);

    expect(prisma.policy.updateMany).toHaveBeenCalledWith({
      where: { id: 'pol-101', status: PolicyStatus.ACTIVE },
      data: { status: PolicyStatus.PENDING_RENEWAL },
    });
  });

  it('should transition policy status to LAPSED when daysBefore is -1 (overdue)', async () => {
    prisma.auditLog.findFirst.mockResolvedValue(null);
    prisma.contact.findUnique.mockResolvedValue({
      id: 'cust-1',
      firstName: 'Vikram',
    });

    const job = mockJob(-1);
    await processor.process(job as any);

    expect(prisma.policy.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'pol-101',
        status: { in: [PolicyStatus.ACTIVE, PolicyStatus.PENDING_RENEWAL] },
      },
      data: { status: PolicyStatus.LAPSED },
    });
  });

  it('should skip duplicate reminder for same policy and offset within 24 hours (Anti-Spam Guard)', async () => {
    // Return an existing audit log with identical offset recorded 2 hours ago
    prisma.auditLog.findFirst.mockResolvedValue({
      id: 'audit-1',
      newValue: { daysBefore: 15 },
    });

    const job = mockJob(15);
    const result = await processor.process(job as any);

    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('DUPLICATE_24H');
    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(prisma.communicationLog.create).not.toHaveBeenCalled();
  });
});
