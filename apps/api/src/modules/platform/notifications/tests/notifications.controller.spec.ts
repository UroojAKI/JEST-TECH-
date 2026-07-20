import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from '../controllers/notifications.controller';
import { NotificationService } from '../services/notification.service';
import { RequestUser } from '../../../auth/decorators/current-user.decorator';
import { RoleType } from '@prisma/client';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let service: NotificationService;

  const mockUser: RequestUser = {
    id: 'user-123',
    email: 'agent@jestpolicy.com',
    role: RoleType.SALES_AGENT,
  };

  const mockNotifications = [
    {
      id: 'notif-1',
      title: 'Alert',
      message: 'Expiring policy alert',
      type: 'POLICY_RENEWAL_30',
      priority: 'HIGH',
      isRead: false,
      createdAt: new Date(),
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        {
          provide: NotificationService,
          useValue: {
            getUserNotifications: jest.fn().mockResolvedValue(mockNotifications),
            getUnreadNotifications: jest.fn().mockResolvedValue(mockNotifications),
            getUnreadCount: jest.fn().mockResolvedValue({ count: 1 }),
            markAsRead: jest.fn().mockResolvedValue({ id: 'notif-1', isRead: true }),
            markAllAsRead: jest.fn().mockResolvedValue({ count: 1 }),
            deleteNotification: jest.fn().mockResolvedValue({ id: 'notif-1' }),
            getPreferences: jest.fn().mockResolvedValue({ inApp: true }),
            updatePreferences: jest.fn().mockResolvedValue({ inApp: true }),
          },
        },
      ],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
    service = module.get<NotificationService>(NotificationService);
  });

  describe('Notifications API', () => {
    it('should get user notifications', async () => {
      const result = await controller.getNotifications(mockUser);
      expect(result).toEqual(mockNotifications);
      expect(service.getUserNotifications).toHaveBeenCalledWith(mockUser.id);
    });

    it('should get unread count', async () => {
      const result = await controller.getUnreadCount(mockUser);
      expect(result).toEqual({ count: 1 });
      expect(service.getUnreadCount).toHaveBeenCalledWith(mockUser.id);
    });

    it('should mark notification as read', async () => {
      const result = await controller.markAsRead('notif-1', mockUser);
      expect(result.isRead).toBe(true);
      expect(service.markAsRead).toHaveBeenCalledWith('notif-1', mockUser.id);
    });
  });
});
