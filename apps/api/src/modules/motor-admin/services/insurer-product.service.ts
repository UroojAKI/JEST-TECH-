import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { ProductType, RatingRuleType } from '@prisma/client';

@Injectable()
export class InsurerProductService {
  constructor(private readonly prisma: PrismaService) {}

  // Insurers CRUD
  async getInsurers() {
    return this.prisma.insurer.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async createInsurer(
    name: string,
    code: string,
    rating?: number,
    contactDetails?: any,
    logoUrl?: string,
  ) {
    return this.prisma.insurer.create({
      data: { name, code, rating, contactDetails, logoUrl },
    });
  }

  // Products CRUD
  async getProducts() {
    return this.prisma.product.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async createProduct(
    name: string,
    code: string,
    type: ProductType,
    commission: number,
    description?: string,
  ) {
    return this.prisma.product.create({
      data: { name, code, type, baseCommissionRate: commission, description },
    });
  }

  // Rating Rules CRUD
  async getRatingRules(insurerId?: string, productId?: string) {
    const where: any = {};
    if (insurerId) where.insurerId = insurerId;
    if (productId) where.productId = productId;

    return this.prisma.ratingRule.findMany({
      where,
      include: { insurer: true, product: true },
      orderBy: { priority: 'desc' },
    });
  }

  async createRatingRule(params: {
    productId: string;
    insurerId: string;
    ruleName: string;
    ruleType: RatingRuleType;
    eligibilityCriteria: any;
    formulaOrRate: any;
    priority?: number;
  }) {
    return this.prisma.ratingRule.create({
      data: params,
    });
  }
}
