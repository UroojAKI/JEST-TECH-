import { Test, TestingModule } from '@nestjs/testing';
import { SystemConfigService } from './system-config.service';
import { PrismaService } from '../../../../database/prisma.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { SystemConfigKey } from '../../constants/system-config-key.enum';

describe('SystemConfigService', () => {
  let service: SystemConfigService;
  let prisma: PrismaService;
  let cacheManager: any;

  beforeEach(async () => {
    cacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SystemConfigService,
        {
          provide: PrismaService,
          useValue: {
            systemConfig: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              upsert: jest.fn(),
            },
          },
        },
        {
          provide: CACHE_MANAGER,
          useValue: cacheManager,
        },
      ],
    }).compile();

    service = module.get<SystemConfigService>(SystemConfigService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should return cached value if it exists', async () => {
    cacheManager.get.mockResolvedValue(42);
    
    const result = await service.getValue(SystemConfigKey.SESSION_TIMEOUT);
    
    expect(result).toBe(42);
    expect(prisma.systemConfig.findUnique).not.toHaveBeenCalled();
  });

  it('should fetch from db and cache if not in cache', async () => {
    cacheManager.get.mockResolvedValue(undefined);
    jest.spyOn(prisma.systemConfig, 'findUnique').mockResolvedValue({
      key: 'SESSION_TIMEOUT',
      value: '30',
      valueType: 'NUMBER',
      description: null,
      isPublic: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.getValue(SystemConfigKey.SESSION_TIMEOUT);
    
    expect(result).toBe(30);
    expect(prisma.systemConfig.findUnique).toHaveBeenCalled();
    expect(cacheManager.set).toHaveBeenCalledWith('system_config_SESSION_TIMEOUT', 30, 3600000);
  });

  it('should parse JSON correctly', async () => {
    cacheManager.get.mockResolvedValue(undefined);
    jest.spyOn(prisma.systemConfig, 'findUnique').mockResolvedValue({
      key: 'DEFAULT_LANGUAGE',
      value: '{"lang":"en"}',
      valueType: 'JSON',
      description: null,
      isPublic: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.getValue(SystemConfigKey.DEFAULT_LANGUAGE);
    
    expect(result).toEqual({ lang: 'en' });
  });

  it('should invalidate cache on set', async () => {
    jest.spyOn(prisma.systemConfig, 'upsert').mockResolvedValue({} as any);

    await service.setValue(SystemConfigKey.SESSION_TIMEOUT, 60, 'NUMBER');

    expect(prisma.systemConfig.upsert).toHaveBeenCalled();
    expect(cacheManager.del).toHaveBeenCalledWith('system_config_SESSION_TIMEOUT');
  });
});
