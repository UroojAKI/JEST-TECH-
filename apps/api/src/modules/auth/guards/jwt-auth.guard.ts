import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthorizationVersionService } from '../services/authorization-version.service';
import { JwtService } from '@nestjs/jwt';

function decodeJwtPayload(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
    }
  } catch {}
  return null;
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    @Optional() private readonly authVersionService?: AuthorizationVersionService,
    @Optional() private readonly jwtService?: JwtService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const result = await (super.canActivate(context) as Promise<boolean>).catch(
      () => false,
    );

    if (!result) {
      throw new UnauthorizedException('Authentication required');
    }

    const req = context.switchToHttp().getRequest();
    
    // CSRF double-submit cookie check
    const isStateMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
    if (isStateMutating) {
      const csrfHeader = req.headers['x-csrf-token'];
      const csrfCookie = req.cookies?.['csrf_token'];
      if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
        throw new ForbiddenException('CSRF token mismatch');
      }
    }

    // Auth version check
    if (this.authVersionService) {
      const token = req.cookies?.['access_token'] || req.headers['authorization']?.split(' ')[1];
      if (token) {
        try {
          const payload = this.jwtService ? (this.jwtService.decode(token) as any) : decodeJwtPayload(token);
          if (payload && payload.sub && payload.authVersion) {
            const isValid = await this.authVersionService.checkVersion(payload.sub, payload.authVersion);
            if (!isValid) {
              throw new UnauthorizedException('Session invalidated');
            }
          }
        } catch (e) {
          if (e instanceof UnauthorizedException) throw e;
          // ignore
        }
      }
    }

    return true;
  }
}
