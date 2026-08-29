import { Test, TestingModule } from '@nestjs/testing';
import { ProviderRegistryService } from './provider-registry.service';
import { PrismaService } from '../../../../../../database/prisma.service';

describe('ProviderRegistryService', () => {
  let service: ProviderRegistryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProviderRegistryService,
        {
          provide: PrismaService,
          useValue: {
            integrationProvider: {
              findMany: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<ProviderRegistryService>(ProviderRegistryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
