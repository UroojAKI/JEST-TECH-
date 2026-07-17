import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { ConfigService } from '@nestjs/config';
import { AuditAction } from '@prisma/client';

import { UsersService } from '../../users/services/users.service';
import { TokenService } from './token.service';
import { LoginDto } from '../dto/login.dto';

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

    // ── 2. Verify password ───────────────────────────────────────────────────
    const passwordValid = await argon2.verify(
      user.passwordHash,
      dto.password,
    );

    if (!passwordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // ── 3. Build JWT payload ─────────────────────────────────────────────────
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role.code,
    };

    // ── 4. Generate tokens ───────────────────────────────────────────────────
    const [accessToken, refreshToken] = await Promise.all([
      this.tokenService.generateAccessToken(payload),
      this.tokenService.generateRefreshToken(payload),
    ]);

    // ── 5. Compute refresh token expiry for DB storage ───────────────────────
    const refreshExpiresIn = this.config.get<string>('jwt.refreshExpiresIn') ?? '30d';
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
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Parses duration strings like "15m", "30d", "1h" into a future Date.
  // Used to store the refresh token expiry in the database.
  // ---------------------------------------------------------------------------
  private parseExpiry(duration: string): Date {
    const unit = duration.slice(-1);
    const value = parseInt(duration.slice(0, -1), 10);
    const ms = {
      s: 1_000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
    }[unit] ?? 86_400_000;

    return new Date(Date.now() + value * ms);
  }
}
