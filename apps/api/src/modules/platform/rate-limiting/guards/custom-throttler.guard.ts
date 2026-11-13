import { ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import { ThrottlerRequest, ThrottlerLimitDetail } from '@nestjs/throttler/dist/throttler.guard.interface';
import { THROTTLER_LIMIT } from '@nestjs/throttler/dist/throttler.constants';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  private readonly logger = new Logger(CustomThrottlerGuard.name);
  protected async handleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
    const { context, throttler } = requestProps;
    const handler = context.getHandler();
    const classRef = context.getClass();
    const throttlerName = throttler.name ?? 'default';

    // Check if the route or controller explicitly declared a limit for THIS throttler
    const routeLimit = this.reflector.getAllAndOverride(
      THROTTLER_LIMIT + throttlerName,
      [handler, classRef],
    );

    // If this is a specialized throttler (not 'default'), only evaluate it if the route
    // explicitly designated it via @Throttle({ [name]: ... }).
    // This prevents narrow limits (e.g. login: 20/min) from choking general API endpoints (1000/min).
    if (throttlerName !== 'default' && routeLimit === undefined) {
      return true;
    }

    return super.handleRequest(requestProps);
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    // 1. Prioritize authenticated user ID to isolate rate limits per user rather than sharing an entire office NAT / IP
    if (req.user?.id) {
      return `user_${req.user.id}`;
    }

    // 2. Fall back to sanitized client IP from X-Forwarded-For or req.ip
    const forwarded = req.headers?.['x-forwarded-for'];
    if (forwarded) {
      const firstIp = (typeof forwarded === 'string' ? forwarded : forwarded[0])
        .split(',')[0]
        .trim();
      if (firstIp) return `ip_${firstIp}`;
    }

    const ip = req.ips?.length ? req.ips[0] : req.ip || '127.0.0.1';
    return `ip_${ip}`;
  }

  protected async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();
    const timeToBlockExpire = throttlerLimitDetail?.timeToBlockExpire ?? 60;
    const seconds = Math.max(1, Math.ceil(timeToBlockExpire / 1000));
    const correlationId =
      req?.correlationId ||
      req?.headers?.['x-correlation-id'] ||
      req?.headers?.['x-request-id'] ||
      null;

    // Keep 429s diagnosable without logging credentials, request bodies or tokens.
    this.logger.warn(JSON.stringify({
      event: 'RATE_LIMIT_EXCEEDED',
      correlationId,
      method: req?.method,
      path: String(req?.originalUrl || req?.url || '').split('?')[0],
      userId: req?.user?.id || null,
      companyId: req?.user?.companyId || req?.user?.organizationId || null,
      role: req?.user?.role || null,
      limit: throttlerLimitDetail?.limit,
      ttl: throttlerLimitDetail?.ttl,
      totalHits: throttlerLimitDetail?.totalHits,
      retryAfterSeconds: seconds,
    }));

    if (res && typeof res.header === 'function') {
      res.header('Retry-After', seconds.toString());
    } else if (res && typeof res.setHeader === 'function') {
      res.setHeader('Retry-After', seconds.toString());
    }

    const message = await this.getErrorMessage(context, throttlerLimitDetail);
    throw new ThrottlerException(message);
  }
}
