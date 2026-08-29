import { Test, TestingModule } from '@nestjs/testing';
import { LeadsController } from './leads.controller';
import { LeadsService } from '../services/leads.service';
import { LeadAssignmentService } from '../services/lead-assignment.service';
import { PrismaService } from '../../../database/prisma.service';
import { DuplicateDetectionService } from '../deduplication/services/duplicate-detection/duplicate-detection.service';
import { LeadCompletionService } from '../services/lead-completion.service';
import { RequestUser } from '../../auth/decorators/current-user.decorator';
import { RoleType, UserStatus } from '@prisma/client';
import { GetLeadsQueryDto } from '../dto/get-leads-query.dto';

describe('LeadsController', () => {
  let controller: LeadsController;
  let service: jest.Mocked<LeadsService>;

  const mockUser: RequestUser = {
    id: 'user-1',
    userId: 'user-1',
    email: 'test@jest.com',
    role: RoleType.SALES_AGENT,
    firstName: 'Sales',
    lastName: 'Agent',
    organizationId: 'org-1',
    companyId: 'org-1',
    roles: [RoleType.SALES_AGENT],
    permissions: ['LEADS_READ', 'LEADS_WRITE'],
    workspaces: ['SALES'],
    status: UserStatus.ACTIVE,
  };

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      assign: jest.fn(),
      addNote: jest.fn(),
      createActivity: jest.fn(),
      convert: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LeadsController],
      providers: [
        { provide: LeadsService, useValue: service },
        {
          provide: LeadAssignmentService,
          useValue: { assignLead: jest.fn() },
        },
        {
          provide: PrismaService,
          useValue: {
            lead: { count: jest.fn().mockResolvedValue(0) },
            policy: {
              aggregate: jest
                .fn()
                .mockResolvedValue({ _sum: { premiumAmount: 0 } }),
            },
          },
        },
        {
          provide: DuplicateDetectionService,
          useValue: {
            checkDuplicates: jest
              .fn()
              .mockResolvedValue({ isDuplicate: false }),
          },
        },
        {
          provide: LeadCompletionService,
          useValue: { completeLead: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<LeadsController>(LeadsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call service.create with dto and userId', async () => {
      const dto = { title: 'Test Lead', source: 'WEB' as any };
      const expectedResult = { id: 'lead-1', ...dto };
      service.create.mockResolvedValue(expectedResult as any);

      const result = await controller.create(dto, mockUser);

      expect(service.create).toHaveBeenCalledWith(dto, mockUser.id);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('findAll', () => {
    it('should call service.findAll with user and query', async () => {
      const query = new GetLeadsQueryDto();
      const expectedResult = { data: [{ id: 'lead-1' }], total: 1 };
      service.findAll.mockResolvedValue(expectedResult as any);

      const result = await controller.findAll(query, mockUser);

      expect(service.findAll).toHaveBeenCalledWith(mockUser, query);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('findOne', () => {
    it('should call service.findById with id and user', async () => {
      const expectedResult = { id: 'lead-1' };
      service.findById.mockResolvedValue(expectedResult as any);

      const result = await controller.findOne('lead-1', mockUser);

      expect(service.findById).toHaveBeenCalledWith('lead-1', mockUser);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('update', () => {
    it('should call service.update with id, dto, and user', async () => {
      const dto = { title: 'Updated Lead' };
      const expectedResult = { id: 'lead-1', ...dto };
      service.update.mockResolvedValue(expectedResult as any);

      const result = await controller.update('lead-1', dto, mockUser);

      expect(service.update).toHaveBeenCalledWith('lead-1', dto, mockUser);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('remove', () => {
    it('should call service.remove with id and userId', async () => {
      const expectedResult = { success: true };
      service.remove.mockResolvedValue(expectedResult as any);

      const result = await controller.remove('lead-1', mockUser);

      expect(service.remove).toHaveBeenCalledWith('lead-1', mockUser.id);
      expect(result).toEqual(expectedResult);
    });
  });
});
