import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { LookupValue } from '@prisma/client';

@Injectable()
export class LookupService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  /**
   * Fetches all active lookup values for a given category code, hierarchically organized.
   */
  async getByCategory(categoryCode: string): Promise<any[]> {
    const cacheKey = `lookup_category_${categoryCode}`;
    const cached = await this.cacheManager.get<any[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const category = await this.prisma.lookupCategory.findUnique({
      where: { code: categoryCode },
      include: {
        values: {
          where: { isActive: true },
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    if (!category || !category.isActive) {
      throw new NotFoundException(
        `Lookup category ${categoryCode} not found or inactive.`,
      );
    }

    // Build hierarchy
    const values = category.values;
    const hierarchy = this.buildHierarchy(values, null);

    await this.cacheManager.set(cacheKey, hierarchy, 3600 * 1000); // 1 hour cache
    return hierarchy;
  }

  private buildHierarchy(
    allValues: LookupValue[],
    parentId: string | null,
  ): any[] {
    return allValues
      .filter((v) => v.parentId === parentId)
      .map((v) => ({
        id: v.id,
        code: v.code,
        name: v.name,
        description: v.description,
        children: this.buildHierarchy(allValues, v.id),
      }));
  }

  async invalidateCache(categoryCode: string) {
    await this.cacheManager.del(`lookup_category_${categoryCode}`);
  }
}
