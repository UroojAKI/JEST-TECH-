import { Global, Module } from '@nestjs/common';
import { CACHE_PROVIDER_TOKEN } from './cache.provider';
import { RedisCacheService } from './redis-cache.service';

@Global()
@Module({
  providers: [
    {
      provide: CACHE_PROVIDER_TOKEN,
      useClass: RedisCacheService,
    },
  ],
  exports: [CACHE_PROVIDER_TOKEN],
})
export class CacheModule {}
