import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { ProductType, RatingRuleType } from '@prisma/client';

@Injectable()
export class InsurerProductService {
  constructor(private readonly prisma: PrismaService) {}

  // Insurers CRUD
  async getInsurers() {
    return this.prisma.insurer.findMany({
      orderBy: { name: 'asc' },
      include: {
        products: true,
        discountRules: true,
        commissionMatrices: true,
        underwritingQuestions: true,
        addonRules: true,
      },
    });
  }

  async getInsurerById(id: string) {
    const insurer = await this.prisma.insurer.findUnique({
      where: { id },
      include: {
        products: true,
        discountRules: true,
        commissionMatrices: true,
        underwritingQuestions: true,
        addonRules: true,
      },
    });
    if (!insurer) throw new NotFoundException(`Insurer with ID '${id}' not found`);
    return insurer;
  }

  async createInsurer(data: {
    name: string;
    code: string;
    logoUrl?: string;
    irdaiRegistrationNumber?: string;
    contactEmail?: string;
    contactPhone?: string;
    address?: string;
    rating?: number;
    supportedVehicleTypes?: any;
    supportedPolicyTypes?: any;
    supportsZeroDep?: boolean;
    supportsRTI?: boolean;
    supportsEngineProtect?: boolean;
    supportsRSA?: boolean;
    supportsNCBProtection?: boolean;
    supportsConsumables?: boolean;
    supportsKeyProtect?: boolean;
    supportsTyreProtect?: boolean;
    isActive?: boolean;
  }) {
    return this.prisma.insurer.create({
      data: {
        name: data.name,
        code: data.code.toUpperCase(),
        logoUrl: data.logoUrl,
        irdaiRegistrationNumber: data.irdaiRegistrationNumber,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        address: data.address,
        rating: data.rating,
        supportedVehicleTypes: data.supportedVehicleTypes || ['FOUR_WHEELER', 'TWO_WHEELER'],
        supportedPolicyTypes: data.supportedPolicyTypes || ['COMPREHENSIVE', 'STANDALONE_OD', 'THIRD_PARTY'],
        supportsZeroDep: data.supportsZeroDep ?? true,
        supportsRTI: data.supportsRTI ?? true,
        supportsEngineProtect: data.supportsEngineProtect ?? true,
        supportsRSA: data.supportsRSA ?? true,
        supportsNCBProtection: data.supportsNCBProtection ?? true,
        supportsConsumables: data.supportsConsumables ?? true,
        supportsKeyProtect: data.supportsKeyProtect ?? true,
        supportsTyreProtect: data.supportsTyreProtect ?? true,
        isActive: data.isActive ?? true,
      },
    });
  }

  async updateInsurer(id: string, data: any) {
    await this.getInsurerById(id);
    return this.prisma.insurer.update({
      where: { id },
      data,
    });
  }

  async toggleInsurerStatus(id: string) {
    const insurer = await this.getInsurerById(id);
    return this.prisma.insurer.update({
      where: { id },
      data: { isActive: !insurer.isActive },
    });
  }

  async deleteInsurer(id: string) {
    await this.getInsurerById(id);
    return this.prisma.insurer.delete({ where: { id } });
  }

  // Insurance Products
  async getInsuranceProducts(insurerId?: string) {
    return this.prisma.insuranceProduct.findMany({
      where: insurerId ? { insurerId } : {},
      include: { insurer: true },
      orderBy: { productName: 'asc' },
    });
  }

  async createInsuranceProduct(data: {
    insurerId: string;
    productName: string;
    code: string;
    vehicleType?: string;
    policyType?: string;
  }) {
    return this.prisma.insuranceProduct.create({
      data: {
        insurerId: data.insurerId,
        productName: data.productName,
        code: data.code.toUpperCase(),
        vehicleType: data.vehicleType || 'FOUR_WHEELER',
        policyType: data.policyType || 'COMPREHENSIVE',
      },
    });
  }

  // Discount Rules
  async getDiscountRules(insurerId?: string) {
    return this.prisma.discountRule.findMany({
      where: insurerId ? { insurerId } : {},
      include: { insurer: true },
    });
  }

  async createDiscountRule(data: {
    insurerId: string;
    vehicleType?: string;
    policyType?: string;
    maxDiscountPercent: number;
    minDiscountPercent?: number;
    managerApprovalThresholdPercent?: number;
  }) {
    return this.prisma.discountRule.create({
      data: {
        insurerId: data.insurerId,
        vehicleType: data.vehicleType || 'FOUR_WHEELER',
        policyType: data.policyType || 'COMPREHENSIVE',
        maxDiscountPercent: data.maxDiscountPercent,
        minDiscountPercent: data.minDiscountPercent || 0,
        managerApprovalThresholdPercent: data.managerApprovalThresholdPercent || 15,
      },
    });
  }

  // Commission Matrices
  async getCommissionMatrices(insurerId?: string) {
    return this.prisma.commissionMatrix.findMany({
      where: insurerId ? { insurerId } : {},
      include: { insurer: true },
    });
  }

  async createCommissionMatrix(data: {
    insurerId: string;
    productType?: string;
    odCommissionPercent: number;
    tpCommissionPercent: number;
    brokeragePercent?: number;
    tdsPercent?: number;
  }) {
    return this.prisma.commissionMatrix.create({
      data: {
        insurerId: data.insurerId,
        productType: data.productType || 'MOTOR',
        odCommissionPercent: data.odCommissionPercent,
        tpCommissionPercent: data.tpCommissionPercent,
        brokeragePercent: data.brokeragePercent || data.odCommissionPercent,
        tdsPercent: data.tdsPercent || 5,
      },
    });
  }

  // Legacy Products & Rating Rules
  async getProducts() {
    return this.prisma.product.findMany({ orderBy: { name: 'asc' } });
  }

  async createProduct(name: string, code: string, type: ProductType, commission: number, description?: string) {
    return this.prisma.product.create({
      data: { name, code, type, baseCommissionRate: commission, description },
    });
  }
}
