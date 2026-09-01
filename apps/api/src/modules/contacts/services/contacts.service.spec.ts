import { ConflictException, ForbiddenException } from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { ContactsService } from './contacts.service';

const repository = {
  findByPhone: jest.fn(),
  findByEmail: jest.fn(),
  generateContactCode: jest.fn(),
  create: jest.fn(),
  findAll: jest.fn(),
  count: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
};

describe('ContactsService', () => {
  let service: ContactsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ContactsService(repository as any);
  });

  it('creates a new contact instead of silently returning an existing duplicate', async () => {
    repository.findByPhone.mockResolvedValue(null);
    repository.findByEmail.mockResolvedValue(null);
    repository.generateContactCode.mockResolvedValue('CONT-000001');
    repository.create.mockResolvedValue({
      id: 'contact-1',
      contactCode: 'CONT-000001',
      type: 'INDIVIDUAL',
      firstName: 'Test',
      middleName: null,
      lastName: 'User',
      gender: null,
      dateOfBirth: null,
      companyName: null,
      email: 'test@example.com',
      phone: '9999999999',
      alternatePhone: null,
      whatsappNumber: null,
      occupation: null,
      panNumber: null,
      aadhaarNumber: null,
      gstNumber: null,
      createdById: 'user-1',
      updatedById: 'user-1',
      accountId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      service.create(
        {
          type: 'INDIVIDUAL' as any,
          firstName: 'Test',
          lastName: 'User',
          phone: '9999999999',
          email: 'test@example.com',
        },
        'user-1',
      ),
    ).resolves.toBeDefined();

    expect(repository.create).toHaveBeenCalledTimes(1);
  });

  it('rejects duplicate phone numbers with a conflict', async () => {
    repository.findByPhone.mockResolvedValue({ id: 'existing' });

    await expect(
      service.create(
        {
          type: 'INDIVIDUAL' as any,
          firstName: 'Test',
          lastName: 'User',
          phone: '9999999999',
        },
        'user-1',
      ),
    ).rejects.toThrow(ConflictException);

    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rejects duplicate email addresses with a conflict', async () => {
    repository.findByPhone.mockResolvedValue(null);
    repository.findByEmail.mockResolvedValue({ id: 'existing' });

    await expect(
      service.create(
        {
          type: 'INDIVIDUAL' as any,
          firstName: 'Test',
          lastName: 'User',
          phone: '9999999999',
          email: 'test@example.com',
        },
        'user-1',
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('requires branch context for branch-scoped listing', async () => {
    await expect(
      service.findAll({ page: 1, limit: 10 } as any, {
        userId: 'user-1',
        role: RoleType.BRANCH_MANAGER,
        roles: [RoleType.BRANCH_MANAGER],
      } as any),
    ).rejects.toThrow(ForbiddenException);
  });
});
