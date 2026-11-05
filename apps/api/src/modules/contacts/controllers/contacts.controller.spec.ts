import { Test, TestingModule } from '@nestjs/testing';
import { ContactsController } from './contacts.controller';
import { ContactsService } from '../services/contacts.service';
import { RoleType } from '@prisma/client';

describe('ContactsController', () => {
  let controller: ContactsController;
  let service: jest.Mocked<Partial<ContactsService>>;

  const mockUser: any = {
    id: 'user-123',
    companyId: 'company-test-1',
    roles: [RoleType.AGENT],
  };

  beforeEach(async () => {
    service = {
      resolveIdentity: jest.fn(),
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContactsController],
      providers: [
        {
          provide: ContactsService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<ContactsController>(ContactsController);
  });

  describe('resolveIdentity', () => {
    it('should delegate to service.resolveIdentity with authenticated companyId', async () => {
      const mockResult: any = {
        status: 'MATCH',
        matchedBy: 'PHONE',
        customer: { id: 'cust-1', customerCode: 'CUST-0001', firstName: 'Rahul' },
        contact: { id: 'cont-1', contactCode: 'CONT-0001', firstName: 'Rahul' },
        vehicles: [
          { id: 'veh-1', vehicleCode: 'VEH-2026-0001', registrationNumber: 'KA03AB1234' },
        ],
      };
      (service.resolveIdentity as jest.Mock).mockResolvedValue(mockResult);

      const result = await controller.resolveIdentity(
        { phone: '9876543210', email: 'rahul@example.com' },
        mockUser,
      );

      expect(service.resolveIdentity).toHaveBeenCalledWith({
        companyId: 'company-test-1',
        phone: '9876543210',
        email: 'rahul@example.com',
        contactId: undefined,
        customerId: undefined,
        firstName: undefined,
        lastName: undefined,
      });
      expect(result).toEqual(mockResult);
      expect(result.vehicles).toHaveLength(1);
    });

    it('should handle mobile field alias in DTO', async () => {
      (service.resolveIdentity as jest.Mock).mockResolvedValue({ status: 'NEW' });

      const result = await controller.resolveIdentity(
        { mobile: '9876543210' },
        mockUser,
      );

      expect(service.resolveIdentity).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: 'company-test-1',
          phone: '9876543210',
        }),
      );
      expect(result.status).toBe('NEW');
    });
  });
});
