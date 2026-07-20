import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { FuelType, TransmissionType, VehicleType, Prisma } from '@prisma/client';

@Injectable()
export class VehicleMasterService {
  constructor(private readonly prisma: PrismaService) {}

  // Manufacturer CRUD
  async getManufacturers() {
    return this.prisma.vehicleManufacturer.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async createManufacturer(name: string, code: string) {
    return this.prisma.vehicleManufacturer.create({
      data: { name, code },
    });
  }

  // Model CRUD
  async getModels(manufacturerId?: string) {
    const where = manufacturerId ? { manufacturerId } : {};
    return this.prisma.vehicleModel.findMany({
      where,
      include: { manufacturer: true },
      orderBy: { name: 'asc' },
    });
  }

  async createModel(manufacturerId: string, name: string, code: string, type: VehicleType) {
    return this.prisma.vehicleModel.create({
      data: { manufacturerId, name, code, vehicleType: type },
    });
  }

  // Variant CRUD
  async getVariants(modelId?: string) {
    const where = modelId ? { modelId } : {};
    return this.prisma.vehicleVariant.findMany({
      where,
      include: { model: { include: { manufacturer: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createVariant(params: {
    modelId: string;
    name: string;
    code: string;
    fuelType: FuelType;
    transmissionType: TransmissionType;
    engineCapacity: number;
    exShowroomPrice: number;
  }) {
    return this.prisma.vehicleVariant.create({
      data: params,
    });
  }

  // Bulk CSV Variant Import
  async importVariantsFromCSV(csvContent: string) {
    const lines = csvContent.split('\n');
    const parsedRows: Array<{
      modelCode: string;
      variantName: string;
      variantCode: string;
      fuel: string;
      transmission: string;
      cc: number;
      price: number;
    }> = [];

    // Parse all rows first
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split(',');
      if (parts.length < 7) continue;

      const [modelCode, variantName, variantCode, fuel, transmission, cc, price] = parts.map((p) => p.trim());
      parsedRows.push({
        modelCode,
        variantName,
        variantCode,
        fuel,
        transmission,
        cc: parseInt(cc) || 0,
        price: Number(price) || 0,
      });
    }

    if (parsedRows.length === 0) {
      return { count: 0, status: 'SUCCESS' };
    }

    // Batch-fetch all models
    const uniqueModelCodes = Array.from(new Set(parsedRows.map((r) => r.modelCode)));
    const models = await this.prisma.vehicleModel.findMany({
      where: { code: { in: uniqueModelCodes } },
    });
    const modelMap = new Map(models.map((m) => [m.code, m.id]));

    // Batch-fetch all existing variants
    const uniqueVariantCodes = Array.from(new Set(parsedRows.map((r) => r.variantCode)));
    const existingVariants = await this.prisma.vehicleVariant.findMany({
      where: { code: { in: uniqueVariantCodes } },
    });
    const existingMap = new Map(existingVariants.map((v) => [v.code, v]));

    const toCreate: any[] = [];
    const toUpdate: Array<{ code: string; price: number; cc: number }> = [];

    for (const row of parsedRows) {
      const modelId = modelMap.get(row.modelCode);
      if (!modelId) continue; // Skip if model doesn't exist

      if (existingMap.has(row.variantCode)) {
        toUpdate.push({
          code: row.variantCode,
          price: row.price,
          cc: row.cc,
        });
      } else {
        toCreate.push({
          modelId,
          name: row.variantName,
          code: row.variantCode,
          fuelType: row.fuel as FuelType,
          transmissionType: row.transmission as TransmissionType,
          engineCapacity: row.cc,
          exShowroomPrice: new Prisma.Decimal(row.price),
        });
      }
    }

    // Execute database operations in batch
    await this.prisma.$transaction(async (tx) => {
      if (toCreate.length > 0) {
        await tx.vehicleVariant.createMany({
          data: toCreate,
          skipDuplicates: true,
        });
      }

      for (const updateItem of toUpdate) {
        await tx.vehicleVariant.update({
          where: { code: updateItem.code },
          data: {
            exShowroomPrice: new Prisma.Decimal(updateItem.price),
            engineCapacity: updateItem.cc,
          },
        });
      }
    });

    return { count: toCreate.length + toUpdate.length, status: 'SUCCESS' };
  }
}
