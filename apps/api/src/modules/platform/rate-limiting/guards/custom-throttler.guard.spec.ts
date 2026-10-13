import { Test, TestingModule } from '@nestjs/testing';
import { CustomThrottlerGuard } from './custom-throttler.guard';
import { Reflector } from '@nestjs/core';
import { ThrottlerStorage } from '@nestjs/throttler';
import { ExecutionContext } from '@nestjs/common';
import { THROTTLER_LIMIT } from '@nestjs/throttler/dist/throttler.constants';

describe('CustomThrottlerGuard', () => {
  let guard: CustomThrottlerGuard;
  let reflector: Reflector;
  let storage: ThrottlerStorage;

  beforeEach(async () => {
    storage = {
      increment: jest.fn().mockResolvedValue({ totalHits: 1, timeToExpire: 60 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomThrottlerGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
        {
          provide: 'THROTTLER:MODULE_OPTIONS',
          useValue: {
            throttlers: [
              { name: 'default', ttl: 60000, limit: 1000 },
              { name: 'login', ttl: 60000, limit: 20 },
            ],
          },
        },
        {
          provide: ThrottlerStorage,
          useValue: storage,
        },
      ],
    }).compile();

    guard = module.get<CustomThrottlerGuard>(CustomThrottlerGuard);
    reflector = module.get<Reflector>(Reflector);
    await guard.onModuleInit();
  });

  const createMockContext = () => {
    const req = {
      headers: {},
      ip: '127.0.0.1',
    };
    const res = {
      header: jest.fn(),
      setHeader: jest.fn(),
    };
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    } as unknown as ExecutionContext;
  };

  it('skips narrow login throttler for general routes without @Throttle decorator', async () => {
    const context = createMockContext();
    // Simulate no route-level limit for 'login'
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    const superHandleRequestSpy = jest
      .spyOn(guard as any, 'handleRequest');

    const result = await (guard as any).handleRequest({
      context,
      limit: 20,
      ttl: 60000,
      throttler: { name: 'login', limit: 20, ttl: 60000 },
      blockDuration: 60000,
      getTracker: jest.fn().mockResolvedValue('127.0.0.1'),
      generateKey: jest.fn().mockReturnValue('throttle:login:127.0.0.1'),
    });

    // Should return true immediately without incrementing storage
    expect(result).toBe(true);
    expect(storage.increment).not.toHaveBeenCalled();
  });

  it('evaluates default throttler for general routes', async () => {
    const context = createMockContext();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    const result = await (guard as any).handleRequest({
      context,
      limit: 1000,
      ttl: 60000,
      throttler: { name: 'default', limit: 1000, ttl: 60000 },
      blockDuration: 60000,
      getTracker: jest.fn().mockResolvedValue('127.0.0.1'),
      generateKey: jest.fn().mockReturnValue('throttle:default:127.0.0.1'),
    });

    expect(result).toBe(true);
    expect(storage.increment).toHaveBeenCalled();
  });

  it('evaluates login throttler when route explicitly declares it', async () => {
    const context = createMockContext();
    // Route explicitly declared limit for 'login'
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: string) => {
      if (key === THROTTLER_LIMIT + 'login') return 20;
      return undefined;
    });

    const result = await (guard as any).handleRequest({
      context,
      limit: 20,
      ttl: 60000,
      throttler: { name: 'login', limit: 20, ttl: 60000 },
      blockDuration: 60000,
      getTracker: jest.fn().mockResolvedValue('127.0.0.1'),
      generateKey: jest.fn().mockReturnValue('throttle:login:127.0.0.1'),
    });

    expect(result).toBe(true);
    expect(storage.increment).toHaveBeenCalled();
  });
});
