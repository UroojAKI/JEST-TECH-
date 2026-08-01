import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../../../../database/prisma.service';
import { IntegrationProvider } from '@prisma/client';

@Injectable()
export class ProviderRegistryService implements OnModuleInit {
  private readonly logger = new Logger(ProviderRegistryService.name);
  private cache: Map<string, IntegrationProvider[]> = new Map();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.refreshCache();
  }

  async refreshCache() {
    try {
      const providers = await this.prisma.integrationProvider.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { priority: 'asc' },
      });

      this.cache.clear();
      for (const provider of providers) {
        if (!this.cache.has(provider.type)) {
          this.cache.set(provider.type, []);
        }
        this.cache.get(provider.type)?.push(provider);
      }
      this.logger.log(
        `Provider registry cache refreshed. Found ${providers.length} active providers.`,
      );
    } catch (err: any) {
      this.logger.warn(
        `Provider registry cache refresh skipped (database offline or initializing): ${err.message}`,
      );
    }
  }

  getPrimaryProvider(type: string): IntegrationProvider | null {
    const providers = this.cache.get(type);
    if (!providers || providers.length === 0) {
      this.logger.warn(`No active providers found for type: ${type}`);
      return null;
    }
    return providers[0];
  }

  getFallbackProvider(
    type: string,
    failedProviderId: string,
  ): IntegrationProvider | null {
    const providers = this.cache.get(type);
    if (!providers) return null;

    const fallback = providers.find((p) => p.id !== failedProviderId);
    return fallback || null;
  }

  async recordFailure(providerId: string) {
    try {
      await this.prisma.integrationProvider.update({
        where: { id: providerId },
        data: { failureCount: { increment: 1 } },
      });
    } catch (err: any) {
      this.logger.warn(`Failed to record provider failure: ${err.message}`);
    }
  }

  async recordSuccess(providerId: string) {
    // Basic moving average simulation or just tick success
  }
}
