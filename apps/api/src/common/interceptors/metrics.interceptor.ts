import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { apiDurationHistogram } from '../../modules/health/metrics.controller';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const { method, route, url } = req;
    const path = route ? route.path : url;
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const res = context.switchToHttp().getResponse();
          const duration = Date.now() - start;
          apiDurationHistogram
            .labels(method, path, res.statusCode.toString())
            .observe(duration);
        },
        error: (err) => {
          const status = err.status || 500;
          const duration = Date.now() - start;
          apiDurationHistogram
            .labels(method, path, status.toString())
            .observe(duration);
        },
      }),
    );
  }
}
