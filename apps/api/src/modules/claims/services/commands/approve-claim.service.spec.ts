import { Test, TestingModule } from '@nestjs/testing';
import { ApproveClaimService } from './approve-claim.service';
import { PrismaService } from '../../../../database/prisma.service';
import { ClaimStatus, Prisma, RoleType } from '@prisma/client';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

describe('ApproveClaimService (Claims Lifecycle Assessment & Approval)', () => {
  let service: ApproveClaimService;
  let prisma: PrismaService;

  const mockPrisma = {
    claim: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    claimHistory: {
      create: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb(mockPrisma)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApproveClaimService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ApproveClaimService>(ApproveClaimService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  const baseClaim = {
    id: 'claim-1',
    claimNumber: 'CLM-2026-001',
    status: ClaimStatus.UNDER_ASSESSMENT,
    claimAmount: new Prisma.Decimal(50000),
    createdById: 'agent-1',
    policy: {
      quotation: {
        sumInsured: new Prisma.Decimal(500000),
      },
    },
  };

  it('rejects approval if actor is the claim creator (segregation of duties)', async () => {
    mockPrisma.claim.findUnique.mockResolvedValue(baseClaim);

    await expect(
      service.execute(
        'claim-1',
        { approvedAmount: 45000, comments: 'Approved' },
        'agent-1',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects approval if approvedAmount exceeds policy sum insured', async () => {
    mockPrisma.claim.findUnique.mockResolvedValue(baseClaim);

    await expect(
      service.execute(
        'claim-1',
        { approvedAmount: 600000, comments: 'Approved' },
        'claims-officer-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('successfully approves claim and transitions status to APPROVED', async () => {
    mockPrisma.claim.findUnique.mockResolvedValue(baseClaim);
    mockPrisma.claim.update.mockResolvedValue({
      ...baseClaim,
      status: ClaimStatus.APPROVED,
      approvedAmount: new Prisma.Decimal(45000),
    });

    const result = await service.execute(
      'claim-1',
      { approvedAmount: 45000, comments: 'Surveyor assessment verified' },
      'claims-officer-1',
    );

    expect(result.status).toBe(ClaimStatus.APPROVED);
    expect(mockPrisma.claimHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          claimId: 'claim-1',
          status: ClaimStatus.APPROVED,
          createdById: 'claims-officer-1',
        }),
      }),
    );
  });

  it('rejects approval if actor lacks claim approval authority', async () => {
    mockPrisma.claim.findUnique.mockResolvedValue(baseClaim);

    const unauthorizedActor: any = {
      id: 'agent-99',
      role: 'SALES_AGENT',
      organizationId: 'org-1',
    };

    await expect(
      service.execute(
        'claim-1',
        { approvedAmount: 20000, comments: 'Unauthorized approval attempt' },
        unauthorizedActor,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects approval if claim belongs to a different organization', async () => {
    const claimWithOrg = {
      ...baseClaim,
      policy: {
        ...baseClaim.policy,
        contact: {
          companyId: 'org-tenant-A',
        },
      },
    };
    mockPrisma.claim.findUnique.mockResolvedValue(claimWithOrg);

    const crossOrgActor: any = {
      id: 'officer-b',
      role: 'CLAIMS_OFFICER',
      organizationId: 'org-tenant-B',
    };

    await expect(
      service.execute(
        'claim-1',
        { approvedAmount: 20000, comments: 'Cross org attempt' },
        crossOrgActor,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows approval if actor is SUPER_ADMIN across different organizations', async () => {
    const claimWithOrg = {
      ...baseClaim,
      policy: {
        ...baseClaim.policy,
        contact: {
          companyId: 'org-tenant-A',
        },
      },
    };
    mockPrisma.claim.findUnique.mockResolvedValue(claimWithOrg);
    mockPrisma.claim.update.mockResolvedValue({
      ...claimWithOrg,
      status: ClaimStatus.APPROVED,
      approvedAmount: new Prisma.Decimal(20000),
    });

    const superAdminActor: any = {
      id: 'super-admin-1',
      role: RoleType.ADMIN,
      roles: [RoleType.ADMIN],
      organizationId: 'org-global',
    };

    const result = await service.execute(
      'claim-1',
      { approvedAmount: 20000, comments: 'Super admin approval' },
      superAdminActor,
    );

    expect(result.status).toBe(ClaimStatus.APPROVED);
  });

  it('allows approval if actor is CLAIMS_OFFICER in the same organization', async () => {
    const claimWithOrg = {
      ...baseClaim,
      policy: {
        ...baseClaim.policy,
        contact: {
          companyId: 'org-tenant-A',
        },
      },
    };
    mockPrisma.claim.findUnique.mockResolvedValue(claimWithOrg);
    mockPrisma.claim.update.mockResolvedValue({
      ...claimWithOrg,
      status: ClaimStatus.APPROVED,
      approvedAmount: new Prisma.Decimal(25000),
    });

    const orgClaimsOfficer: any = {
      id: 'officer-a',
      role: RoleType.BACK_OFFICE,
      roles: [RoleType.BACK_OFFICE],
      organizationId: 'org-tenant-A',
    };

    const result = await service.execute(
      'claim-1',
      { approvedAmount: 25000, comments: 'Authorized same-tenant approval' },
      orgClaimsOfficer,
    );

    expect(result.status).toBe(ClaimStatus.APPROVED);
  });
});
