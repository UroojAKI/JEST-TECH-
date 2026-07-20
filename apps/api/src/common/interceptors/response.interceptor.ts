import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface StandardResponse<T> {
  success: boolean;
  data: T;
  meta: {
    requestId: string;
    timestamp: string;
    version: string;
  };
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  StandardResponse<T> | T
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<StandardResponse<T> | T> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse();

    return next.handle().pipe(
      map((data) => {
        // If data is null or undefined
        if (data === undefined) {
          data = null as any;
        }

        // If response headers are already sent or this is a stream/buffer download, bypass mapping
        if (
          response.headersSent ||
          data instanceof Buffer ||
          (data && typeof data.pipe === 'function')
        ) {
          return data;
        }

        // If data is already in the standardized envelope format, bypass
        if (
          data &&
          typeof data === 'object' &&
          'success' in data &&
          'meta' in data
        ) {
          return data;
        }

        const correlationId =
          request.headers['x-correlation-id'] ||
          request.correlationId ||
          'system';

        return {
          success: true,
          data,
          meta: {
            requestId: correlationId,
            timestamp: new Date().toISOString(),
            version: 'v1',
          },
        };
      }),
    );
  }
}
