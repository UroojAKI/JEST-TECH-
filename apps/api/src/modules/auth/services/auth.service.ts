import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { AuditAction, RoleType } from '@prisma/client';
import { UsersService } from '../../users/services/users.service';
import { TokenService } from './token.service';
import { LoginDto } from '../dto/login.dto';
import { resolvePermittedWorkspaces } from '../../../common/guards/workspace-access.guard';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly tokenService: TokenService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private requireOrganization(user: any): string {
    const orgId =
      user?.companyId ??
      user?.branch?.zone?.region?.company?.id ??
      user?.organizationId;
    if (!orgId)
      throw new UnauthorizedException(
        'Missing organizational tenant context. User must belong to an active organization.',
      );
    return orgId;
  }

  private buildPayload(
    user: any,
    organizationId: string,
    permissions: string[],
    roleType: RoleType,
  ) {
    return {
      sub: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: roleType,
      roles: [roleType],
      permissions,
      organizationId,
      companyId: organizationId,
      branchId: user.branchId || undefined,
      branchCode: user.branch?.code || undefined,
      departmentId: user.departmentId || undefined,
      teamId: user.teamId || undefined,
      status: user.status,
      authVersion: user.authVersion ?? 1,
    };
  }

  private responsePayload(
    user: any,
    accessToken: string,
    refreshToken: string,
    expiresIn: string | undefined,
    permissions: string[],
    organizationId: string,
    roleType: RoleType,
  ) {
    const permittedWorkspaces = resolvePermittedWorkspaces({
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      organizationId,
      companyId: organizationId,
      branchId: user.branchId || undefined,
      teamId: user.teamId || undefined,
      role: roleType,
      roles: [roleType],
      permissions,
      workspaces: [],
      status: user.status,
    });
    return {
      accessToken,
      refreshToken,
      expiresIn,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role.code,
        roles: [roleType],
        permissions,
        organizationId,
        companyId: organizationId,
        branchId: user.branchId,
        teamId: user.teamId,
      },
      workspaces: permittedWorkspaces,
      landingWorkspace: this.resolveDefaultLandingWorkspace(roleType),
    };
  }

  async login(dto: LoginDto) {
    // Use a single constant-time error message for all authentication failures.
    // This prevents account-status enumeration (distinguishing between
    // 'account doesn't exist' vs 'account is locked' via error codes).
    const genericAuthError = new UnauthorizedException(
      'Invalid email or password',
    );

    const user = await this.usersService.findByEmailForAuth(dto.email);
    if (!user) throw genericAuthError;

    // SEC-011 FIX: Account lockout — count failed LOGIN attempts in the last 15 minutes.
    // Uses existing AuditLog with metadata.event='FAILED_LOGIN' marker (no schema change needed).
    const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
    const MAX_FAILED_ATTEMPTS = 5;
    const windowStart = new Date(Date.now() - LOCKOUT_WINDOW_MS);

    const recentFailures = await this.prisma.auditLog.count({
      where: {
        userId: user.id,
        action: AuditAction.LOGIN,
        module: 'AUTH_FAILED',
        createdAt: { gte: windowStart },
      },
    }).catch(() => 0); // fail-open: if audit table unavailable, proceed

    if (recentFailures >= MAX_FAILED_ATTEMPTS) {
      // Record another failure attempt — still generic error externally
      this.prisma.auditLog.create({
        data: {
          action: AuditAction.LOGIN,
          entity: 'User',
          entityId: user.id,
          userId: user.id,
          module: 'AUTH_FAILED',
          metadata: { reason: 'Lockout threshold exceeded', email: dto.email },
        },
      }).catch(() => {});
      throw genericAuthError;
    }

    // Verify password before checking account status to prevent timing attacks
    // that could reveal account existence via response time difference.
    const passwordValid = await argon2.verify(user.passwordHash, dto.password);
    if (!passwordValid) {
      // Record failed attempt in audit log for lockout tracking
      this.prisma.auditLog.create({
        data: {
          action: AuditAction.LOGIN,
          entity: 'User',
          entityId: user.id,
          userId: user.id,
          module: 'AUTH_FAILED',
          metadata: { reason: 'Invalid password', email: dto.email },
        },
      }).catch(() => {});
      throw genericAuthError;
    }

    // Check account status AFTER password verification — same error externally
    if (user.status !== 'ACTIVE') throw genericAuthError;

    const updatedUser = await this.usersService.updateLastLogin(user.id);
    const effectiveUser = {
      ...user,
      updatedAt: updatedUser?.updatedAt || new Date(),
    };

    const permissions = user.role?.permissions
      ? user.role.permissions.map((p) => p.permission.code)
      : [];
    const organizationId = this.requireOrganization(user);
    const roleType = (user.role?.type || user.role?.code) as RoleType;
    const payload = this.buildPayload(
      effectiveUser,
      organizationId,
      permissions,
      roleType,
    );
    const [accessToken, refreshToken] = await Promise.all([
      this.tokenService.generateAccessToken(payload),
      this.tokenService.generateRefreshToken(payload),
    ]);
    const refreshExpiresIn =
      this.config.get<string>('jwt.refreshExpiresIn') ?? '30d';
    const expiresAt = this.parseExpiry(refreshExpiresIn);

    // Fix: Use SHA-256 instead of Argon2 for high-entropy tokens to prevent
    // O(N) algorithmic complexity DoS during token lookup.
    const tokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    await Promise.all([
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
    return this.responsePayload(
      user,
      accessToken,
      refreshToken,
      this.config.get<string>('jwt.expiresIn'),
      permissions,
      organizationId,
      roleType,
    );
  }

  resolveDefaultLandingWorkspace(role: RoleType | string): string {
    const r = (role || '').toString().toUpperCase();
    if (r === 'ADMIN' || r.includes('ADMIN')) {
      return '/workspace/admin';
    }
    if (
      r === 'BACK_OFFICE' ||
      r.includes('BACK_OFFICE') ||
      r.includes('OPERATIONS')
    ) {
      return '/workspace/operations';
    }
    if (r === 'AGENT' || r.includes('AGENT') || r.includes('SALES')) {
      return '/workspace/sales';
    }
    return '/workspace';
  }

  async refresh(refreshToken: string) {
    if (!refreshToken) throw new UnauthorizedException('Refresh token missing');
    let payload: any;
    try {
      payload = await this.tokenService.verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    const user = await this.usersService.findByEmailForAuth(payload.email);
    if (!user) throw new UnauthorizedException('User no longer exists');
    if (user.status !== 'ACTIVE')
      throw new ForbiddenException('User account is inactive or locked');

    // Look up token across all user tokens (including revoked ones for replay detection)
    const userTokens = await this.usersService.findUserRefreshTokens(user.id);
    let matchedRecord: any = null;

    // Hash the incoming token using SHA-256 for fast O(1) comparison
    const incomingTokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    for (const record of userTokens) {
      // For fast lookups, we simply compare the SHA-256 hashes.
      // (Note: Legacy Argon2 hashes in the DB will gracefully fail to match,
      // safely forcing a re-login and preventing CPU exhaustion DoS).
      if (record.tokenHash === incomingTokenHash) {
        matchedRecord = record;
        break;
      }
    }

    // Case A: Token not found / malformed / expired
    if (!matchedRecord) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Case B: Token found but already revoked -> REPLAY ATTACK DETECTED
    if (matchedRecord.revokedAt) {
      await this.prisma.$transaction([
        this.prisma.refreshToken.updateMany({
          where: { userId: user.id, revokedAt: null },
          data: { revokedAt: new Date() },
        }),
        this.prisma.user.update({
          where: { id: user.id },
          data: { authVersion: { increment: 1 } },
        }),
        this.prisma.auditLog.create({
          data: {
            userId: user.id,
            action: AuditAction.LOGIN,
            entity: 'RefreshToken',
            entityId: matchedRecord.id,
            metadata: {
              reason: 'REFRESH_TOKEN_REPLAY_DETECTED',
              replayedTokenId: matchedRecord.id,
            },
          },
        }),
      ]);
      throw new UnauthorizedException(
        'Security alert: Refresh token replay detected. All sessions terminated.',
      );
    }

    // Case C: Check expiry
    if (matchedRecord.expiresAt && matchedRecord.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Atomic token rotation: revoke old token AND store new token in a single transaction.
    // This prevents concurrent refresh races from issuing two active tokens.
    const permissions = user.role?.permissions
      ? user.role.permissions.map((p: any) => p.permission.code)
      : [];
    const organizationId = this.requireOrganization(user);
    const roleType = (user.role?.type || user.role?.code) as RoleType;
    const newPayload = this.buildPayload(
      user,
      organizationId,
      permissions,
      roleType,
    );
    const [newAccessToken, newRefreshToken] = await Promise.all([
      this.tokenService.generateAccessToken(newPayload),
      this.tokenService.generateRefreshToken(newPayload),
    ]);
    const refreshExpiresIn =
      this.config.get<string>('jwt.refreshExpiresIn') ?? '30d';
    const expiresAt = this.parseExpiry(refreshExpiresIn);
    const tokenHash = await argon2.hash(newRefreshToken);

    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: matchedRecord.id },
        data: { revokedAt: new Date() },
      }),
      this.prisma.refreshToken.create({
        data: { userId: user.id, tokenHash, expiresAt },
      }),
    ]);
    return this.responsePayload(
      user,
      newAccessToken,
      newRefreshToken,
      this.config.get<string>('jwt.expiresIn'),
      permissions,
      organizationId,
      roleType,
    );
  }

  async logout(userId: string): Promise<void> {
    if (userId) await this.usersService.revokeAllUserRefreshTokens(userId);
  }

  private parseExpiry(duration: string): Date {
    const unit = duration.slice(-1);
    const value = parseInt(duration.slice(0, -1), 10);
    const ms =
      (
        { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 } as Record<
          string,
          number
        >
      )[unit] ?? 86_400_000;
    return new Date(Date.now() + value * ms);
  }
}
