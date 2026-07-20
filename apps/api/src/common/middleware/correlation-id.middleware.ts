import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { correlationStorage } from '../logger/correlation.context';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const supplied = req.headers['x-correlation-id'] as string;
    const correlationId = (supplied && /^[a-f0-9-]{36}$/.test(supplied))
      ? supplied
      : randomUUID();
    req.headers['x-correlation-id'] = correlationId;
    res.setHeader('x-correlation-id', correlationId);

    correlationStorage.run(correlationId, () => {
      next();
    });
  }
}
