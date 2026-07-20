import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerStorageRedisService } from 'nestjs-throttler-storage-redis';
import { ConfigurationModule } from '../configuration/configuration.module';
import { ConfigurationService } from '../configuration/configuration.service';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [ConfigurationModule],
      inject: [ConfigurationService],
      useFactory: (config: ConfigurationService) => ({
        throttlers: [
          { name: 'default', ttl: 60000, limit: 100 },
          { name: 'authentication', ttl: 60000, limit: 5 },
          { name: 'login', ttl: 60000, limit: 10 },
          { name: 'upload', ttl: 3600000, limit: 100 },
          { name: 'report', ttl: 3600000, limit: 20 },
        ],
        storage: new ThrottlerStorageRedisService(config.redisUrl),
      }),
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class RateLimitingModule {}
