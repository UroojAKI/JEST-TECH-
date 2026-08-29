import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ActorContext } from '../../../common/interfaces/actor-context.interface';

export interface RequestUser extends ActorContext {
  id: string;
}

/**
 * Extracts the authenticated ActorContext from the JWT payload attached
 * to request.user by JwtStrategy.validate().
 *
 * Usage: @CurrentUser() user: RequestUser
 *    or: @Actor() actor: ActorContext
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user || {};
    return {
      id: user.userId || user.id,
      ...user,
    } as RequestUser;
  },
);

export const Actor = CurrentUser;
