import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ICacheProvider } from './cache.provider';
import { ConfigurationService } from '../configuration/configuration.service';
import Redis from 'ioredis';

@Injectable()
export class RedisCacheService
  implements ICacheProvider, OnModuleInit, OnModuleDestroy
{
  private client: Redis;

  constructor(private readonly config: ConfigurationService) {}

  onModuleInit() {
    this.client = new Redis(this.config.redisUrl, {
      keyPrefix: 'jest:cache:',
    });
  }

  onModuleDestroy() {
    if (this.client) {
      this.client.disconnect();
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const data = await this.client.get(key);
    if (!data) return null;
    try {
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  }

  async set<T>(
    key: string,
    value: T,
    ttlSeconds: number = 3600,
  ): Promise<void> {
    const data = JSON.stringify(value);
    await this.client.set(key, data, 'EX', ttlSeconds);
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }

  async clear(prefix: string): Promise<void> {
    const keys = await this.client.keys(`jest:cache:${prefix}*`);
    if (keys.length > 0) {
      // Remove prefix manually since keys() returns keys WITH the prefix,
      // and del() automatically prepends the prefix again.
      const keysWithoutPrefix = keys.map((k) => k.replace('jest:cache:', ''));
      await this.client.del(...keysWithoutPrefix);
    }
  }

  async ping(): Promise<number> {
    if (!this.client) return -1;
    const start = Date.now();
    await this.client.ping();
    return Date.now() - start;
  }
}
