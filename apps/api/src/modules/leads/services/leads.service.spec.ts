// @ts-nocheck
import { Test, TestingModule } from '@nestjs/testing';
import { LeadsService } from './leads.service';
import { LeadRepository } from '../repositories/lead.repository';
import { ContactsService } from '../../contacts/services/contacts.service';
import { AccountsService } from '../../accounts/services/accounts.service';
import { UsersService } from '../../users/services/users.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../database/prisma.service';
import { LeadStatus } from '@prisma/client';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { LeadConvertedEvent } from '../events/lead-converted.event';
import { ResourceAuthorizationService } from '../../../common/services/resource-authorization.service';
import { ScopeResolver } from '../../../common/services/scope-resolver.service';

describe('LeadsService', () => {
  let service: LeadsService;
  let leadRepository: jest.Mocked<LeadRepository>;
  let contactsService: jest.Mocked<ContactsService>;
  let accountsService: jest.Mocked<AccountsService>;
  let usersService: jest.Mocked<UsersService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let prismaService: jest.Mocked<PrismaService>;

  const mockLeadRepository = {
    generateLeadCode: jest.fn(),
    create: jest.fn(),
    findAll: jest.fn(),
    count: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    addNote: jest.fn(),
    createActivity: jest.fn(),
  };

  const mockContactsService = {
    findById: jest.fn(),
    create: jest.fn(),
  };

  const mockAccountsService = {
    findById: jest.fn(),
  };

  const mockUsersService = {
    findById: jest.fn(),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  const mockPrismaService = {
    contact: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadsService,
        { provide: LeadRepository, useValue: mockLeadRepository },
        { provide: ContactsService, useValue: mockContactsService },
        { provide: AccountsService, useValue: mockAccountsService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: PrismaService, useValue: mockPrismaService },
        ResourceAuthorizationService,
        ScopeResolver,
      ],
    }).compile();

    service = module.get<LeadsService>(LeadsService);
    leadRepository = module.get(LeadRepository);
    contactsService = module.get(ContactsService);
    accountsService = module.get(AccountsService);
    usersService = module.get(UsersService);
    eventEmitter = module.get(EventEmitter2);
    prismaService = module.get(PrismaService);

    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('SUPER_ADMIN user returns all leads paginated', async () => {
      const superAdminUser = { id: 'user-1', userId: 'user-1', role: 'SUPER_ADMIN', roles: ['SUPER_ADMIN'], status: 'ACTIVE' } as any;
      mockLeadRepository.findAll.mockResolvedValue([]);
      mockLeadRepository.count.mockResolvedValue(0);

      const result = await service.findAll(superAdminUser, { page: 1, limit: 10 });

      expect(mockLeadRepository.findAll).toHaveBeenCalledWith(
        {}, 
        0, 
        10, 
        { createdAt: 'desc' }
      );
      expect(result.data).toEqual([]);
    });

    it('SALES_AGENT user returns only their leads', async () => {
      const agentUser = { id: 'agent-1', userId: 'agent-1', role: 'SALES_AGENT', roles: ['SALES_AGENT'], status: 'ACTIVE' } as any;
      mockLeadRepository.findAll.mockResolvedValue([]);
      mockLeadRepository.count.mockResolvedValue(0);

      await service.findAll(agentUser, { page: 1, limit: 10 });

      expect(mockLeadRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          OR: [{ assignedToId: 'agent-1' }, { createdById: 'agent-1' }]
        }),
        0,
        10,
        { createdAt: 'desc' }
      );
    });
  });

  describe('findById', () => {
    it('SALES_AGENT accessing own lead -> success', async () => {
      const agentUser = { id: 'agent-1', userId: 'agent-1', role: 'SALES_AGENT', roles: ['SALES_AGENT'], status: 'ACTIVE' } as any;
      const mockLead = { id: 'lead-1', assignedToId: 'agent-1' };
      mockLeadRepository.findById.mockResolvedValue(mockLead as any);

      const result = await service.findById('lead-1', agentUser);

      expect(result.id).toBe('lead-1');
    });

    it('SALES_AGENT accessing another agents lead -> throws ForbiddenException', async () => {
      const agentUser = { id: 'agent-1', userId: 'agent-1', role: 'SALES_AGENT', roles: ['SALES_AGENT'], status: 'ACTIVE' } as any;
      const mockLead = { id: 'lead-1', assignedToId: 'agent-2', createdById: 'agent-2' };
      mockLeadRepository.findById.mockResolvedValue(mockLead as any);

      await expect(service.findById('lead-1', agentUser)).rejects.toThrow(ForbiddenException);
    });

    it('non-existent id -> throws NotFoundException', async () => {
      const agentUser = { id: 'agent-1', userId: 'agent-1', role: 'SALES_AGENT', roles: ['SALES_AGENT'], status: 'ACTIVE' } as any;
      mockLeadRepository.findById.mockResolvedValue(null);

      await expect(service.findById('unknown', agentUser)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('valid DTO -> creates lead and returns response', async () => {
      const dto = { title: 'Test Lead', contactId: 'contact-1' } as any;
      mockContactsService.findById.mockResolvedValue({ id: 'contact-1' } as any);
      mockLeadRepository.generateLeadCode.mockResolvedValue('LD-0001');
      mockLeadRepository.create.mockResolvedValue({ id: 'lead-1', title: 'Test Lead' } as any);

      const result = await service.create(dto, 'user-1');

      expect(result.id).toBe('lead-1');
      expect(mockLeadRepository.create).toHaveBeenCalled();
    });
  });

  describe('convert', () => {
    it('valid lead -> updates status to CONVERTED and emits event', async () => {
      const mockLead = { id: 'lead-1', status: LeadStatus.NEW, leadCode: 'LD-0001' };
      mockLeadRepository.findById.mockResolvedValue(mockLead as any);
      mockLeadRepository.update.mockResolvedValue({ ...mockLead, status: LeadStatus.CONVERTED } as any);

      const result = await service.convert('lead-1', 'user-1');

      expect(result.message).toContain('converted successfully');
      expect(mockLeadRepository.update).toHaveBeenCalledWith('lead-1', {
        status: LeadStatus.CONVERTED,
        updatedBy: { connect: { id: 'user-1' } },
      });
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'lead.converted',
        expect.any(LeadConvertedEvent)
      );
    });

    it('already converted lead -> throws BadRequestException', async () => {
      const mockLead = { id: 'lead-1', status: LeadStatus.CONVERTED };
      mockLeadRepository.findById.mockResolvedValue(mockLead as any);

      await expect(service.convert('lead-1', 'user-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('non-existent id -> throws NotFoundException', async () => {
      mockLeadRepository.findById.mockResolvedValue(null);

      await expect(service.remove('unknown', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });
});
