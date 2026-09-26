import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { MotorJourneyService } from './motor-journey.service';

describe('MotorJourneyService', () => {
  let service: MotorJourneyService;
  let prisma: any;
  let tenantAuthService: any;

  const mockActor: any = {
    id: 'user-agent-1',
    userId: 'user-agent-1',
    companyId: 'company-1',
    role: 'AGENT',
  };

  beforeEach(() => {
    prisma = {
      motorJourney: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    tenantAuthService = {
      assertAssignableAgent: jest.fn().mockResolvedValue({ id: 'agent-1', companyId: 'company-1' }),
      assertMotorJourneyAccess: jest.fn(),
    };
    service = new MotorJourneyService(prisma, tenantAuthService);
  });

  describe('createJourney', () => {
    it('should create a new journey with 24h TTL bound to tenant and actor', async () => {
      const mockCreated = {
        id: 'journey-123',
        companyId: 'company-1',
        actorId: 'user-agent-1',
        vehicleCategory: 'PRIVATE_CAR',
        status: 'IN_PROGRESS',
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
        createdAt: new Date(),
      };
      prisma.motorJourney.create.mockResolvedValue(mockCreated);

      const result = await service.createJourney(
        { vehicleCategory: 'PRIVATE_CAR' },
        mockActor,
      );

      expect(result.journeyId).toBe('journey-123');
      expect(result.companyId).toBe('company-1');
      expect(result.status).toBe('IN_PROGRESS');
      expect(prisma.motorJourney.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: 'company-1',
            actorId: 'user-agent-1',
            vehicleCategory: 'PRIVATE_CAR',
            status: 'IN_PROGRESS',
          }),
        }),
      );
    });

    it('should throw ForbiddenException if actor is missing companyId', async () => {
      const invalidActor: any = { id: 'u-1' };
      await expect(
        service.createJourney({}, invalidActor),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getJourney', () => {
    it('should return journey when authorized', async () => {
      const mockJourney = {
        id: 'journey-123',
        companyId: 'company-1',
        actorId: 'user-agent-1',
        quotationId: null,
        status: 'IN_PROGRESS',
        vehicleCategory: 'PRIVATE_CAR',
        expiresAt: new Date(Date.now() + 3600000), // 1 hour in future
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      tenantAuthService.assertMotorJourneyAccess.mockResolvedValue(mockJourney);

      const result = await service.getJourney('journey-123', mockActor);
      expect(result.journeyId).toBe('journey-123');
      expect(result.isExpired).toBe(false);
    });

    it('should transition status to EXPIRED if TTL has elapsed', async () => {
      const expiredJourney = {
        id: 'journey-123',
        companyId: 'company-1',
        actorId: 'user-agent-1',
        quotationId: null,
        status: 'IN_PROGRESS',
        vehicleCategory: 'PRIVATE_CAR',
        expiresAt: new Date(Date.now() - 3600000), // 1 hour in past
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      tenantAuthService.assertMotorJourneyAccess.mockResolvedValue(expiredJourney);
      prisma.motorJourney.update.mockResolvedValue({ ...expiredJourney, status: 'EXPIRED' });

      const result = await service.getJourney('journey-123', mockActor);
      expect(result.status).toBe('EXPIRED');
      expect(result.isExpired).toBe(true);
      expect(prisma.motorJourney.update).toHaveBeenCalledWith({
        where: { id: 'journey-123' },
        data: { status: 'EXPIRED' },
      });
    });
  });
});
