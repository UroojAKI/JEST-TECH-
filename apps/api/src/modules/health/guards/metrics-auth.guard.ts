import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Injectable()
export class MetricsAuthGuard extends JwtAuthGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const scrapeToken =
      process.env.METRICS_SCRAPE_TOKEN || process.env.METRICS_TOKEN;
    const authHeader = request.headers?.['authorization'];
    const customHeader = request.headers?.['x-metrics-token'];

    // Scraper authentication via secure token (>= 16 chars)
    if (scrapeToken && scrapeToken.length >= 16) {
      if (customHeader === scrapeToken) {
        return true;
      }
      if (authHeader === `Bearer ${scrapeToken}`) {
        return true;
      }
    }

    // Require valid JWT authentication
    let isAuthed = false;
    try {
      isAuthed = (await super.canActivate(context)) as boolean;
    } catch {
      throw new UnauthorizedException(
        'Authentication required to access metrics',
      );
    }

    if (!isAuthed) {
      throw new UnauthorizedException(
        'Authentication required to access metrics',
      );
    }

    const user = request.user;
    const userRoles = (user?.roles?.length ? user.roles : [user?.role]).filter(
      Boolean,
    );
    if (userRoles.some((r: string) => r === RoleType.ADMIN || r === 'ADMIN')) {
      return true;
    }

    throw new ForbiddenException(
      'Access denied. Metrics endpoint requires ADMIN role or valid scrape token',
    );
  }
}
