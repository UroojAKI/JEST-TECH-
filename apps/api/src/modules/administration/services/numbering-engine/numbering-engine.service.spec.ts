import { Test, TestingModule } from '@nestjs/testing';
import { NumberingEngineService } from './numbering-engine.service';
import { PrismaService } from '../../../../database/prisma.service';

describe('NumberingEngineService', () => {
  let service: NumberingEngineService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NumberingEngineService,
        {
          provide: PrismaService,
          useValue: {
            numberingFormat: {
              findUnique: jest.fn(),
            },
            numberingSequence: {
              upsert: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<NumberingEngineService>(NumberingEngineService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should format numbers correctly and pad zeros', async () => {
    jest.spyOn(prisma.numberingFormat, 'findUnique').mockResolvedValue({
      entityType: 'POLICY',
      prefix: 'POL',
      format: '{PREFIX}-{YYYY}-{MM}-{SEQUENCE}',
      padding: 6,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    jest.spyOn(prisma.numberingSequence, 'upsert').mockResolvedValue({
      entityType: 'POLICY',
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1,
      sequence: 42,
    });

    const result = await service.generateNext('POLICY');
    const expectedYear = new Date().getFullYear().toString();
    const expectedMonth = (new Date().getMonth() + 1).toString().padStart(2, '0');
    expect(result).toEqual(`POL-${expectedYear}-${expectedMonth}-000042`);
  });

  it('should throw an error if numbering format is not configured', async () => {
    jest.spyOn(prisma.numberingFormat, 'findUnique').mockResolvedValue(null);

    await expect(service.generateNext('UNKNOWN')).rejects.toThrow(
      'Numbering format for UNKNOWN is not configured.',
    );
  });
});
