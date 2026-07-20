import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { EnvConfig } from './env.schema';

@Injectable()
export class ConfigurationService {
  constructor(
    private readonly configService: NestConfigService<EnvConfig, true>,
  ) {}

  get isProduction(): boolean {
    return this.configService.get('NODE_ENV') === 'production';
  }

  get port(): number {
    return this.configService.get('PORT');
  }

  get appName(): string {
    return this.configService.get('APP_NAME');
  }

  get databaseUrl(): string {
    return this.configService.get('DATABASE_URL');
  }

  get jwtSecret(): string {
    return this.configService.get('JWT_SECRET');
  }

  get jwtExpiresIn(): string {
    return this.configService.get('JWT_EXPIRES_IN');
  }

  get jwtRefreshSecret(): string {
    return this.configService.get('JWT_REFRESH_SECRET');
  }

  get jwtRefreshExpiresIn(): string {
    return this.configService.get('JWT_REFRESH_EXPIRES_IN');
  }

  get redisUrl(): string {
    return this.configService.get('REDIS_URL');
  }

  get allowedOrigins(): string[] {
    const origins = this.configService.get('ALLOWED_ORIGINS');
    return origins.split(',').map((o) => o.trim());
  }
}
