import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { ConfigService } from '@nestjs/config';
import { AuditAction, RoleType } from '@prisma/client';

import { UsersService } from '../../users/services/users.service';
import { TokenService } from './token.service';
import { LoginDto } from '../dto/login.dto';
import { resolvePermittedWorkspaces } from '../../../common/guards/workspace-access.guard';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly tokenService: TokenService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    // ── 1. Validate email ────────────────────────────────────────────────────
    const user = await this.usersService.findByEmailForAuth(dto.email);

    if (!user) {
      // Identical message for both failures — prevents user enumeration
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException('User account is inactive or locked');
    }

    // ── 2. Verify password ───────────────────────────────────────────────────
    const passwordValid = await argon2.verify(user.passwordHash, dto.password);

    if (!passwordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // ── 3. Build JWT payload ─────────────────────────────────────────────────
    const permissions = user.role.permissions
      ? user.role.permissions.map((p) => p.permission.code)
      : [];

    const orgId = (user as any).branch?.zone?.region?.company?.id || 'DEFAULT_ORG';
    const roleType = user.role.type || user.role.code;

    const payload = {
      sub: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: roleType,
      roles: [roleType],
      permissions,
      organizationId: orgId,
      branchId: user.branchId || undefined,
      branchCode: (user as any).branch?.code || undefined,
      departmentId: user.departmentId || undefined,
      teamId: user.teamId || undefined,
      status: user.status,
    };

    // ── 4. Generate tokens ───────────────────────────────────────────────────
    const [accessToken, refreshToken] = await Promise.all([
      this.tokenService.generateAccessToken(payload),
      this.tokenService.generateRefreshToken(payload),
    ]);

    // ── 5. Compute refresh token expiry for DB storage ───────────────────────
    const refreshExpiresIn =
      this.config.get<string>('jwt.refreshExpiresIn') ?? '30d';
    const expiresAt = this.parseExpiry(refreshExpiresIn);

    // ── 6. Persist refresh token hash (never store the raw token) ───────────
    const tokenHash = await argon2.hash(refreshToken);

    // ── 7. Parallel side-effects (non-blocking for the response) ────────────
    await Promise.all([
      this.usersService.updateLastLogin(user.id),

      this.usersService.storeRefreshToken({
        userId: user.id,
        tokenHash,
        expiresAt,
      }),

      this.usersService.createAuditLog({
        userId: user.id,
        action: AuditAction.LOGIN,
        entity: 'User',
        entityId: user.id,
      }),
    ]);

    const permittedWorkspaces = resolvePermittedWorkspaces({
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      organizationId: orgId,
      companyId: orgId,
      branchId: user.branchId || undefined,
      teamId: user.teamId || undefined,
      role: roleType,
      roles: [roleType],
      permissions,
      workspaces: [],
      status: user.status,
    });

    const landingWorkspace = this.resolveDefaultLandingWorkspace(roleType);

    // ── 8. Return secure login response ─────────────────────────────────────
    return {
      accessToken,
      refreshToken,
      expiresIn: this.config.get<string>('jwt.expiresIn'),
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role.code,
        roles: [roleType],
        permissions,
        organizationId: orgId,
        branchId: user.branchId,
        teamId: user.teamId,
      },
      workspaces: permittedWorkspaces,
      landingWorkspace,
    };
  }

  resolveDefaultLandingWorkspace(role: RoleType | string): string {
    const r = (role || '').toString().toUpperCase();
    if (r.includes('SUPER_ADMIN') || r.includes('ADMIN')) return '/workspace/admin';
    if (r.includes('MD_CEO') || r.includes('MANAGEMENT') || r.includes('DIRECTOR')) return '/workspace/executive';
    if (r.includes('BRANCH_MANAGER')) return '/workspace/executive';
    if (r.includes('SALES_MANAGER') || r.includes('TEAM_LEADER')) return '/workspace/sales-manager';
    if (r.includes('SALES') || r.includes('POSP') || r.includes('AGENT')) return '/workspace/sales';
    if (r.includes('FINANCE') || r.includes('ACCOUNTS')) return '/workspace/finance';
    if (
      r.includes('OPERATIONS') ||
      r.includes('POLICY_ISSUANCE') ||
      r.includes('UNDERWRITER') ||
      r.includes('BACK_OFFICE') ||
      r.includes('INSPECTOR')
    ) {
      return '/workspace/operations';
    }
    if (r.includes('RENEWAL')) return '/workspace/renewal';
    if (r.includes('CLAIMS') || r.includes('SUPPORT')) return '/claims';
    if (r.includes('COMPLIANCE')) return '/admin/audit';
    return '/workspace';
  }

  async refresh(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token missing');
    }

    let payload: any;
    try {
      payload = await this.tokenService.verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.usersService.findByEmailForAuth(payload.email);
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    // Verify token against stored database hashes to ensure it hasn't been revoked
    const activeTokens = await this.usersService.findActiveRefreshTokens(user.id);
    let matchedTokenId: string | null = null;

    for (const record of activeTokens) {
      const isMatch = await argon2.verify(record.tokenHash, refreshToken);
      if (isMatch) {
        matchedTokenId = record.id;
        break;
      }
    }

    if (!matchedTokenId) {
      throw new UnauthorizedException('Refresh token has been revoked or is invalid');
    }

    // Revoke the old token (rotation)
    await this.usersService.revokeRefreshToken(matchedTokenId);

    const permissions = user.role.permissions
      ? user.role.permissions.map((p) => p.permission.code)
      : [];

    const orgId = (user as any).branch?.zone?.region?.company?.id || 'DEFAULT_ORG';
    const roleType = user.role.type || user.role.code;

    const newPayload = {
      sub: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: roleType,
      roles: [roleType],
      permissions,
      organizationId: orgId,
      branchId: user.branchId || undefined,
      branchCode: (user as any).branch?.code || undefined,
      departmentId: user.departmentId || undefined,
      teamId: user.teamId || undefined,
      status: user.status,
    };

    const [newAccessToken, newRefreshToken] = await Promise.all([
      this.tokenService.generateAccessToken(newPayload),
      this.tokenService.generateRefreshToken(newPayload),
    ]);

    const refreshExpiresIn =
      this.config.get<string>('jwt.refreshExpiresIn') ?? '30d';
    const expiresAt = this.parseExpiry(refreshExpiresIn);
    const tokenHash = await argon2.hash(newRefreshToken);

    await this.usersService.storeRefreshToken({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    const permittedWorkspaces = resolvePermittedWorkspaces({
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      organizationId: orgId,
      companyId: orgId,
      branchId: user.branchId || undefined,
      teamId: user.teamId || undefined,
      role: roleType,
      roles: [roleType],
      permissions,
      workspaces: [],
      status: user.status,
    });

    const landingWorkspace = this.resolveDefaultLandingWorkspace(roleType);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: this.config.get<string>('jwt.expiresIn'),
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role.code,
        roles: [roleType],
        permissions,
        organizationId: orgId,
        branchId: user.branchId,
        teamId: user.teamId,
      },
      workspaces: permittedWorkspaces,
      landingWorkspace,
    };
  }

  async logout(userId: string): Promise<void> {
    if (userId) {
      await this.usersService.revokeAllUserRefreshTokens(userId);
    }
  }


  // ---------------------------------------------------------------------------
  // Parses duration strings like "15m", "30d", "1h" into a future Date.
  // Used to store the refresh token expiry in the database.
  // ---------------------------------------------------------------------------
  private parseExpiry(duration: string): Date {
    const unit = duration.slice(-1);
    const value = parseInt(duration.slice(0, -1), 10);
    const ms =
      {
        s: 1_000,
        m: 60_000,
        h: 3_600_000,
        d: 86_400_000,
      }[unit] ?? 86_400_000;

    return new Date(Date.now() + value * ms);
  }
}
