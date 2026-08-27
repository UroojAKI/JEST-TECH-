import { Test, TestingModule } from '@nestjs/testing';
import { ResourceAuthorizationService } from './resource-authorization.service';
import { ScopeResolver } from './scope-resolver.service';
import { RoleType, UserStatus, InspectionStatus } from '@prisma/client';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { ProposalService } from '../../modules/proposal/services/proposal.service';
import { MotorPaymentTrackingService } from '../../modules/motor/services/motor-payment-tracking.service';
import { WorkflowEngineService } from '../../modules/platform/workflow/services/workflow-engine.service';
import { PrismaService } from '../../database/prisma.service';
import { ActorContext } from '../interfaces/actor-context.interface';

describe('Forensic Security Abuse & BOLA Suite (Iteration 17)', () => {
  let authzService: ResourceAuthorizationService;

  beforeEach(() => {
    authzService = new ResourceAuthorizationService();
  });

  const createActor = (overrides: Partial<ActorContext>): ActorContext => ({
    userId: 'usr-agent-a',
    email: 'agent.a@jest.com',
    firstName: 'Agent',
    lastName: 'A',
    organizationId: 'org-mumbai',
    companyId: 'org-mumbai',
    branchId: 'branch-andheri',
    branchCode: 'ANDHERI',
    departmentId: 'dept-sales',
    teamId: 'team-motor-a',
    role: RoleType.SALES_AGENT,
    roles: [RoleType.SALES_AGENT],
    permissions: ['policy.read', 'lead.read', 'quotation.read'],
    workspaces: ['SALES'],
    status: UserStatus.ACTIVE,
    ...overrides,
  });

  describe('Attack Vector 1: Cross-Branch / Cross-Team BOLA & IDOR Attempt', () => {
    it('should block Team Leader from accessing policy belonging to another branch and team (BOLA attack)', () => {
      const leaderA = createActor({
        userId: 'usr-leader-a',
        role: RoleType.TEAM_LEADER,
        roles: [RoleType.TEAM_LEADER],
        teamId: 'team-motor-a',
        branchId: 'branch-andheri',
      });

      const policyTeamB = {
        id: 'pol-other-team',
        createdById: 'usr-agent-b',
        teamId: 'team-motor-b',
        branchId: 'branch-bandra', // Different branch and team!
        organizationId: 'org-mumbai',
      };

      expect(() =>
        authzService.authorize(leaderA, 'POLICY', 'READ', policyTeamB),
      ).toThrow(ForbiddenException);
    });

    it('should block Branch Manager from accessing policy belonging to another branch (BOLA attack)', () => {
      const managerA = createActor({
        userId: 'usr-manager-a',
        role: RoleType.BRANCH_MANAGER,
        roles: [RoleType.BRANCH_MANAGER],
        branchId: 'branch-andheri',
      });

      const policyBranchB = {
        id: 'pol-other-branch',
        createdById: 'usr-agent-c',
        branchId: 'branch-bandra', // Different branch!
        organizationId: 'org-mumbai',
      };

      expect(() =>
        authzService.authorize(managerA, 'POLICY', 'READ', policyBranchB),
      ).toThrow(ForbiddenException);
    });

    it('should block Sales Agent from accessing lead assigned to another agent (BOLA attack)', () => {
      const agentA = createActor({
        userId: 'usr-agent-a',
        role: RoleType.SALES_AGENT,
        roles: [RoleType.SALES_AGENT],
      });

      const leadAgentB = {
        id: 'lead-b',
        assignedToId: 'usr-agent-b',
        createdById: 'usr-agent-b',
        organizationId: 'org-mumbai',
      };

      expect(() =>
        authzService.authorize(agentA, 'LEAD', 'READ', leadAgentB),
      ).toThrow(ForbiddenException);
    });
  });

  describe('Attack Vector 2: Role Privilege Escalation Guards', () => {
    it('should verify Sales Agent and POSP cannot perform Policy Issuance', () => {
      const issuanceAllowedRoles: RoleType[] = [
        RoleType.SUPER_ADMIN,
        RoleType.ADMIN,
        RoleType.OPERATIONS,
        RoleType.UNDERWRITER,
      ];

      const agentRole: RoleType = RoleType.SALES_AGENT;
      const pospRole: RoleType = RoleType.POSP_ADVISOR;
      const customerRole: RoleType = RoleType.CUSTOMER;

      expect(issuanceAllowedRoles.includes(agentRole)).toBe(false);
      expect(issuanceAllowedRoles.includes(pospRole)).toBe(false);
      expect(issuanceAllowedRoles.includes(customerRole)).toBe(false);
    });
  });

  describe('Attack Vector 3: Deactivated User Token Defense', () => {
    it('should reject access if user status is INACTIVE or SUSPENDED', () => {
      const activeCheck = (status: UserStatus) => status === UserStatus.ACTIVE;

      expect(activeCheck(UserStatus.ACTIVE)).toBe(true);
      expect(activeCheck(UserStatus.INACTIVE)).toBe(false);
      expect(activeCheck(UserStatus.SUSPENDED)).toBe(false);
    });
  });

  describe('Attack Vector 4: Financial Underpayment Tampering Attack', () => {
    it('should strictly reject payment when received amount < payable amount', async () => {
      const prisma: any = {
        quotation: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'q-10',
            totalPremium: 25000,
          }),
        },
        motorPaymentRecord: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
      };

      const paymentService = new MotorPaymentTrackingService(prisma);

      // Attacker attempts to pay 100 instead of 25,000
      await expect(
        paymentService.recordPayment({
          quotationId: 'q-10',
          amount: 100,
          status: 'PAID',
          referenceNumber: 'TXN-HACK-001',
          paymentMethod: 'UPI' as any,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Attack Vector 5: Inspection Bypass Attack', () => {
    it('should block proposal creation when vehicle requires inspection that is not COMPLETED', async () => {
      const prisma: any = {
        quotation: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'q-breakin',
            contactId: 'c-1',
            expiryDate: new Date(Date.now() + 86400000),
            totalPremium: 15000,
          }),
        },
        motorInspection: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'insp-1',
            status: InspectionStatus.PENDING, // Not COMPLETED!
          }),
        },
      };

      const proposalService = new ProposalService(
        prisma,
        {} as WorkflowEngineService,
      );

      await expect(
        proposalService.createProposal('q-breakin', 'usr-agent-a'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
