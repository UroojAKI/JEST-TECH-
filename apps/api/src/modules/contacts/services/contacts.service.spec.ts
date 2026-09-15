import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { RoleType, ContactStatus } from '@prisma/client';
import { ContactsService } from './contacts.service';
import { ContactMapper } from '../mappers/contact.mapper';

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

const mockPrisma = {
  user: {
    findUnique: jest.fn().mockResolvedValue(null),
    findFirst: jest.fn().mockResolvedValue(null),
  },
  branch: {
    findUnique: jest.fn().mockResolvedValue(null),
  },
  auditLog: {
    create: jest.fn().mockResolvedValue({}),
  },
};

describe('ContactsService', () => {
  let service: ContactsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ContactsService(repository as any, mockPrisma as any);
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
      service.findAll(
        { page: 1, limit: 10 } as any,
        {
          userId: 'user-1',
          role: RoleType.BACK_OFFICE,
          roles: [RoleType.BACK_OFFICE],
        } as any,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  describe('deactivate', () => {
    const actor = {
      userId: 'admin-1',
      organizationId: 'org-1',
      role: RoleType.ADMIN,
      roles: [RoleType.ADMIN],
    };

    it('successfully deactivates an active contact', async () => {
      const existing = {
        id: 'c-1',
        status: ContactStatus.ACTIVE,
        deletedAt: null,
        contactCode: 'CONT-001',
        type: 'INDIVIDUAL',
        firstName: 'John',
        lastName: 'Doe',
        phone: '9876543210',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      repository.findById.mockResolvedValue(existing);
      repository.update.mockResolvedValue({
        ...existing,
        status: ContactStatus.INACTIVE,
      });

      const result = await service.deactivate('c-1', actor as any);

      expect(result.status).toBe(ContactStatus.INACTIVE);
      expect(repository.update).toHaveBeenCalledWith('c-1', {
        status: ContactStatus.INACTIVE,
        updatedBy: { connect: { id: 'admin-1' } },
      });
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            entity: 'Contact',
            entityId: 'c-1',
            oldValue: { status: 'ACTIVE' },
            newValue: { status: 'INACTIVE' },
            userId: 'admin-1',
          }),
        }),
      );
    });

    it('rejects deactivating a non-active contact', async () => {
      repository.findById.mockResolvedValue({
        id: 'c-1',
        status: ContactStatus.INACTIVE,
        deletedAt: null,
      });

      await expect(service.deactivate('c-1', actor as any)).rejects.toThrow(
        ConflictException,
      );
    });

    it('rejects deactivating an archived contact', async () => {
      repository.findById.mockResolvedValue({
        id: 'c-1',
        status: ContactStatus.ARCHIVED,
        deletedAt: null,
      });

      await expect(service.deactivate('c-1', actor as any)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('reactivate', () => {
    const actor = {
      userId: 'admin-1',
      organizationId: 'org-1',
      role: RoleType.ADMIN,
      roles: [RoleType.ADMIN],
    };

    it('successfully reactivates an inactive contact', async () => {
      const existing = {
        id: 'c-1',
        status: ContactStatus.INACTIVE,
        deletedAt: null,
        contactCode: 'CONT-001',
        type: 'INDIVIDUAL',
        firstName: 'John',
        lastName: 'Doe',
        phone: '9876543210',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      repository.findById.mockResolvedValue(existing);
      repository.update.mockResolvedValue({
        ...existing,
        status: ContactStatus.ACTIVE,
      });

      const result = await service.reactivate('c-1', actor as any);

      expect(result.status).toBe(ContactStatus.ACTIVE);
      expect(repository.update).toHaveBeenCalledWith('c-1', {
        status: ContactStatus.ACTIVE,
        updatedBy: { connect: { id: 'admin-1' } },
      });
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            entity: 'Contact',
            entityId: 'c-1',
            oldValue: { status: 'INACTIVE' },
            newValue: { status: 'ACTIVE' },
            userId: 'admin-1',
          }),
        }),
      );
    });

    it('rejects reactivating a non-inactive contact', async () => {
      repository.findById.mockResolvedValue({
        id: 'c-1',
        status: ContactStatus.ACTIVE,
        deletedAt: null,
      });

      await expect(service.reactivate('c-1', actor as any)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('ContactMapper', () => {
    it('maps active contact correctly', () => {
      const mapped = ContactMapper.toResponse({
        id: 'c-1',
        contactCode: 'CONT-001',
        type: 'INDIVIDUAL',
        status: ContactStatus.ACTIVE,
        deletedAt: null,
      });
      expect(mapped.status).toBe('ACTIVE');
    });

    it('maps inactive contact correctly when deactivated without deletion', () => {
      const mapped = ContactMapper.toResponse({
        id: 'c-1',
        contactCode: 'CONT-001',
        type: 'INDIVIDUAL',
        status: ContactStatus.INACTIVE,
        deletedAt: null,
      });
      expect(mapped.status).toBe('INACTIVE');
    });

    it('maps soft-deleted contact to INACTIVE regardless of status field', () => {
      const mapped = ContactMapper.toResponse({
        id: 'c-1',
        contactCode: 'CONT-001',
        type: 'INDIVIDUAL',
        status: ContactStatus.ACTIVE,
        deletedAt: new Date(),
      });
      expect(mapped.status).toBe('INACTIVE');
    });
  });
});
