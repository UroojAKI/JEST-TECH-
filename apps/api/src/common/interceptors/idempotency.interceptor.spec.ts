import { IdempotencyInterceptor } from './idempotency.interceptor';
import { ExecutionContext, CallHandler, ConflictException } from '@nestjs/common';
import { of, throwError } from 'rxjs';

describe('IdempotencyInterceptor (Iteration 16)', () => {
  let interceptor: IdempotencyInterceptor;
  let cache: any;

  beforeEach(() => {
    cache = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
    };
    interceptor = new IdempotencyInterceptor(cache);
  });

  const mockContext = (method: string, headers: Record<string, string> = {}) => {
    const request = { method, headers };
    const response = { setHeader: jest.fn() };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext;
  };

  const mockHandler = (responsePayload: any): CallHandler => ({
    handle: () => of(responsePayload),
  });

  it('should ignore non-mutating GET requests even if idempotency key is present', async () => {
    const context = mockContext('GET', { 'x-idempotency-key': 'key-1' });
    const next = mockHandler({ ok: true });

    const result = await interceptor.intercept(context, next);
    let emitted: any;
    result.subscribe((val) => (emitted = val));

    expect(emitted).toEqual({ ok: true });
    expect(cache.get).not.toHaveBeenCalled();
  });

  it('should process normally if no idempotency key is provided on POST', async () => {
    const context = mockContext('POST', {});
    const next = mockHandler({ id: 'res-1' });

    const result = await interceptor.intercept(context, next);
    let emitted: any;
    result.subscribe((val) => (emitted = val));

    expect(emitted).toEqual({ id: 'res-1' });
    expect(cache.get).not.toHaveBeenCalled();
  });

  it('should throw ConflictException if request with same key is currently IN_FLIGHT', async () => {
    const context = mockContext('POST', { 'x-idempotency-key': 'key-parallel' });
    const next = mockHandler({ ok: true });

    cache.get.mockResolvedValue({ status: 'IN_FLIGHT' });

    await expect(interceptor.intercept(context, next)).rejects.toThrow(ConflictException);
  });

  it('should return cached response and set X-Cache-Lookup: HIT if key is COMPLETED', async () => {
    const context = mockContext('POST', { 'x-idempotency-key': 'key-completed' });
    const next = mockHandler({ fresh: true });

    cache.get.mockResolvedValue({
      status: 'COMPLETED',
      data: { cachedResult: 'already_processed' },
    });

    const result = await interceptor.intercept(context, next);
    let emitted: any;
    result.subscribe((val) => (emitted = val));

    expect(emitted).toEqual({ cachedResult: 'already_processed' });
    const res = context.switchToHttp().getResponse();
    expect(res.setHeader).toHaveBeenCalledWith('X-Cache-Lookup', 'HIT');
    expect(res.setHeader).toHaveBeenCalledWith('X-Idempotency-Key', 'key-completed');
  });

  it('should clean up in-flight lock if handler throws an error', async () => {
    const context = mockContext('POST', { 'x-idempotency-key': 'key-fail' });
    const next: CallHandler = {
      handle: () => throwError(() => new Error('DB connection failed')),
    };

    cache.get.mockResolvedValue(null);

    const result = await interceptor.intercept(context, next);
    expect(cache.set).toHaveBeenCalledWith('idempotency:key-fail', { status: 'IN_FLIGHT' }, 60);

    result.subscribe({
      error: async () => {
        expect(cache.delete).toHaveBeenCalledWith('idempotency:key-fail');
      },
    });
  });
});
