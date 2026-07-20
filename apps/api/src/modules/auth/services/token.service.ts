import { Injectable } from '@nestjs/common';
import { ConfigurationService } from '../../platform/configuration/configuration.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigurationService,
  ) {}

  async generateAccessToken(payload: Record<string, unknown>): Promise<string> {
    return this.jwtService.signAsync(payload);
    // secret and expiresIn come from JwtModule.registerAsync in auth.module.ts
  }

  async generateRefreshToken(
    payload: Record<string, unknown>,
  ): Promise<string> {
    return this.jwtService.signAsync(payload, {
      secret: this.config.jwtRefreshSecret,
      expiresIn: this.config.jwtRefreshExpiresIn as any,
    });
  }

  async verifyRefreshToken(token: string): Promise<Record<string, unknown>> {
    return this.jwtService.verifyAsync(token, {
      secret: this.config.jwtRefreshSecret,
    });
  }
}
