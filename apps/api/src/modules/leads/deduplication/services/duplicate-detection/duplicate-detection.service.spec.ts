import { Test, TestingModule } from '@nestjs/testing';
import { DuplicateDetectionService } from './duplicate-detection.service';
import { PrismaService } from '../../../../../database/prisma.service';

describe('DuplicateDetectionService', () => {
  let service: DuplicateDetectionService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DuplicateDetectionService,
        {
          provide: PrismaService,
          useValue: {
            lead: {
              findFirst: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<DuplicateDetectionService>(DuplicateDetectionService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should return null if no lead data is provided', async () => {
    const result = await service.detectDuplicates({});
    expect(result).toBeNull();
    expect(prisma.lead.findFirst).not.toHaveBeenCalled();
  });

  it('should return duplicate ID if a match is found', async () => {
    jest
      .spyOn(prisma.lead, 'findFirst')
      .mockResolvedValue({ id: 'duplicate-123' } as any);

    const result = await service.detectDuplicates({
      email: 'test@example.com',
    });

    expect(result).toBe('duplicate-123');
    expect(prisma.lead.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [{ contact: { email: 'test@example.com' } }],
      },
      select: { id: true },
    });
  });

  it('should search using multiple fields if provided', async () => {
    jest.spyOn(prisma.lead, 'findFirst').mockResolvedValue(null);

    await service.detectDuplicates({
      email: 'test@example.com',
      phone: '1234567890',
    });

    expect(prisma.lead.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [
          { contact: { email: 'test@example.com' } },
          { contact: { phone: '1234567890' } },
        ],
      },
      select: { id: true },
    });
  });
});
