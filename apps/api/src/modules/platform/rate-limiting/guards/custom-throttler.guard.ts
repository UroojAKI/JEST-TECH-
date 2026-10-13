import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ThrottlerRequest } from '@nestjs/throttler/dist/throttler.guard.interface';
import { THROTTLER_LIMIT } from '@nestjs/throttler/dist/throttler.constants';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
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
}
