import { Test, TestingModule } from '@nestjs/testing';
import { LeadRoutingEngineService } from './lead-routing-engine.service';
import { PrismaService } from '../../../../../database/prisma.service';

describe('LeadRoutingEngineService', () => {
  let service: LeadRoutingEngineService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadRoutingEngineService,
        {
          provide: PrismaService,
          useValue: {
            lead: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            assignmentRule: {
              findMany: jest.fn(),
            },
            queueMember: {
              findMany: jest.fn(),
              update: jest.fn(),
            },
            $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
          },
        },
      ],
    }).compile();

    service = module.get<LeadRoutingEngineService>(LeadRoutingEngineService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should assign lead to agent with lowest load in matched queue', async () => {
    jest.spyOn(prisma.lead, 'findUnique').mockResolvedValue({
      id: 'lead-1',
      source: 'WEBSITE',
    } as any);

    jest.spyOn(prisma.assignmentRule, 'findMany').mockResolvedValue([
      {
        id: 'rule-1',
        queueId: 'queue-1',
        condition: JSON.stringify({ field: 'source', operator: 'EQUALS', value: 'WEBSITE' }),
        priority: 10,
        name: 'Website Rule',
        description: '',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    ]);

    jest.spyOn(prisma.queueMember, 'findMany').mockResolvedValue([
      { id: 'member-1', userId: 'user-1', currentLoad: 5, queueId: 'queue-1', isAvailable: true, capacity: 10, createdAt: new Date(), updatedAt: new Date() },
      { id: 'member-2', userId: 'user-2', currentLoad: 2, queueId: 'queue-1', isAvailable: true, capacity: 10, createdAt: new Date(), updatedAt: new Date() }, // Lowest load
    ]);

    jest.spyOn(prisma.lead, 'update').mockResolvedValue({ id: 'lead-1', assignedToId: 'user-1' } as any);

    const result = await service.routeLead('lead-1');

    expect(result.assignedToId).toBe('user-1');
    expect(prisma.queueMember.update).toHaveBeenCalledWith({
      where: { id: 'member-1' },
      data: { currentLoad: { increment: 1 } },
    });
  });

  it('should leave unassigned if no rules match', async () => {
    const leadData = { id: 'lead-1', source: 'UNKNOWN' };
    jest.spyOn(prisma.lead, 'findUnique').mockResolvedValue(leadData as any);
    jest.spyOn(prisma.assignmentRule, 'findMany').mockResolvedValue([]);

    const result = await service.routeLead('lead-1');

    expect(result).toEqual(leadData);
    expect(prisma.queueMember.findMany).not.toHaveBeenCalled();
  });
});
