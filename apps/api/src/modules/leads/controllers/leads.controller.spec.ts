import { Test, TestingModule } from '@nestjs/testing';
import { LeadsController } from './leads.controller';
import { LeadsService } from '../services/leads.service';
import { RequestUser } from '../../auth/decorators/current-user.decorator';

describe('LeadsController', () => {
  let controller: LeadsController;
  let service: jest.Mocked<LeadsService>;

  const mockUser: RequestUser = {
    id: 'user-1',
    email: 'test@jest.com',
    role: { code: 'SALES_AGENT', id: 'role-1', name: 'Sales Agent' },
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
    it('should call service.findAll with user', async () => {
      const expectedResult = [{ id: 'lead-1' }];
      service.findAll.mockResolvedValue(expectedResult as any);

      const result = await controller.findAll(mockUser);
      
      expect(service.findAll).toHaveBeenCalledWith(mockUser);
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
