import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { OrganizationService } from './organization.service';

describe('OrganizationService Multi-Tenant Hardening', () => {
  let service: OrganizationService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      company: {
        findMany: jest.fn().mockResolvedValue([{ id: 'org-mumbai' }]),
      },
      branch: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'br-1', name: 'Andheri' }]),
        count: jest.fn().mockResolvedValue(1),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      zone: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      department: {
        findMany: jest.fn().mockResolvedValue([{ id: 'dept-1' }]),
        count: jest.fn().mockResolvedValue(1),
        findFirst: jest.fn(),
      },
      team: {
        findMany: jest.fn().mockResolvedValue([{ id: 'team-1' }]),
        count: jest.fn().mockResolvedValue(1),
        findFirst: jest.fn(),
      },
    };
    service = new OrganizationService(mockPrisma);
  });

  const superAdmin = {
    userId: 'u-super',
    role: RoleType.ADMIN,
    roles: [RoleType.ADMIN],
  };

  const branchManager = {
    userId: 'u-bm',
    role: RoleType.BACK_OFFICE,
    roles: [RoleType.BACK_OFFICE],
    organizationId: 'org-mumbai',
    branchId: 'br-1',
  };

  it('allows Super Admin to query global hierarchy without org filter', async () => {
    await service.getHierarchy(superAdmin as any);
    expect(mockPrisma.company.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } }),
    );
  });

  it('restricts non-super admin hierarchy queries to their organizationId', async () => {
    await service.getHierarchy(branchManager as any);
    expect(mockPrisma.company.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true, id: 'org-mumbai' },
      }),
    );
  });

  it('fails closed for non-super admin without organizationId in hierarchy', async () => {
    const unorgActor = {
      userId: 'u-no-org',
      role: RoleType.BACK_OFFICE,
      roles: [RoleType.BACK_OFFICE],
    };
    await expect(service.getHierarchy(unorgActor as any)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('restricts branch listing to the actor organization', async () => {
    await service.getBranches({ page: 1, limit: 10 }, branchManager as any);
    expect(mockPrisma.branch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          zone: { region: { companyId: 'org-mumbai' } },
        }),
      }),
    );
  });

  it('rejects access to departments of a branch belonging to another organization', async () => {
    mockPrisma.branch.findFirst.mockResolvedValue(null);
    await expect(
      service.getDepartments(
        { page: 1, limit: 10 },
        'foreign-branch',
        branchManager as any,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  describe('createBranch', () => {
    it('throws BadRequestException if zoneId is missing', async () => {
      await expect(
        service.createBranch(
          {
            name: 'Bangalore East',
            code: 'BLR01',
            city: 'Bangalore',
            state: 'Karnataka',
          },
          branchManager as any,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if specified zone does not exist or belong to organization', async () => {
      mockPrisma.zone.findFirst.mockResolvedValue(null);
      await expect(
        service.createBranch(
          {
            name: 'Bangalore East',
            code: 'BLR01',
            city: 'Bangalore',
            zoneId: 'zone-foreign',
            state: 'Karnataka',
          },
          branchManager as any,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if duplicate branch code exists in organization', async () => {
      mockPrisma.zone.findFirst.mockResolvedValue({
        id: 'zone-1',
        region: { id: 'reg-1', companyId: 'org-mumbai', name: 'Karnataka' },
      });
      mockPrisma.branch.findFirst.mockResolvedValue({ id: 'existing-br' });

      await expect(
        service.createBranch(
          {
            name: 'Bangalore East',
            code: 'BLR01',
            city: 'Bangalore',
            zoneId: 'zone-1',
            state: 'Karnataka',
          },
          branchManager as any,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates branch cleanly with provided state and explicit hierarchy without default Maharashtra', async () => {
      mockPrisma.zone.findFirst.mockResolvedValue({
        id: 'zone-1',
        region: { id: 'reg-1', companyId: 'org-mumbai', name: 'South' },
      });
      mockPrisma.branch.findFirst.mockResolvedValue(null);
      mockPrisma.branch.create.mockResolvedValue({
        id: 'br-new',
        code: 'BLR01',
        name: 'Bangalore East',
        state: 'Karnataka',
        city: 'Bangalore',
      });

      const res = await service.createBranch(
        {
          name: 'Bangalore East',
          code: 'blr01',
          city: 'Bangalore',
          zoneId: 'zone-1',
          state: 'Karnataka',
        },
        branchManager as any,
      );

      expect(res.id).toBe('br-new');
      expect(mockPrisma.branch.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            code: 'BLR01',
            state: 'Karnataka',
            city: 'Bangalore',
            zoneId: 'zone-1',
          }),
        }),
      );
    });
  });
});
