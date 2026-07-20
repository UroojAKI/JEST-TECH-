import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { SystemConfigKey } from '../../../constants/system-config-key.enum';

@Injectable()
export class SystemConfigService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async getValue<T>(key: SystemConfigKey, defaultValue?: T): Promise<T> {
    const cacheKey = `system_config_${key}`;
    const cached = await this.cacheManager.get<T>(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    const config = await this.prisma.systemConfig.findUnique({
      where: { key: key.toString() },
    });

    if (!config) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw new NotFoundException(`Configuration key ${key} not found.`);
    }

    let parsedValue: T;
    switch (config.valueType) {
      case 'NUMBER':
        parsedValue = Number(config.value) as unknown as T;
        break;
      case 'BOOLEAN':
        parsedValue = (config.value === 'true') as unknown as T;
        break;
      case 'JSON':
        parsedValue = JSON.parse(config.value) as T;
        break;
      default:
        parsedValue = config.value as unknown as T;
    }

    await this.cacheManager.set(cacheKey, parsedValue, 3600 * 1000); // 1 hour cache
    return parsedValue;
  }

  async setValue(key: SystemConfigKey, value: any, valueType: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON'): Promise<void> {
    let stringValue = String(value);
    if (valueType === 'JSON') {
      stringValue = JSON.stringify(value);
    }

    await this.prisma.systemConfig.upsert({
      where: { key: key.toString() },
      update: { value: stringValue, valueType },
      create: {
        key: key.toString(),
        value: stringValue,
        valueType,
      },
    });

    await this.cacheManager.del(`system_config_${key}`);
  }

  async getAllPublicConfigs(): Promise<Record<string, any>> {
    const configs = await this.prisma.systemConfig.findMany({
      where: { isPublic: true },
    });

    const result: Record<string, any> = {};
    for (const config of configs) {
      switch (config.valueType) {
        case 'NUMBER':
          result[config.key] = Number(config.value);
          break;
        case 'BOOLEAN':
          result[config.key] = config.value === 'true';
          break;
        case 'JSON':
          result[config.key] = JSON.parse(config.value);
          break;
        default:
          result[config.key] = config.value;
      }
    }
    return result;
  }
}
