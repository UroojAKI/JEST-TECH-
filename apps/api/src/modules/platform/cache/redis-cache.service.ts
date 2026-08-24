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
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      retryStrategy(times) {
        return Math.min(times * 100, 3000);
      },
    });
    this.client.on('error', () => {
      // Suppress unhandled error log spam when Redis is offline
    });
  }

  onModuleDestroy() {
    if (this.client) {
      this.client.disconnect();
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.client.get(key);
      if (!data) return null;
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
    try {
      const data = JSON.stringify(value);
      await this.client.set(key, data, 'EX', ttlSeconds);
    } catch {
      // Fallback: omit cache on write error
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch {
      // Fallback
    }
  }

  async clear(prefix: string): Promise<void> {
    try {
      const keys = await this.client.keys(`jest:cache:${prefix}*`);
      if (keys.length > 0) {
        const keysWithoutPrefix = keys.map((k) => k.replace('jest:cache:', ''));
        await this.client.del(...keysWithoutPrefix);
      }
    } catch {
      // Fallback
    }
  }

  async ping(): Promise<number> {
    if (!this.client) return -1;
    try {
      const start = Date.now();
      await this.client.ping();
      return Date.now() - start;
    } catch {
      return -1;
    }
  }
}
