import { Test, TestingModule } from '@nestjs/testing';
import { NotificationWorker } from './notification.worker';
import { PrismaService } from '../../../../database/prisma.service';
import { Job } from 'bullmq';

describe('NotificationWorker', () => {
  let worker: NotificationWorker;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationWorker,
        {
          provide: PrismaService,
          useValue: {
            notification: {
              create: jest.fn(),
            },
            notificationHistory: {
              create: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    worker = module.get<NotificationWorker>(NotificationWorker);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(worker).toBeDefined();
  });

  it('should record delivery status when notificationId is provided', async () => {
    const job = {
      id: 'job-1',
      data: {
        notificationId: 'notif-123',
        channel: 'EMAIL',
      },
    } as unknown as Job;

    (prisma.notificationHistory.create as jest.Mock).mockResolvedValue({
      id: 'hist-1',
    });

    await worker.process(job);

    expect(prisma.notificationHistory.create).toHaveBeenCalledWith({
      data: {
        notificationId: 'notif-123',
        channel: 'EMAIL',
        status: 'SENT',
      },
    });
  });

  it('should create notification and record history for direct payload', async () => {
    const job = {
      id: 'job-2',
      data: {
        userId: 'user-456',
        title: 'Test Alert',
        message: 'Your policy is issued',
      },
    } as unknown as Job;

    (prisma.notification.create as jest.Mock).mockResolvedValue({
      id: 'notif-999',
    });
    (prisma.notificationHistory.create as jest.Mock).mockResolvedValue({
      id: 'hist-2',
    });

    await worker.process(job);

    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-456',
          title: 'Test Alert',
        }),
      }),
    );
    expect(prisma.notificationHistory.create).toHaveBeenCalledWith({
      data: {
        notificationId: 'notif-999',
        channel: 'IN_APP',
        status: 'SENT',
      },
    });
  });
});
