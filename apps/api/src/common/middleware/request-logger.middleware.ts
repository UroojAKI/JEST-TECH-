import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { StructuredLoggerService } from '../logger/structured-logger.service';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new StructuredLoggerService();

  constructor() {
    this.logger.setContext('HTTP');
  }

  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    const { method, originalUrl, ip, headers } = req;
    const userAgent = headers['user-agent'] || '';

    res.on('finish', () => {
      const { statusCode } = res;
      const executionTimeMs = Date.now() - start;

      // JwtStrategy exposes ActorContext.userId (not necessarily id). The old
      // id-only lookup therefore labelled authenticated traffic as anonymous.
      const user = (req as any).user;
      const userId = user?.userId || user?.id || user?.sub || 'anonymous';
      const companyId = user?.companyId || user?.organizationId || null;
      const role = user?.role || user?.roles?.[0] || null;
      const correlationId = headers['x-correlation-id'] || headers['x-request-id'] || (req as any).correlationId || null;

      const logPayload = {
        method,
        url: originalUrl,
        statusCode,
        executionTimeMs,
        ip,
        userAgent,
        userId,
        companyId,
        role,
        correlationId,
      };

      if (statusCode >= 500) {
        this.logger.error(logPayload);
      } else if (statusCode >= 400) {
        this.logger.warn(logPayload);
      } else {
        this.logger.log(logPayload);
      }
    });

    next();
  }
}
