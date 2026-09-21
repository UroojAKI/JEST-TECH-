import { Test, TestingModule } from '@nestjs/testing';
import { CustomersService } from './customers.service';
import { PrismaService } from '../../database/prisma.service';
import { RoleType } from '@prisma/client';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

describe('CustomersService', () => {
  let service: CustomersService;
  let prisma: any;

  const mockCustomer = {
    id: 'customer-uuid-1',
    customerCode: 'CUST-000001',
    firstName: 'Amit',
    lastName: 'Verma',
    mobile: '9876543210',
    email: 'amit@example.com',
    city: 'Mumbai',
    state: 'Maharashtra',
    isVip: false,
    companyId: 'org-1',
    createdById: 'user-uuid-1',
    createdAt: new Date(),
    _count: {
      leads: 2,
      policies: 1,
      vehicles: 1,
      quotations: 2,
      claims: 0,
      tasks: 1,
      alerts: 0,
    },
    leads: [],
    vehicles: [],
    quotations: [],
    policies: [],
    claims: [],
    tasks: [],
    alerts: [],
  };

  beforeEach(async () => {
    prisma = {
      customer: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      agent: {
        findUnique: jest.fn(),
      },
      customerAlert: {
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<CustomersService>(CustomersService);
  });

  describe('checkDuplicate', () => {
    it('should return hasDuplicate false when no match exists', async () => {
      prisma.customer.findMany.mockResolvedValue([]);

      const result = await service.checkDuplicate({ mobile: '9999999999' });
      expect(result.hasDuplicate).toBe(false);
      expect(result.matchCount).toBe(0);
      expect(result.matches).toEqual([]);
    });

    it('should return soft duplicate signals without throwing 409', async () => {
      prisma.customer.findMany.mockResolvedValue([mockCustomer]);

      const result = await service.checkDuplicate({ mobile: '9876543210' });
      expect(result.hasDuplicate).toBe(true);
      expect(result.matchCount).toBe(1);
      expect(result.matches[0].customerCode).toBe('CUST-000001');
    });
  });

  describe('create', () => {
    it('should return warning payload when duplicate exists and acknowledgeDuplicate is false', async () => {
      prisma.customer.findMany.mockResolvedValue([mockCustomer]);

      const result = await service.create(
        { firstName: 'Amit', mobile: '9876543210' },
        { id: 'user-uuid-1', role: RoleType.AGENT, companyId: 'org-1' } as any,
      );

      expect(result.duplicateWarning).toBe(true);
      expect(result.matches?.length).toBe(1);
      expect(prisma.customer.create).not.toHaveBeenCalled();
    });

    it('should create customer when acknowledgeDuplicate is true', async () => {
      prisma.customer.findMany.mockResolvedValue([mockCustomer]);
      prisma.customer.count.mockResolvedValue(1);
      prisma.customer.findUnique.mockResolvedValue(null);
      prisma.customer.create.mockResolvedValue(mockCustomer);

      const result = await service.create(
        { firstName: 'Amit', mobile: '9876543210', acknowledgeDuplicate: true },
        { id: 'user-uuid-1', role: RoleType.AGENT, companyId: 'org-1' } as any,
      );

      expect(result.duplicateWarning).toBe(false);
      expect(result.customer).toEqual(mockCustomer);
      expect(prisma.customer.create).toHaveBeenCalled();
    });

    it('should create customer cleanly when no duplicate found', async () => {
      prisma.customer.findMany.mockResolvedValue([]);
      prisma.customer.count.mockResolvedValue(0);
      prisma.customer.findUnique.mockResolvedValue(null);
      prisma.customer.create.mockResolvedValue(mockCustomer);

      const result = await service.create(
        { firstName: 'Amit', mobile: '9876543210' },
        { id: 'user-uuid-1', role: RoleType.AGENT, companyId: 'org-1' } as any,
      );

      expect(result.duplicateWarning).toBe(false);
      expect(prisma.customer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            customerCode: 'CUST-000001',
            firstName: 'Amit',
            mobile: '9876543210',
          }),
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated list of customers for admin', async () => {
      prisma.customer.findMany.mockResolvedValue([mockCustomer]);
      prisma.customer.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 }, {
        id: 'admin-1',
        role: RoleType.ADMIN,
      } as any);
      expect(result.data.length).toBe(1);
      expect(result.meta.total).toBe(1);
    });

    it('should filter by agent ownership when caller is an AGENT', async () => {
      prisma.agent.findUnique.mockResolvedValue({ id: 'agent-1' });
      prisma.customer.findMany.mockResolvedValue([mockCustomer]);
      prisma.customer.count.mockResolvedValue(1);

      await service.findAll({}, {
        id: 'agent-user-1',
        role: RoleType.AGENT,
      } as any);
      expect(prisma.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { createdById: 'agent-user-1' },
              { leads: { some: { agentId: 'agent-1' } } },
            ]),
          }),
        }),
      );
    });
  });

  describe('findById', () => {
    it('should return customer with full relations if found and authorized', async () => {
      prisma.customer.findFirst.mockResolvedValue(mockCustomer);

      const result = await service.findById('customer-uuid-1', {
        id: 'admin-1',
        role: RoleType.ADMIN,
      } as any);
      expect(result.customerCode).toBe('CUST-000001');
    });

    it('should throw NotFoundException if customer not found', async () => {
      prisma.customer.findFirst.mockResolvedValue(null);

      await expect(
        service.findById('non-existent', {
          id: 'admin-1',
          role: RoleType.ADMIN,
        } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('alerts', () => {
    it('should create and retrieve customer alerts', async () => {
      prisma.customer.findFirst.mockResolvedValue(mockCustomer);
      prisma.customerAlert.create.mockResolvedValue({
        id: 'alert-1',
        customerId: 'customer-uuid-1',
        alertType: 'RENEWAL_DUE',
        message: 'Policy expires in 15 days',
        isRead: false,
      });

      const alert = await service.createAlert(
        'customer-uuid-1',
        { alertType: 'RENEWAL_DUE', message: 'Policy expires in 15 days' },
        { id: 'admin-1', role: RoleType.ADMIN } as any,
      );

      expect(alert.alertType).toBe('RENEWAL_DUE');
      expect(prisma.customerAlert.create).toHaveBeenCalled();
    });
  });
});
