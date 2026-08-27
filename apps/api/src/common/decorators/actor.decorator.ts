import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ActorContext } from '../interfaces/actor-context.interface';

/**
 * Universal @Actor() parameter decorator.
 * Extracts the authenticated ActorContext from request.user.
 *
 * Usage:
 *   @Get()
 *   async getMyRecords(@Actor() actor: ActorContext) { ... }
 */
export const Actor = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ActorContext => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as ActorContext;
  },
);
