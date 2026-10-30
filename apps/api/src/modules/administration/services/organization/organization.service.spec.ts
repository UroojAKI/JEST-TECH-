import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { RoleType, UserStatus } from '@prisma/client';
import { OrganizationService } from './organization.service';

describe('OrganizationService Multi-Tenant Hardening & Hierarchy Enforcement', () => {
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
        findUnique: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
      $transaction: jest.fn(async (cb) => cb(mockPrisma)),
    };
    service = new OrganizationService(mockPrisma);
  });

  const superAdmin = {
    userId: 'u-super',
    role: RoleType.ADMIN,
    roles: [RoleType.ADMIN],
    isPlatformAdmin: true,
    permissions: ['*'],
  };

  const tenantAdmin = {
    userId: 'u-admin',
    role: RoleType.ADMIN,
    roles: [RoleType.ADMIN],
    organizationId: 'org-mumbai',
    companyId: 'org-mumbai',
  };

  const branchManager = {
    userId: 'u-bm',
    role: RoleType.BACK_OFFICE,
    roles: [RoleType.BACK_OFFICE],
    organizationId: 'org-mumbai',
    companyId: 'org-mumbai',
    branchId: 'br-1',
  };

  const agentActor = {
    userId: 'u-agent',
    role: RoleType.AGENT,
    roles: [RoleType.AGENT],
    organizationId: 'org-mumbai',
  };

  describe('getHierarchy — RBAC Scoping', () => {
    it('allows Platform Super Admin to query global hierarchy without org filter', async () => {
      await service.getHierarchy(superAdmin as any);
      expect(mockPrisma.company.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } }),
      );
    });

    it('restricts Tenant Admin to their companyId', async () => {
      await service.getHierarchy(tenantAdmin as any);
      expect(mockPrisma.company.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true, id: 'org-mumbai' },
        }),
      );
    });

    it('restricts Back Office to their organizationId', async () => {
      await service.getHierarchy(branchManager as any);
      expect(mockPrisma.company.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true, id: 'org-mumbai' },
        }),
      );
    });

    it('denies Agent from accessing administrative hierarchy', async () => {
      await expect(service.getHierarchy(agentActor as any)).rejects.toThrow(
        ForbiddenException,
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
  });

  describe('Branch & Department Scoping', () => {
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

  describe('createBranch — Explicit Location Enforcement', () => {
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

    it('throws BadRequestException if state is missing', async () => {
      await expect(
        service.createBranch(
          {
            name: 'Bangalore East',
            code: 'BLR01',
            city: 'Bangalore',
            zoneId: 'zone-1',
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

  describe('assignUserToTeam — Multi-level Hierarchy Verification & Atomic Assignment', () => {
    const validUser = {
      id: 'usr-1',
      status: UserStatus.ACTIVE,
      companyId: 'org-mumbai',
      branchId: 'br-old',
      departmentId: 'dept-old',
      teamId: 'team-old',
    };

    const validTeamHierarchy = {
      id: 'team-new',
      isActive: true,
      departmentId: 'dept-new',
      department: {
        id: 'dept-new',
        isActive: true,
        branchId: 'br-new',
        branch: {
          id: 'br-new',
          isActive: true,
          zoneId: 'zone-new',
          zone: {
            id: 'zone-new',
            isActive: true,
            regionId: 'reg-new',
            region: {
              id: 'reg-new',
              isActive: true,
              companyId: 'org-mumbai',
              company: {
                id: 'org-mumbai',
                isActive: true,
              },
            },
          },
        },
      },
    };

    it('throws NotFoundException if target employee is not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.assignUserToTeam('usr-missing', 'team-new', tenantAdmin as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if target employee is inactive', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...validUser,
        status: UserStatus.INACTIVE,
      });

      await expect(
        service.assignUserToTeam('usr-1', 'team-new', tenantAdmin as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException if employee belongs to a different company than actor', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...validUser,
        companyId: 'org-delhi',
      });

      await expect(
        service.assignUserToTeam('usr-1', 'team-new', tenantAdmin as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException if target team is not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(validUser);
      mockPrisma.team.findUnique.mockResolvedValue(null);

      await expect(
        service.assignUserToTeam('usr-1', 'team-missing', tenantAdmin as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if target team is inactive', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(validUser);
      mockPrisma.team.findUnique.mockResolvedValue({
        ...validTeamHierarchy,
        isActive: false,
      });

      await expect(
        service.assignUserToTeam('usr-1', 'team-new', tenantAdmin as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if target department is inactive', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(validUser);
      mockPrisma.team.findUnique.mockResolvedValue({
        ...validTeamHierarchy,
        department: {
          ...validTeamHierarchy.department,
          isActive: false,
        },
      });

      await expect(
        service.assignUserToTeam('usr-1', 'team-new', tenantAdmin as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if target branch is inactive', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(validUser);
      mockPrisma.team.findUnique.mockResolvedValue({
        ...validTeamHierarchy,
        department: {
          ...validTeamHierarchy.department,
          branch: {
            ...validTeamHierarchy.department.branch,
            isActive: false,
          },
        },
      });

      await expect(
        service.assignUserToTeam('usr-1', 'team-new', tenantAdmin as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if target zone is inactive', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(validUser);
      mockPrisma.team.findUnique.mockResolvedValue({
        ...validTeamHierarchy,
        department: {
          ...validTeamHierarchy.department,
          branch: {
            ...validTeamHierarchy.department.branch,
            zone: {
              ...validTeamHierarchy.department.branch.zone,
              isActive: false,
            },
          },
        },
      });

      await expect(
        service.assignUserToTeam('usr-1', 'team-new', tenantAdmin as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if target region is inactive', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(validUser);
      mockPrisma.team.findUnique.mockResolvedValue({
        ...validTeamHierarchy,
        department: {
          ...validTeamHierarchy.department,
          branch: {
            ...validTeamHierarchy.department.branch,
            zone: {
              ...validTeamHierarchy.department.branch.zone,
              region: {
                ...validTeamHierarchy.department.branch.zone.region,
                isActive: false,
              },
            },
          },
        },
      });

      await expect(
        service.assignUserToTeam('usr-1', 'team-new', tenantAdmin as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException if target team belongs to a different company than employee', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(validUser);
      mockPrisma.team.findUnique.mockResolvedValue({
        ...validTeamHierarchy,
        department: {
          ...validTeamHierarchy.department,
          branch: {
            ...validTeamHierarchy.department.branch,
            zone: {
              ...validTeamHierarchy.department.branch.zone,
              region: {
                ...validTeamHierarchy.department.branch.zone.region,
                companyId: 'org-other',
              },
            },
          },
        },
      });

      await expect(
        service.assignUserToTeam('usr-1', 'team-new', tenantAdmin as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('successfully syncs team, department, and branch atomically and logs audit record', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(validUser);
      mockPrisma.team.findUnique.mockResolvedValue(validTeamHierarchy);
      mockPrisma.user.update.mockResolvedValue({
        ...validUser,
        teamId: 'team-new',
        departmentId: 'dept-new',
        branchId: 'br-new',
      });

      const updated = await service.assignUserToTeam(
        'usr-1',
        'team-new',
        tenantAdmin as any,
      );

      expect(updated.teamId).toBe('team-new');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'usr-1' },
        data: {
          teamId: 'team-new',
          departmentId: 'dept-new',
          branchId: 'br-new',
        },
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'UPDATE',
            entity: 'UserHierarchy',
            entityType: 'USER_HIERARCHY',
            entityId: 'usr-1',
            module: 'ORGANIZATION',
            metadata: expect.objectContaining({
              transferType: 'BRANCH_TRANSFER',
              companyId: 'org-mumbai',
            }),
            oldValue: {
              branchId: 'br-old',
              departmentId: 'dept-old',
              teamId: 'team-old',
            },
            newValue: expect.objectContaining({
              branchId: 'br-new',
              departmentId: 'dept-new',
              teamId: 'team-new',
            }),
          }),
        }),
      );
    });
  });
});
