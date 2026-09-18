import { Test, TestingModule } from '@nestjs/testing';
import { AgentsService } from './agents.service';
import { PrismaService } from '../../database/prisma.service';
import { RoleType } from '@prisma/client';
import { NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';

describe('AgentsService', () => {
  let service: AgentsService;
  let prisma: any;

  const mockAgent = {
    id: 'agent-uuid-1',
    userId: 'user-uuid-1',
    agentCode: 'AGT-0001',
    agencyName: 'Sharma Agency',
    licenseNumber: 'IRDAI-1234',
    commissionTier: 'STANDARD',
    isActive: true,
    user: {
      id: 'user-uuid-1',
      email: 'agent@jest.com',
      firstName: 'Rajesh',
      lastName: 'Sharma',
      phone: '9876543210',
    },
    _count: {
      leads: 5,
      quotations: 10,
    },
  };

  beforeEach(async () => {
    prisma = {
      agent: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      lead: {
        count: jest.fn(),
      },
      motorQuotation: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AgentsService>(AgentsService);
  });

  describe('findMe', () => {
    it('should return agent profile for authenticated agent user', async () => {
      prisma.agent.findUnique.mockResolvedValue(mockAgent);

      const result = await service.findMe({ id: 'user-uuid-1', role: RoleType.AGENT } as any);
      expect(result.agentCode).toBe('AGT-0001');
      expect(prisma.agent.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-uuid-1' },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException when no agent profile exists for user', async () => {
      prisma.agent.findUnique.mockResolvedValue(null);

      await expect(
        service.findMe({ id: 'unknown-user', role: RoleType.AGENT } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return paginated list of agents for admin', async () => {
      prisma.agent.findMany.mockResolvedValue([mockAgent]);
      prisma.agent.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 }, { id: 'admin-1', role: RoleType.ADMIN } as any);
      expect(result.data.length).toBe(1);
      expect(result.meta.total).toBe(1);
      expect(prisma.agent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 10,
        }),
      );
    });

    it('should filter by own userId when caller is an AGENT', async () => {
      prisma.agent.findMany.mockResolvedValue([mockAgent]);
      prisma.agent.count.mockResolvedValue(1);

      await service.findAll({}, { id: 'user-uuid-1', role: RoleType.AGENT } as any);
      expect(prisma.agent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-uuid-1',
          }),
        }),
      );
    });
  });

  describe('findById', () => {
    it('should return agent details if authorized', async () => {
      prisma.agent.findFirst.mockResolvedValue(mockAgent);

      const result = await service.findById('agent-uuid-1', { id: 'admin-1', role: RoleType.ADMIN } as any);
      expect(result.agentCode).toBe('AGT-0001');
    });

    it('should throw ForbiddenException if agent tries to view another agent', async () => {
      prisma.agent.findFirst.mockResolvedValue(mockAgent);

      await expect(
        service.findById('agent-uuid-1', { id: 'different-agent-user', role: RoleType.AGENT } as any),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('create', () => {
    it('should create new agent with auto-generated AGT-XXXX code', async () => {
      prisma.agent.findUnique
        .mockResolvedValueOnce(null) // no profile for user
        .mockResolvedValueOnce(null); // no code collision
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-uuid-1',
        firstName: 'Rajesh',
        lastName: 'Sharma',
      });
      prisma.agent.count.mockResolvedValue(0);
      prisma.agent.create.mockResolvedValue(mockAgent);

      const result = await service.create(
        { agencyName: 'Sharma Agency' },
        { id: 'user-uuid-1', role: RoleType.AGENT } as any,
      );

      expect(prisma.agent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            agentCode: 'AGT-0001',
            userId: 'user-uuid-1',
          }),
        }),
      );
      expect(result).toEqual(mockAgent);
    });

    it('should throw ConflictException if agent profile already exists', async () => {
      prisma.agent.findUnique.mockResolvedValueOnce(mockAgent);

      await expect(
        service.create({}, { id: 'user-uuid-1', role: RoleType.AGENT } as any),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getAgentStats', () => {
    it('should aggregate pipeline stats and quote revenue', async () => {
      prisma.agent.findFirst.mockResolvedValue(mockAgent);
      prisma.lead.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(4)  // converted
        .mockResolvedValueOnce(1)  // lost
        .mockResolvedValueOnce(5); // in progress
      prisma.motorQuotation.findMany.mockResolvedValue([
        { status: 'ACCEPTED', finalPremium: 15000 },
        { status: 'ACCEPTED', finalPremium: 25000 },
        { status: 'DRAFT', finalPremium: 12000 },
      ]);

      const stats = await service.getAgentStats('agent-uuid-1', { id: 'admin-1', role: RoleType.ADMIN } as any);
      expect(stats.pipeline.totalLeads).toBe(10);
      expect(stats.pipeline.convertedLeads).toBe(4);
      expect(stats.pipeline.conversionRate).toBe('40.0%');
      expect(stats.quotations.totalQuotes).toBe(3);
      expect(stats.quotations.acceptedQuotes).toBe(2);
      expect(stats.quotations.totalPremium).toBe(40000);
    });
  });
});
