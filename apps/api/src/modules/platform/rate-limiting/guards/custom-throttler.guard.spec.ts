import { Test, TestingModule } from '@nestjs/testing';
import { CustomThrottlerGuard } from './custom-throttler.guard';
import { Reflector } from '@nestjs/core';
import { ThrottlerStorage, ThrottlerException } from '@nestjs/throttler';
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

  const createMockContext = (customReq?: any) => {
    const req = {
      headers: {},
      ip: '127.0.0.1',
      ...customReq,
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
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

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

  describe('getTracker', () => {
    it('tracks by user ID if request is authenticated', async () => {
      const tracker = await (guard as any).getTracker({
        user: { id: 'usr-123' },
        ip: '192.168.1.1',
      });
      expect(tracker).toBe('user_usr-123');
    });

    it('tracks by first X-Forwarded-For IP if unauthenticated', async () => {
      const tracker = await (guard as any).getTracker({
        headers: { 'x-forwarded-for': '203.0.113.195, 70.41.3.18' },
        ip: '127.0.0.1',
      });
      expect(tracker).toBe('ip_203.0.113.195');
    });

    it('falls back to req.ip when unauthenticated and no forwarded header', async () => {
      const tracker = await (guard as any).getTracker({
        headers: {},
        ip: '10.0.0.5',
      });
      expect(tracker).toBe('ip_10.0.0.5');
    });
  });

  describe('throwThrottlingException', () => {
    it('sets Retry-After header and throws ThrottlerException', async () => {
      const context = createMockContext();
      const res = context.switchToHttp().getResponse();

      await expect(
        (guard as any).throwThrottlingException(context, {
          timeToBlockExpire: 45000,
          limit: 100,
          ttl: 60000,
          totalHits: 101,
          timeToExpire: 45,
        }),
      ).rejects.toThrow(ThrottlerException);

      expect(res.header).toHaveBeenCalledWith('Retry-After', '45');
    });
  });
});
