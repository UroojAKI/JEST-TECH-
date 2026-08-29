import { Test, TestingModule } from '@nestjs/testing';
import { MotorInspectionService } from './motor-inspection.service';
import { PrismaService } from '../../../database/prisma.service';
import { InspectionStatus } from '@prisma/client';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

describe('MotorInspectionService (R6 Break-in Underwriting & Inspection Engine)', () => {
  let service: MotorInspectionService;
  let prisma: PrismaService;

  const mockPrisma = {
    $transaction: jest.fn(async (cb) =>
      typeof cb === 'function' ? cb(mockPrisma) : Promise.all(cb),
    ),
    quotation: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    motorInspection: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MotorInspectionService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<MotorInspectionService>(MotorInspectionService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('completeInspection', () => {
    const completePhotosInspection = {
      id: 'ins-1',
      quotationId: 'q-100',
      status: InspectionStatus.IN_PROGRESS,
      frontImageKey: 'photos/front.jpg',
      backImageKey: 'photos/back.jpg',
      leftImageKey: 'photos/left.jpg',
      rightImageKey: 'photos/right.jpg',
      windshieldImageKey: 'photos/windshield.jpg',
      chassisImageKey: 'photos/chassis.jpg',
      odometerImageKey: 'photos/odometer.jpg',
    };

    it('rejects inspection approval if approver is the quotation creator (segregation of duties)', async () => {
      mockPrisma.motorInspection.findUnique.mockResolvedValue(
        completePhotosInspection,
      );
      mockPrisma.quotation.findUnique.mockResolvedValue({
        id: 'q-100',
        createdById: 'agent-1',
      });

      await expect(
        service.completeInspection(
          'ins-1',
          'agent-1',
          'pdf/report.pdf',
          'https://s3/report.pdf',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects inspection if mandatory photos are missing', async () => {
      const incompleteInspection = {
        ...completePhotosInspection,
        windshieldImageKey: null,
      };

      mockPrisma.motorInspection.findUnique.mockResolvedValue(
        incompleteInspection,
      );
      mockPrisma.quotation.findUnique.mockResolvedValue({
        id: 'q-100',
        createdById: 'agent-1',
      });

      await expect(
        service.completeInspection(
          'ins-1',
          'underwriter-1',
          'pdf/report.pdf',
          'https://s3/report.pdf',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('successfully completes inspection and advances quotation workflowState to INSPECTION_COMPLETED', async () => {
      mockPrisma.motorInspection.findUnique.mockResolvedValue(
        completePhotosInspection,
      );
      mockPrisma.quotation.findUnique.mockResolvedValue({
        id: 'q-100',
        createdById: 'agent-1',
        motorMetadata: {},
      });
      mockPrisma.motorInspection.update.mockResolvedValue({
        ...completePhotosInspection,
        status: InspectionStatus.COMPLETED,
      });

      const result = await service.completeInspection(
        'ins-1',
        'underwriter-1',
        'pdf/report.pdf',
        'https://s3/report.pdf',
      );

      expect(result.status).toBe(InspectionStatus.COMPLETED);
      expect(mockPrisma.quotation.update).toHaveBeenCalledWith({
        where: { id: 'q-100' },
        data: expect.objectContaining({
          workflowState: 'INSPECTION_COMPLETED',
        }),
      });
    });
  });
});
