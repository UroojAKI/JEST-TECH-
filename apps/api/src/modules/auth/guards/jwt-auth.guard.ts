import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const result = await (super.canActivate(context) as Promise<boolean>).catch(
      () => false,
    );

    if (!result) {
      throw new UnauthorizedException('Authentication required');
    }

    return true;
  }
}

