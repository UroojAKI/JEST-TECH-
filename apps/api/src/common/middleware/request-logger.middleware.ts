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

      // Ensure req.user is typed or cast to any if unknown
      const user = (req as any).user;
      const userId = user?.id || 'anonymous';

      const logPayload = {
        method,
        url: originalUrl,
        statusCode,
        executionTimeMs,
        ip,
        userAgent,
        userId,
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
