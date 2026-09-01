import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigurationService } from '../../platform/configuration/configuration.service';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { ActorContext } from '../../../common/interfaces/actor-context.interface';
import { RoleType, UserStatus } from '@prisma/client';
import { resolvePermittedWorkspaces } from '../../../common/guards/workspace-access.guard';
import { PrismaService } from '../../../database/prisma.service';

const cookieExtractor = (req: Request) => {
  let token = null;
  if (req && req.cookies) {
    token = req.cookies['access_token'];
  }
  return token;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigurationService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.jwtSecret,
    });
  }

  async validate(payload: {
    sub: string;
    email: string;
    role: string;
    roles?: string[];
    permissions?: string[];
    organizationId?: string;
    branchId?: string;
    branchCode?: string;
    departmentId?: string;
    teamId?: string;
    firstName?: string;
    lastName?: string;
    status?: UserStatus;
  }): Promise<ActorContext> {
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid token claims');
    }

    // JWT proves possession of the session token; current authorization state
    // is loaded from the database so role/status/branch changes take effect
    // without waiting for an old access token to expire.
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        teamId: true,
        departmentId: true,
        branchId: true,
        role: {
          select: {
            type: true,
            permissions: {
              select: {
                permission: { select: { code: true } },
              },
            },
          },
        },
        branch: {
          select: {
            code: true,
            zone: {
              select: {
                region: {
                  select: {
                    company: { select: { id: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User account no longer exists');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException(
        `User account is ${user.status.toLowerCase()}`,
      );
    }

    const primaryRole = user.role?.type || (payload.role as RoleType);
    if (!primaryRole) {
      throw new UnauthorizedException('User role is not configured');
    }

    const organizationId =
      user.branch?.zone?.region?.company?.id || payload.organizationId;

    if (!organizationId) {
      throw new UnauthorizedException(
        'Missing organization context — access denied.',
      );
    }

    const permissions = user.role?.permissions
      ?.map((entry) => entry.permission.code)
      .filter(Boolean) || [];

    const actor: ActorContext = {
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      organizationId,
      companyId: organizationId,
      branchId: user.branchId || undefined,
      branchCode: user.branch?.code || undefined,
      departmentId: user.departmentId || undefined,
      teamId: user.teamId || undefined,
      role: primaryRole,
      roles: [primaryRole],
      permissions,
      workspaces: [],
      status: user.status,
    };

    actor.workspaces = resolvePermittedWorkspaces(actor);
    return actor;
  }
}
