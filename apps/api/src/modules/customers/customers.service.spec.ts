import { Test, TestingModule } from '@nestjs/testing';
import { CustomersService } from './customers.service';
import { PrismaService } from '../../database/prisma.service';
import { CrmIdentityService } from '../crm-identity/services/crm-identity.service';
import { AgentIdentityResolverService } from '../agents/agent-identity-resolver.service';
import { RoleType } from '@prisma/client';
import { NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';

describe('CustomersService', () => {
  let service: CustomersService;
  let prisma: any;
  let crmIdentityService: any;
  let agentIdentityResolver: any;

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
    contactId: 'contact-uuid-1',
    primaryAgentId: null,
    primaryAgentExternalCodeId: null,
    version: 1,
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
      $transaction: jest.fn((cb) => cb(prisma)),
      customer: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      agent: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      customerAlert: {
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      customerAgentHistory: {
        create: jest.fn(),
        updateMany: jest.fn(),
      },
      agentAssignmentHistory: {
        create: jest.fn().mockResolvedValue({ id: 'assignment-1' }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
      contact: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({ id: 'contact-uuid-1' }),
      },
    };

    crmIdentityService = {
      resolveIdentity: jest.fn(),
      ensureLinkedContactAndCustomer: jest.fn().mockResolvedValue({
        contact: { id: 'contact-uuid-1' },
        customer: mockCustomer,
      }),
      normalizePhone: jest.fn((phone) => {
        if (!phone) return null;
        const digits = phone.replace(/\D/g, '');
        return digits.length >= 10 ? digits.slice(-10) : null;
      }),
      getPhoneVariants: jest.fn((norm) => [norm, `+91${norm}`, `0${norm}`]),
    };

    agentIdentityResolver = {
      validateAgentOwnership: jest.fn().mockResolvedValue({ id: 'agent-1', agentCode: 'AGT-000001' }),
      resolveExternalCodeForAssignment: jest.fn().mockResolvedValue({
        agentId: 'agent-1',
        agentCode: 'AGT-000001',
        userId: 'agent-user-1',
        externalCodeId: 'external-code-1',
        originalIdentifier: 'IGSK001',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomersService,
        { provide: PrismaService, useValue: prisma },
        { provide: CrmIdentityService, useValue: crmIdentityService },
        { provide: AgentIdentityResolverService, useValue: agentIdentityResolver },
      ],
    }).compile();

    service = module.get<CustomersService>(CustomersService);
  });

  describe('checkDuplicate', () => {
    const actor = { id: 'user-uuid-1', role: RoleType.AGENT, companyId: 'org-1' } as any;

    it('should throw ForbiddenException when company context is missing', async () => {
      await expect(
        service.checkDuplicate({ mobile: '9999999999' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return hasDuplicate false when no match exists', async () => {
      prisma.customer.findMany.mockResolvedValue([]);

      const result = await service.checkDuplicate({ mobile: '9999999999' }, actor);
      expect(result.hasDuplicate).toBe(false);
      expect(result.matchCount).toBe(0);
      expect(result.matches).toEqual([]);
    });

    it('should return soft duplicate signals without throwing 409', async () => {
      prisma.customer.findMany.mockResolvedValue([mockCustomer]);

      const result = await service.checkDuplicate({ mobile: '9876543210' }, actor);
      expect(result.hasDuplicate).toBe(true);
      expect(result.matchCount).toBe(1);
      expect(result.matches[0].customerCode).toBe('CUST-000001');
    });
  });

  describe('create', () => {
    it('should throw ConflictException when duplicate customer mobile or email exists', async () => {
      prisma.customer.findMany.mockResolvedValue([mockCustomer]);

      await expect(
        service.create(
          { firstName: 'Amit', mobile: '9876543210', addressLine1: '123 MG Road', pincode: '400001' },
          { id: 'user-uuid-1', role: RoleType.AGENT, companyId: 'org-1' } as any,
        ),
      ).rejects.toThrow(ConflictException);

      expect(prisma.customer.create).not.toHaveBeenCalled();
    });

    it('should create customer cleanly when no duplicate found', async () => {
      prisma.customer.findMany.mockResolvedValue([]);

      const result = await service.create(
        { firstName: 'Amit', mobile: '9876543210', addressLine1: '123 MG Road', pincode: '400001' },
        { id: 'user-uuid-1', role: RoleType.BACK_OFFICE, companyId: 'org-1' } as any,
      );

      expect(result.duplicateWarning).toBe(false);
      expect(crmIdentityService.ensureLinkedContactAndCustomer).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          companyId: 'org-1',
          firstName: 'Amit',
          phone: '9876543210',
          createCustomerIfMissing: true,
        }),
      );
    });

    it('stores canonical Agent and external-code attribution on customer creation', async () => {
      prisma.customer.findMany.mockResolvedValue([]);
      crmIdentityService.ensureLinkedContactAndCustomer.mockResolvedValue({
        contact: { id: 'contact-uuid-1' },
        customer: { ...mockCustomer, primaryAgentId: null, primaryAgentExternalCodeId: null },
      });
      prisma.contact.findFirst.mockResolvedValue({
        id: 'contact-uuid-1',
        assignedAgentId: null,
        assignedExternalCodeId: null,
      });
      prisma.customer.update.mockResolvedValue({
        ...mockCustomer,
        primaryAgentId: 'agent-1',
        primaryAgentExternalCodeId: 'external-code-1',
      });

      await service.create(
        {
          firstName: 'Amit',
          mobile: '9876543210',
          externalAgentCode: 'IGSK001',
          agentCodeSystem: 'CLIENT_A',
          addressLine1: '123 MG Road',
          pincode: '400001',
        } as any,
        { id: 'user-uuid-1', role: RoleType.BACK_OFFICE, companyId: 'org-1' } as any,
        'correlation-1',
      );

      expect(agentIdentityResolver.resolveExternalCodeForAssignment).toHaveBeenCalledWith(
        'IGSK001',
        'CLIENT_A',
        expect.objectContaining({ id: 'user-uuid-1' }),
      );
      expect(crmIdentityService.ensureLinkedContactAndCustomer).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          primaryAgentId: 'agent-1',
          primaryAgentExternalCodeId: 'external-code-1',
        }),
      );
      expect(prisma.agentAssignmentHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            entityType: 'CUSTOMER',
            newAgentId: 'agent-1',
            newExternalCodeId: 'external-code-1',
            correlationId: 'correlation-1',
          }),
        }),
      );
    });
  });

  describe('assignAgent', () => {
    it('preserves customer and contact assignment lineage when reassigned by external code', async () => {
      agentIdentityResolver.resolveExternalCodeForAssignment.mockResolvedValue({
        agentId: 'agent-next',
        externalCodeId: 'external-code-next',
      });
      prisma.agent.findFirst.mockResolvedValue({ id: 'agent-next' });
      prisma.customer.findFirst.mockResolvedValue({
        id: 'customer-uuid-1',
        companyId: 'org-1',
        contactId: 'contact-uuid-1',
        primaryAgentId: 'agent-prev',
        primaryAgentExternalCodeId: 'external-code-prev',
        version: 3,
      });
      prisma.customer.updateMany.mockResolvedValue({ count: 1 });
      prisma.contact.findFirst.mockResolvedValue({
        id: 'contact-uuid-1',
        assignedAgentId: 'agent-prev',
        assignedExternalCodeId: 'external-code-prev',
      });
      prisma.contact.update.mockResolvedValue({});
      prisma.customer.findUnique.mockResolvedValue({
        ...mockCustomer,
        primaryAgentId: 'agent-next',
        primaryAgentExternalCodeId: 'external-code-next',
      });

      await service.assignAgent(
        'customer-uuid-1',
        {
          externalAgentCode: 'IGSK002',
          agentCodeSystem: 'CLIENT_A',
          reason: 'Approved transfer',
          expectedVersion: 3,
        } as any,
        { id: 'ops-user', userId: 'ops-user', role: RoleType.BACK_OFFICE, companyId: 'org-1' } as any,
        'correlation-2',
      );

      expect(prisma.contact.update).toHaveBeenCalledWith({
        where: { id: 'contact-uuid-1' },
        data: {
          assignedAgentId: 'agent-next',
          assignedExternalCodeId: 'external-code-next',
        },
      });
      expect(prisma.agentAssignmentHistory.create).toHaveBeenCalledTimes(2);
      expect(prisma.agentAssignmentHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            entityType: 'CUSTOMER',
            previousAgentId: 'agent-prev',
            newAgentId: 'agent-next',
            previousExternalCodeId: 'external-code-prev',
            newExternalCodeId: 'external-code-next',
            changedById: 'ops-user',
            correlationId: 'correlation-2',
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
