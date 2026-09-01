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
  constructor(private readonly usersService: UsersService, private readonly tokenService: TokenService, private readonly config: ConfigService) {}

  private requireOrganization(user: any): string {
    const orgId = user?.branch?.zone?.region?.company?.id;
    if (!orgId) throw new UnauthorizedException('Missing organizational tenant context. User must belong to an active organization.');
    return orgId;
  }

  private buildPayload(user: any, organizationId: string, permissions: string[], roleType: RoleType) {
    return {
      sub: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName,
      role: roleType, roles: [roleType], permissions, organizationId,
      branchId: user.branchId || undefined, branchCode: user.branch?.code || undefined,
      departmentId: user.departmentId || undefined, teamId: user.teamId || undefined, status: user.status,
    };
  }

  private responsePayload(user: any, accessToken: string, refreshToken: string, expiresIn: string | undefined, permissions: string[], organizationId: string, roleType: RoleType) {
    const permittedWorkspaces = resolvePermittedWorkspaces({
      userId: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName,
      organizationId, companyId: organizationId, branchId: user.branchId || undefined, teamId: user.teamId || undefined,
      role: roleType, roles: [roleType], permissions, workspaces: [], status: user.status,
    });
    return {
      accessToken, refreshToken, expiresIn,
      user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role.code, roles: [roleType], permissions, organizationId, branchId: user.branchId, teamId: user.teamId },
      workspaces: permittedWorkspaces,
      landingWorkspace: this.resolveDefaultLandingWorkspace(roleType),
    };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmailForAuth(dto.email);
    if (!user) throw new UnauthorizedException('Invalid email or password');
    if (user.status !== 'ACTIVE') throw new ForbiddenException('User account is inactive or locked');
    if (!(await argon2.verify(user.passwordHash, dto.password))) throw new UnauthorizedException('Invalid email or password');

    const permissions = user.role.permissions ? user.role.permissions.map((p) => p.permission.code) : [];
    const organizationId = this.requireOrganization(user);
    const roleType = user.role.type || user.role.code;
    const payload = this.buildPayload(user, organizationId, permissions, roleType);
    const [accessToken, refreshToken] = await Promise.all([this.tokenService.generateAccessToken(payload), this.tokenService.generateRefreshToken(payload)]);
    const refreshExpiresIn = this.config.get<string>('jwt.refreshExpiresIn') ?? '30d';
    const expiresAt = this.parseExpiry(refreshExpiresIn);
    const tokenHash = await argon2.hash(refreshToken);
    await Promise.all([
      this.usersService.updateLastLogin(user.id),
      this.usersService.storeRefreshToken({ userId: user.id, tokenHash, expiresAt }),
      this.usersService.createAuditLog({ userId: user.id, action: AuditAction.LOGIN, entity: 'User', entityId: user.id }),
    ]);
    return this.responsePayload(user, accessToken, refreshToken, this.config.get<string>('jwt.expiresIn'), permissions, organizationId, roleType);
  }

  resolveDefaultLandingWorkspace(role: RoleType | string): string {
    const r = (role || '').toString().toUpperCase();
    if (r.includes('SUPER_ADMIN') || r.includes('ADMIN')) return '/workspace/admin';
    if (r.includes('MD_CEO') || r.includes('MANAGEMENT') || r.includes('DIRECTOR') || r.includes('BRANCH_MANAGER')) return '/workspace/executive';
    if (r.includes('SALES_MANAGER') || r.includes('TEAM_LEADER')) return '/workspace/sales-manager';
    if (r.includes('SALES') || r.includes('POSP') || r.includes('AGENT')) return '/workspace/sales';
    if (r.includes('FINANCE') || r.includes('ACCOUNTS')) return '/workspace/finance';
    if (r.includes('OPERATIONS') || r.includes('POLICY_ISSUANCE') || r.includes('UNDERWRITER') || r.includes('BACK_OFFICE') || r.includes('INSPECTOR')) return '/workspace/operations';
    if (r.includes('RENEWAL')) return '/workspace/renewal';
    if (r.includes('CLAIMS') || r.includes('SUPPORT')) return '/claims';
    if (r.includes('COMPLIANCE')) return '/admin/audit';
    return '/workspace';
  }

  async refresh(refreshToken: string) {
    if (!refreshToken) throw new UnauthorizedException('Refresh token missing');
    let payload: any;
    try { payload = await this.tokenService.verifyRefreshToken(refreshToken); } catch { throw new UnauthorizedException('Invalid or expired refresh token'); }
    const user = await this.usersService.findByEmailForAuth(payload.email);
    if (!user) throw new UnauthorizedException('User no longer exists');
    if (user.status !== 'ACTIVE') throw new ForbiddenException('User account is inactive or locked');
    const activeTokens = await this.usersService.findActiveRefreshTokens(user.id);
    let matchedTokenId: string | null = null;
    for (const record of activeTokens) { if (await argon2.verify(record.tokenHash, refreshToken)) { matchedTokenId = record.id; break; } }
    if (!matchedTokenId) throw new UnauthorizedException('Refresh token has been revoked or is invalid');
    await this.usersService.revokeRefreshToken(matchedTokenId);

    const permissions = user.role.permissions ? user.role.permissions.map((p) => p.permission.code) : [];
    const organizationId = this.requireOrganization(user);
    const roleType = user.role.type || user.role.code;
    const newPayload = this.buildPayload(user, organizationId, permissions, roleType);
    const [newAccessToken, newRefreshToken] = await Promise.all([this.tokenService.generateAccessToken(newPayload), this.tokenService.generateRefreshToken(newPayload)]);
    const refreshExpiresIn = this.config.get<string>('jwt.refreshExpiresIn') ?? '30d';
    const expiresAt = this.parseExpiry(refreshExpiresIn);
    const tokenHash = await argon2.hash(newRefreshToken);
    await this.usersService.storeRefreshToken({ userId: user.id, tokenHash, expiresAt });
    return this.responsePayload(user, newAccessToken, newRefreshToken, this.config.get<string>('jwt.expiresIn'), permissions, organizationId, roleType);
  }

  async logout(userId: string): Promise<void> { if (userId) await this.usersService.revokeAllUserRefreshTokens(userId); }

  private parseExpiry(duration: string): Date {
    const unit = duration.slice(-1); const value = parseInt(duration.slice(0, -1), 10);
    const ms = ({ s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 } as Record<string, number>)[unit] ?? 86_400_000;
    return new Date(Date.now() + value * ms);
  }
}
