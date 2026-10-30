import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RoleType, UserStatus } from '@prisma/client';
import { ActorContext } from '../../src/common/interfaces/actor-context.interface';
import { RequestUser } from '../../src/modules/auth/decorators/current-user.decorator';
import { ResourceAuthorizationService } from '../../src/common/services/resource-authorization.service';
import { ContactsService } from '../../src/modules/contacts/services/contacts.service';
import { LeadsService } from '../../src/modules/leads/services/leads.service';
import { GetPolicyService } from '../../src/modules/policies/services/queries/get-policy.service';
import { ClaimReportProvider } from '../../src/modules/claims/providers/claim-report.provider';
import { CommissionEngineService } from '../../src/modules/finance/commission/services/commission-engine/commission-engine.service';
import { FinanceController } from '../../src/modules/finance/controllers/finance.controller';
import { ReportCommandsService } from '../../src/modules/platform/reporting/commands/report-commands.service';
import {
  UpdateReportCommand,
  DeleteScheduleCommand,
} from '../../src/modules/platform/reporting/commands/report.commands';
import { OrganizationService } from '../../src/modules/administration/services/organization/organization.service';
import { AuditController } from '../../src/modules/platform/audit/controllers/audit.controller';

describe('Phase 12 Two-Company Adversarial Tenant Isolation Audit (12.3 & 12.5)', () => {
  // Authoritative Test Fixture Setup
  const COMPANY_A = 'company-alpha-1111-1111-1111-111111111111';
  const COMPANY_B = 'company-beta-2222-2222-2222-222222222222';

  const adminA: RequestUser = {
    id: 'user-admin-a',
    userId: 'user-admin-a',
    firstName: 'Admin',
    lastName: 'A',
    email: 'admin@company-a.com',
    companyId: COMPANY_A,
    organizationId: COMPANY_A,
    role: RoleType.ADMIN,
    roles: [RoleType.ADMIN],
    workspaces: [],
    permissions: ['report:create', 'report:read', 'user:write'],
    status: UserStatus.ACTIVE,
  };

  const agentA: RequestUser = {
    id: 'user-agent-a',
    userId: 'user-agent-a',
    firstName: 'Agent',
    lastName: 'A',
    email: 'agent@company-a.com',
    companyId: COMPANY_A,
    organizationId: COMPANY_A,
    role: RoleType.AGENT,
    roles: [RoleType.AGENT],
    agentId: 'agent-profile-a-1',
    workspaces: [],
    permissions: ['lead:read', 'lead:write'],
    status: UserStatus.ACTIVE,
  };

  const adminB: RequestUser = {
    id: 'user-admin-b',
    userId: 'user-admin-b',
    firstName: 'Admin',
    lastName: 'B',
    email: 'admin@company-b.com',
    companyId: COMPANY_B,
    organizationId: COMPANY_B,
    role: RoleType.ADMIN,
    roles: [RoleType.ADMIN],
    workspaces: [],
    permissions: ['report:create', 'report:read', 'user:write'],
    status: UserStatus.ACTIVE,
  };

  const agentB: RequestUser = {
    id: 'user-agent-b',
    userId: 'user-agent-b',
    firstName: 'Agent',
    lastName: 'B',
    email: 'agent@company-b.com',
    companyId: COMPANY_B,
    organizationId: COMPANY_B,
    role: RoleType.AGENT,
    roles: [RoleType.AGENT],
    agentId: 'agent-profile-b-1',
    workspaces: [],
    permissions: ['lead:read', 'lead:write'],
    status: UserStatus.ACTIVE,
  };

  let resourceAuthz: ResourceAuthorizationService;

  beforeEach(() => {
    resourceAuthz = new ResourceAuthorizationService();
  });

  // =========================================================================
  // Scenario 1: Company A reads Company B contact -> 403 / 404
  // =========================================================================
  describe('Scenario 1: Cross-Company Contact Access', () => {
    it('blocks Company A admin from reading Company B contact with ForbiddenException', async () => {
      const contactRepoMock: any = {
        findById: jest.fn().mockResolvedValue({
          id: 'contact-b-1',
          companyId: COMPANY_B,
          firstName: 'Beta',
          lastName: 'Customer',
          createdBy: { companyId: COMPANY_B },
        }),
      };
      const prismaMock: any = {};
      const contactsService = new ContactsService(contactRepoMock, prismaMock);

      await expect(contactsService.findById('contact-b-1', adminA)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(contactsService.findById('contact-b-1', adminA)).rejects.toThrow(
        'Contact belongs to another organization',
      );
    });
  });

  // =========================================================================
  // Scenario 2: Company A edits Company B lead -> 403 / 404
  // =========================================================================
  describe('Scenario 2: Cross-Company Lead Modification', () => {
    it('blocks Company A admin from updating Company B lead with ForbiddenException', async () => {
      const leadRepoMock: any = {
        findById: jest.fn().mockResolvedValue({
          id: 'lead-b-1',
          companyId: COMPANY_B,
          status: 'NEW',
        }),
      };
      const leadsService = new LeadsService(
        leadRepoMock,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        resourceAuthz,
        {} as any,
      );

      await expect(
        leadsService.update('lead-b-1', { notes: 'Malicious modification' } as any, adminA),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        leadsService.update('lead-b-1', { notes: 'Malicious modification' } as any, adminA),
      ).rejects.toThrow('Cross-organization access is strictly prohibited');
    });
  });

  // =========================================================================
  // Scenario 3: Company A reads Company B policy -> 403 / 404
  // =========================================================================
  describe('Scenario 3: Cross-Company Policy Access', () => {
    it('blocks Company A admin from reading Company B policy detail with ForbiddenException', async () => {
      const policyRepoMock: any = {
        findDetail: jest.fn().mockResolvedValue({
          id: 'policy-b-1',
          policyNumber: 'POL-BETA-001',
          companyId: COMPANY_B,
        }),
      };
      const getPolicyService = new GetPolicyService(
        policyRepoMock,
        resourceAuthz,
        {} as any,
      );

      await expect(getPolicyService.executeOne('policy-b-1', adminA)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(getPolicyService.executeOne('policy-b-1', adminA)).rejects.toThrow(
        'Cross-organization access is strictly prohibited',
      );
    });
  });

  // =========================================================================
  // Scenario 4: Company A exports Company B claims -> 403 / 404
  // =========================================================================
  describe('Scenario 4: Cross-Company Claims Export Scoping', () => {
    it('strictly isolates claims report data to Company A and rejects unauthenticated tenant requests', async () => {
      const prismaMock: any = {
        claim: { findMany: jest.fn().mockResolvedValue([]) },
      };
      const registryMock: any = { register: jest.fn() };
      const claimProvider = new ClaimReportProvider(registryMock, prismaMock);

      // 1. Missing company context fails closed
      await expect(
        claimProvider.execute({
          companyId: undefined as any,
          parameters: { reportCode: 'CLAIMS_REGISTER' },
        }),
      ).rejects.toThrow(ForbiddenException);

      // 2. Query executed for Company A strictly scopes companyId = COMPANY_A
      await claimProvider.execute({
        companyId: COMPANY_A,
        parameters: { reportCode: 'CLAIMS_REGISTER' },
      });

      expect(prismaMock.claim.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: COMPANY_A, deletedAt: null }),
        }),
      );
    });
  });

  // =========================================================================
  // Scenario 5: Company A reads Company B commissions -> 403 / 404
  // =========================================================================
  describe('Scenario 5: Cross-Company Commission Scoping', () => {
    it('strictly scopes commission querying to caller companyId', async () => {
      const prismaMock: any = {
        commission: { findMany: jest.fn().mockResolvedValue([]) },
        policy: { findMany: jest.fn().mockResolvedValue([]) },
        commissionPlan: { findMany: jest.fn().mockResolvedValue([]) },
      };
      const financeController = new FinanceController(
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        prismaMock,
      );

      await financeController.getCommissions(adminA);

      expect(prismaMock.commission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [{ companyId: COMPANY_A }, { user: { companyId: COMPANY_A } }],
          }),
        }),
      );
    });
  });

  // =========================================================================
  // Scenario 6: Company A approves Company B commission -> 403 / 404
  // =========================================================================
  describe('Scenario 6: Cross-Company Commission Approval', () => {
    it('blocks Company A admin from approving Company B commission with ForbiddenException', async () => {
      const prismaMock: any = {
        $transaction: jest.fn(async (callback) => {
          return callback({
            commission: {
              findUnique: jest.fn().mockResolvedValue({
                id: 'comm-b-1',
                companyId: COMPANY_B,
                status: 'ACCRUED',
                user: { companyId: COMPANY_B },
              }),
            },
          });
        }),
      };
      const commissionEngine = new CommissionEngineService(prismaMock);

      await expect(commissionEngine.approveCommission('comm-b-1', adminA)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(commissionEngine.approveCommission('comm-b-1', adminA)).rejects.toThrow(
        'Commission belongs to another organization',
      );
    });

    it('itemizes bulk approval failure as FORBIDDEN for cross-company commission records', async () => {
      const prismaMock: any = {
        $transaction: jest.fn(async (callback) => {
          return callback({
            commission: {
              findUnique: jest.fn().mockResolvedValue({
                id: 'comm-b-99',
                companyId: COMPANY_B,
                status: 'ACCRUED',
                user: { companyId: COMPANY_B },
              }),
            },
          });
        }),
      };
      const commissionEngine = new CommissionEngineService(prismaMock);

      const bulkResult = await commissionEngine.bulkApproveCommissions(['comm-b-99'], adminA);
      expect(bulkResult.failedCount).toBe(1);
      expect(bulkResult.results[0]).toMatchObject({
        id: 'comm-b-99',
        status: 'FORBIDDEN',
        message: 'Commission belongs to another organization',
      });
    });
  });

  // =========================================================================
  // Scenario 7: Company A updates Company B report -> 403 / 404
  // =========================================================================
  describe('Scenario 7: Cross-Company Report Update', () => {
    it('blocks Company A admin from updating Company B custom report with ForbiddenException', async () => {
      const repoMock: any = {
        update: jest.fn().mockImplementation((id, data, companyId) => {
          const existingReport = { id, companyId: COMPANY_B };
          if (companyId && existingReport.companyId !== companyId) {
            throw new ForbiddenException('Cross-organization report update is strictly prohibited');
          }
        }),
      };
      const reportCommands = new ReportCommandsService(
        repoMock,
        {} as any,
        {} as any,
        { emit: jest.fn() } as any,
      );

      const command = new UpdateReportCommand(
        'report-b-1',
        { name: 'Hijacked Report' } as any,
        adminA.id,
        adminA.companyId,
      );

      await expect(reportCommands.handleUpdateReport(command)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(reportCommands.handleUpdateReport(command)).rejects.toThrow(
        'Cross-organization report update is strictly prohibited',
      );
    });
  });

  // =========================================================================
  // Scenario 8: Company A deletes Company B schedule -> 403 / 404
  // =========================================================================
  describe('Scenario 8: Cross-Company Report Schedule Deletion', () => {
    it('blocks Company A admin from deleting Company B report schedule with ForbiddenException', async () => {
      const repoMock: any = {
        deleteSchedule: jest.fn().mockImplementation((id, companyId) => {
          const existingSchedule = { id, companyId: COMPANY_B };
          if (companyId && existingSchedule.companyId !== companyId) {
            throw new ForbiddenException(
              'Cross-organization report schedule deletion is strictly prohibited',
            );
          }
        }),
      };
      const reportCommands = new ReportCommandsService(
        repoMock,
        {} as any,
        {} as any,
        { emit: jest.fn() } as any,
      );

      const command = new DeleteScheduleCommand('sched-b-1', adminA.companyId);

      await expect(reportCommands.handleDeleteSchedule(command)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(reportCommands.handleDeleteSchedule(command)).rejects.toThrow(
        'Cross-organization report schedule deletion is strictly prohibited',
      );
    });
  });

  // =========================================================================
  // Scenario 9: Company A changes Company B employee hierarchy -> 403 / 404
  // =========================================================================
  describe('Scenario 9: Cross-Company Employee Hierarchy Assignment', () => {
    it('blocks Company A admin from assigning Company B employee to a team', async () => {
      const prismaMock: any = {
        $transaction: jest.fn(async (callback) => {
          return callback({
            user: {
              findUnique: jest.fn().mockResolvedValue({
                id: 'user-b-employee',
                status: UserStatus.ACTIVE,
                companyId: COMPANY_B,
              }),
            },
          });
        }),
      };
      const orgService = new OrganizationService(prismaMock);

      await expect(
        orgService.assignUserToTeam('user-b-employee', 'team-a-1', adminA),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        orgService.assignUserToTeam('user-b-employee', 'team-a-1', adminA),
      ).rejects.toThrow('User belongs to another organization');
    });
  });

  // =========================================================================
  // Scenario 10: Company A reads Company B audit events -> 403 / 404
  // =========================================================================
  describe('Scenario 10: Cross-Company Audit Event Isolation', () => {
    it('strictly confines audit logs to caller companyId and prevents cross-tenant access', async () => {
      const auditServiceMock: any = {
        getAuditLogs: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      };
      const auditController = new AuditController(auditServiceMock);

      await auditController.getAuditLogs(adminA);

      expect(auditServiceMock.getAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: 'TENANT',
          companyId: COMPANY_A,
        }),
        expect.anything(),
      );

      // Missing tenant context fails closed with ForbiddenException
      const unattachedAdmin: RequestUser = {
        ...adminA,
        companyId: undefined as any,
        organizationId: undefined as any,
        permissions: [],
      };

      await expect(auditController.getAuditLogs(unattachedAdmin)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(auditController.getAuditLogs(unattachedAdmin)).rejects.toThrow(
        'Tenant context (companyId) is required to access audit trail.',
      );
    });
  });

  // =========================================================================
  // Scenario 11: Agent A requests another employee's financial data -> 403
  // =========================================================================
  describe('Scenario 11: Agent Access to Another Employee Financial Data', () => {
    it('denies Agent A access to other employees financial data and restricts getMyCommissions to caller', async () => {
      const prismaMock: any = {
        commission: { findMany: jest.fn().mockResolvedValue([]) },
        policy: { findMany: jest.fn().mockResolvedValue([]) },
        commissionPlan: { findMany: jest.fn().mockResolvedValue([]) },
      };
      const financeController = new FinanceController(
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        prismaMock,
      );

      // getMyCommissions strictly enforces caller's own ID
      await financeController.getMyCommissions(agentA);

      expect(prismaMock.commission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: agentA.userId,
          }),
        }),
      );

      // Resource authorization prohibits Agent from reading payment records created by another agent
      const otherEmployeePayment = {
        companyId: COMPANY_A,
        createdById: 'other-agent-99',
      };

      expect(() => {
        resourceAuthz.authorize(agentA, 'PAYMENT', 'READ', otherEmployeePayment);
      }).toThrow(ForbiddenException);
    });
  });

  // =========================================================================
  // Scenario 12: Agent A modifies employee ID in route or query parameters -> 403
  // =========================================================================
  describe('Scenario 12: Route Parameter Tampering by Agent', () => {
    it('prohibits Agent A from accessing another employee resource by modifying parameter', () => {
      const targetResource = {
        companyId: COMPANY_A,
        userId: 'victim-agent-uuid',
        createdById: 'victim-agent-uuid',
      };

      expect(() => {
        resourceAuthz.authorize(agentA, 'LEAD', 'READ', targetResource);
      }).toThrow(ForbiddenException);
      expect(() => {
        resourceAuthz.authorize(agentA, 'LEAD', 'READ', targetResource);
      }).toThrow('You do not have permission to access this lead');
    });
  });
});
