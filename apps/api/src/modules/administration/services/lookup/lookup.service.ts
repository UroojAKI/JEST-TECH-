import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
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

    let category = await this.prisma.lookupCategory.findUnique({
      where: { code: categoryCode },
      include: {
        values: {
          where: { isActive: true },
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    if (!category) {
      // Auto-create category to prevent frontend 404 errors for hardcoded categories
      category = await this.prisma.lookupCategory.create({
        data: {
          code: categoryCode,
          name: categoryCode.replace(/_/g, ' '),
          description: `Auto-generated category for ${categoryCode}`,
        },
        include: { values: true },
      }) as any;
    } else if (!category.isActive) {
      throw new NotFoundException(`Lookup category ${categoryCode} is inactive.`);
    }

    // Build hierarchy
    const values = category!.values;
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

  async getAll(): Promise<any[]> {
    const cacheKey = 'lookup_categories_all';
    const cached = await this.cacheManager.get<any[]>(cacheKey);
    if (cached) return cached;

    const categories = await this.prisma.lookupCategory.findMany({
      where: { isActive: true },
      include: {
        values: {
          where: { isActive: true },
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    const result = categories.map((cat) => ({
      id: cat.id,
      code: cat.code,
      name: cat.name,
      description: cat.description,
      values: this.buildHierarchy(cat.values, null),
    }));

    await this.cacheManager.set(cacheKey, result, 3600 * 1000);
    return result;
  }

  async invalidateCache(categoryCode: string) {
    await this.cacheManager.del(`lookup_category_${categoryCode}`);
    await this.cacheManager.del('lookup_categories_all');
  }

  async createValue(
    categoryCode: string,
    dto: {
      code: string;
      name: string;
      description?: string;
      parentId?: string;
      orderIndex?: number;
    },
  ) {
    let category = await this.prisma.lookupCategory.findUnique({
      where: { code: categoryCode },
    });

    if (!category) {
      category = await this.prisma.lookupCategory.create({
        data: {
          code: categoryCode,
          name: categoryCode.replace(/_/g, ' '),
          description: `Auto-generated category for ${categoryCode}`,
        }
      });
    }

    const created = await this.prisma.lookupValue.create({
      data: {
        categoryId: category.id,
        code: dto.code,
        name: dto.name,
        description: dto.description,
        parentId: dto.parentId || null,
        orderIndex: dto.orderIndex ?? 0,
      },
    });

    await this.invalidateCache(categoryCode);
    return created;
  }

  async updateValue(
    categoryCode: string,
    id: string,
    dto: {
      name?: string;
      description?: string;
      isActive?: boolean;
      orderIndex?: number;
    },
  ) {
    const existing = await this.prisma.lookupValue.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Lookup value ${id} not found.`);
    }

    const updated = await this.prisma.lookupValue.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.orderIndex !== undefined ? { orderIndex: dto.orderIndex } : {}),
      },
    });

    await this.invalidateCache(categoryCode);
    return updated;
  }

  async deleteValue(categoryCode: string, id: string) {
    const existing = await this.prisma.lookupValue.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Lookup value ${id} not found.`);
    }

    await this.prisma.lookupValue.update({
      where: { id },
      data: { isActive: false },
    });

    await this.invalidateCache(categoryCode);
    return { success: true };
  }
}
