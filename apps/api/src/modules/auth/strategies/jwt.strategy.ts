import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigurationService } from '../../platform/configuration/configuration.service';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { ActorContext } from '../../../common/interfaces/actor-context.interface';
import { RoleType, UserStatus } from '@prisma/client';
import { resolvePermittedWorkspaces } from '../../../common/guards/workspace-access.guard';

const cookieExtractor = (req: Request) => {
  let token = null;
  if (req && req.cookies) {
    token = req.cookies['access_token'];
  }
  return token;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigurationService) {
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

    const primaryRole = (payload.role as RoleType) || RoleType.SALES_AGENT;
    const allRoles = payload.roles
      ? (payload.roles as RoleType[])
      : [primaryRole];

    if (!payload.organizationId) {
      throw new UnauthorizedException('Missing organization context — access denied.');
    }

    const actor: ActorContext = {
      userId: payload.sub,
      email: payload.email,
      firstName: payload.firstName || '',
      lastName: payload.lastName || '',
      organizationId: payload.organizationId,
      companyId: payload.organizationId,
      branchId: payload.branchId,
      branchCode: payload.branchCode,
      departmentId: payload.departmentId,
      teamId: payload.teamId,
      role: primaryRole,
      roles: allRoles,
      permissions: payload.permissions || [],
      workspaces: [],
      status: payload.status || UserStatus.ACTIVE,
    };

    actor.workspaces = resolvePermittedWorkspaces(actor);
    return actor;
  }
}
