import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { TenantResourceAuthorizationService } from './tenant-resource-authorization.service';
import { PrismaService } from '../../../database/prisma.service';

describe('TenantResourceAuthorizationService', () => {
  let service: TenantResourceAuthorizationService;
  let prisma: Partial<Record<keyof PrismaService, any>>;

  beforeEach(() => {
    prisma = {
      quotation: { findUnique: jest.fn() },
      lead: { findUnique: jest.fn() },
      customer: { findUnique: jest.fn() },
      agent: { findUnique: jest.fn() },
      motorJourney: { findUnique: jest.fn() },
      document: { findUnique: jest.fn() },
    };
    service = new TenantResourceAuthorizationService(prisma as any);
  });

  describe('assertSameTenant', () => {
    it('should pass when tenant IDs match', () => {
      expect(() =>
        service.assertSameTenant('company-123', 'company-123', 'Quotation'),
      ).not.toThrow();
    });

    it('should throw ForbiddenException on tenant mismatch', () => {
      expect(() =>
        service.assertSameTenant('company-123', 'company-456', 'Quotation'),
      ).toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if resource companyId is missing', () => {
      expect(() => service.assertSameTenant(null, 'company-456', 'Quotation')).toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException if actor companyId is missing', () => {
      expect(() => service.assertSameTenant('company-123', null, 'Quotation')).toThrow(
        ForbiddenException,
      );
    });
  });

  describe('assertTenantResource', () => {
    it('should return resource when tenant matches', async () => {
      const mockLead = { id: 'lead-1', companyId: 'company-100', title: 'Test Lead' };
      prisma.lead.findUnique.mockResolvedValue(mockLead);

      const actor: any = { userId: 'u-1', companyId: 'company-100' };
      const result = await service.assertTenantResource('Lead', 'lead-1', actor);

      expect(result).toEqual(mockLead);
      expect(prisma.lead.findUnique).toHaveBeenCalledWith({ where: { id: 'lead-1' } });
    });

    it('should throw ForbiddenException on cross-tenant resource access', async () => {
      const mockLead = { id: 'lead-1', companyId: 'company-999' };
      prisma.lead.findUnique.mockResolvedValue(mockLead);

      const actor: any = { userId: 'u-1', companyId: 'company-100' };
      await expect(service.assertTenantResource('Lead', 'lead-1', actor)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException if resource does not exist', async () => {
      prisma.lead.findUnique.mockResolvedValue(null);

      const actor: any = { userId: 'u-1', companyId: 'company-100' };
      await expect(service.assertTenantResource('Lead', 'lead-999', actor)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('assertAssignableAgent', () => {
    it('should return agent when active and in same company', async () => {
      const mockAgent = { id: 'agent-1', companyId: 'comp-1', agentCode: 'AG001', isActive: true };
      prisma.agent.findUnique.mockResolvedValue(mockAgent);

      const actor: any = { userId: 'u-1', companyId: 'comp-1' };
      const agent = await service.assertAssignableAgent('agent-1', actor);
      expect(agent).toEqual(mockAgent);
    });

    it('should throw ForbiddenException when agent belongs to another tenant', async () => {
      const mockAgent = { id: 'agent-1', companyId: 'comp-2', agentCode: 'AG001', isActive: true };
      prisma.agent.findUnique.mockResolvedValue(mockAgent);

      const actor: any = { userId: 'u-1', companyId: 'comp-1' };
      await expect(service.assertAssignableAgent('agent-1', actor)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException when agent is inactive', async () => {
      const mockAgent = { id: 'agent-1', companyId: 'comp-1', agentCode: 'AG001', isActive: false };
      prisma.agent.findUnique.mockResolvedValue(mockAgent);

      const actor: any = { userId: 'u-1', companyId: 'comp-1' };
      await expect(service.assertAssignableAgent('agent-1', actor)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('assertMotorJourneyAccess', () => {
    it('should allow access to journey owner', async () => {
      const mockJourney = { id: 'j-1', companyId: 'comp-1', actorId: 'actor-1' };
      prisma.motorJourney.findUnique.mockResolvedValue(mockJourney);

      const actor: any = { userId: 'actor-1', companyId: 'comp-1', role: 'AGENT' };
      const res = await service.assertMotorJourneyAccess('j-1', actor);
      expect(res).toEqual(mockJourney);
    });

    it('should allow access to back office even if not owner', async () => {
      const mockJourney = { id: 'j-1', companyId: 'comp-1', actorId: 'actor-1' };
      prisma.motorJourney.findUnique.mockResolvedValue(mockJourney);

      const actor: any = { userId: 'actor-2', companyId: 'comp-1', role: 'BACK_OFFICE' };
      const res = await service.assertMotorJourneyAccess('j-1', actor);
      expect(res).toEqual(mockJourney);
    });

    it('should reject non-owner agent attempting to access journey', async () => {
      const mockJourney = { id: 'j-1', companyId: 'comp-1', actorId: 'actor-1' };
      prisma.motorJourney.findUnique.mockResolvedValue(mockJourney);

      const actor: any = { userId: 'actor-2', companyId: 'comp-1', role: 'AGENT' };
      await expect(service.assertMotorJourneyAccess('j-1', actor)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
