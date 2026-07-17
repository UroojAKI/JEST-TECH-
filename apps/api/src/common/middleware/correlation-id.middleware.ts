import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { correlationStorage } from '../logger/correlation.context';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    let correlationId = req.headers['x-correlation-id'] as string;
    if (!correlationId) {
      correlationId = randomUUID();
      req.headers['x-correlation-id'] = correlationId;
    }
    res.setHeader('x-correlation-id', correlationId);

    correlationStorage.run(correlationId, () => {
      next();
    });
  }
}
