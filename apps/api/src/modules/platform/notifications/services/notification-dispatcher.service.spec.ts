import { Test, TestingModule } from '@nestjs/testing';
import { NotificationDispatcher } from './notification-dispatcher.service';
import { PrismaService } from '../../../../database/prisma.service';
import { NotificationType } from '@prisma/client';

describe('NotificationDispatcher (NOTIFY-002 Deduplication & Preference Enforcement)', () => {
  let dispatcher: NotificationDispatcher;
  let prisma: PrismaService;

  const mockPrisma = {
    notificationPreference: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    notification: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    notificationHistory: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationDispatcher,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    dispatcher = module.get<NotificationDispatcher>(NotificationDispatcher);
    prisma = module.get<PrismaService>(PrismaService);
  });

  const defaultPreferences = {
    id: 'pref-1',
    userId: 'user-100',
    inApp: true,
    email: true,
    sms: false,
    whatsapp: false,
    leads: true,
    policies: true,
    claims: true,
    renewals: true,
    tasks: true,
  };

  it('delivers notification on first dispatch when no duplicate exists', async () => {
    mockPrisma.notificationPreference.findUnique.mockResolvedValue(defaultPreferences);
    mockPrisma.notification.findFirst.mockResolvedValue(null);
    mockPrisma.notification.create.mockResolvedValue({ id: 'notif-1' });

    await dispatcher.dispatch({
      userId: 'user-100',
      type: NotificationType.POLICY_RENEWAL_30,
      title: 'Policy Expiry Reminder',
      message: 'Your policy expires in 30 days',
      entityId: 'pol-123',
      entityType: 'POLICY',
    });

    expect(mockPrisma.notification.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user-100',
        type: NotificationType.POLICY_RENEWAL_30,
        entityId: 'pol-123',
        createdAt: expect.any(Object),
      },
    });
    expect(mockPrisma.notification.create).toHaveBeenCalledTimes(1);
  });

  it('drops duplicate notification when dispatched within 24 hours for same entity and type', async () => {
    mockPrisma.notificationPreference.findUnique.mockResolvedValue(defaultPreferences);
    // Simulating an existing notification delivered 2 hours ago
    mockPrisma.notification.findFirst.mockResolvedValue({
      id: 'existing-notif-1',
      userId: 'user-100',
      type: NotificationType.POLICY_RENEWAL_30,
      entityId: 'pol-123',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    });

    await dispatcher.dispatch({
      userId: 'user-100',
      type: NotificationType.POLICY_RENEWAL_30,
      title: 'Policy Expiry Reminder (Duplicate)',
      message: 'Your policy expires in 30 days',
      entityId: 'pol-123',
      entityType: 'POLICY',
    });

    expect(mockPrisma.notification.findFirst).toHaveBeenCalledTimes(1);
    expect(mockPrisma.notification.create).not.toHaveBeenCalled();
  });

  it('delivers notification when entityId is different even for the same user and type', async () => {
    mockPrisma.notificationPreference.findUnique.mockResolvedValue(defaultPreferences);
    mockPrisma.notification.findFirst.mockResolvedValue(null);
    mockPrisma.notification.create.mockResolvedValue({ id: 'notif-2' });

    await dispatcher.dispatch({
      userId: 'user-100',
      type: NotificationType.POLICY_RENEWAL_30,
      title: 'Policy Expiry Reminder',
      message: 'Your second policy expires in 30 days',
      entityId: 'pol-456',
      entityType: 'POLICY',
    });

    expect(mockPrisma.notification.create).toHaveBeenCalledTimes(1);
  });

  it('suppresses notification when user preference disables category', async () => {
    mockPrisma.notificationPreference.findUnique.mockResolvedValue({
      ...defaultPreferences,
      renewals: false, // User disabled renewals
    });

    await dispatcher.dispatch({
      userId: 'user-100',
      type: 'POLICY_RENEWAL_ALERT' as any,
      title: 'Renewal Notice',
      message: 'Please renew your policy',
      entityId: 'pol-123',
    });

    expect(mockPrisma.notification.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.notification.create).not.toHaveBeenCalled();
  });
});
