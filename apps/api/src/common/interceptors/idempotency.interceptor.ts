import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import {
  CACHE_PROVIDER_TOKEN,
  ICacheProvider,
} from '../../modules/platform/cache/cache.provider';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    @Inject(CACHE_PROVIDER_TOKEN)
    private readonly cache: ICacheProvider,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Idempotency applies to mutating operations (POST, PUT, PATCH, DELETE)
    const method = request.method?.toUpperCase();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const idempotencyKey = request.headers['x-idempotency-key'];
    if (!idempotencyKey) {
      return next.handle();
    }

    // Scope the cache key to the authenticated user + organization + HTTP method + route.
    // This prevents cross-user cache collisions where two different users submit the same
    // client-generated idempotency key for different (or the same) operations.
    // A completed response is ONLY replayed to the same principal that generated it.
    const actor = request.user;
    const userId = actor?.userId || actor?.id || 'anon';
    const orgId = actor?.organizationId || 'no-org';
    const route = request.route?.path || request.url || 'unknown';
    const cacheKey = `idempotency:${userId}:${orgId}:${method}:${route}:${idempotencyKey}`;
    const cachedRecord: any = await this.cache.get(cacheKey);

    if (cachedRecord) {
      if (cachedRecord.status === 'IN_FLIGHT') {
        throw new ConflictException(
          'A request with this idempotency key is currently being processed.',
        );
      }

      if (cachedRecord.status === 'COMPLETED') {
        if (response && response.setHeader) {
          response.setHeader('X-Cache-Lookup', 'HIT');
          response.setHeader('X-Idempotency-Key', idempotencyKey);
        }
        return of(cachedRecord.data);
      }
    }

    // Mark key as IN_FLIGHT with short 60s TTL to prevent concurrent races
    await this.cache.set(cacheKey, { status: 'IN_FLIGHT' }, 60);

    return next.handle().pipe(
      tap({
        next: async (data) => {
          // Store completed response for 24 hours (86400s)
          await this.cache.set(cacheKey, { status: 'COMPLETED', data }, 86400);
        },
        error: async () => {
          // In case of execution error, clear the lock so client can safely retry
          await this.cache.delete(cacheKey);
        },
      }),
    );
  }
}
