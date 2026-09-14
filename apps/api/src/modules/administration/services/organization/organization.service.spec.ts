import { ForbiddenException, NotFoundException } from '@nestjs/common';
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
    role: RoleType.SUPER_ADMIN,
    roles: [RoleType.SUPER_ADMIN],
  };

  const branchManager = {
    userId: 'u-bm',
    role: RoleType.BRANCH_MANAGER,
    roles: [RoleType.BRANCH_MANAGER],
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
      role: RoleType.ADMIN,
      roles: [RoleType.ADMIN],
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
});
