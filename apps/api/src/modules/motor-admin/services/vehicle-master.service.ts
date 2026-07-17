import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { FuelType, TransmissionType, VehicleType } from '@prisma/client';

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
    const imported: any[] = [];

    // Expected columns: modelCode, name, variantCode, fuelType, transmissionType, engineCapacity, exShowroomPrice
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split(',');
      if (parts.length < 7) continue;

      const [modelCode, variantName, variantCode, fuel, transmission, cc, price] = parts.map((p) => p.trim());

      const model = await this.prisma.vehicleModel.findUnique({
        where: { code: modelCode },
      });

      if (!model) continue;

      const variant = await this.prisma.vehicleVariant.upsert({
        where: { code: variantCode },
        update: {
          exShowroomPrice: Number(price),
          engineCapacity: parseInt(cc),
        },
        create: {
          modelId: model.id,
          name: variantName,
          code: variantCode,
          fuelType: fuel as FuelType,
          transmissionType: transmission as TransmissionType,
          engineCapacity: parseInt(cc),
          exShowroomPrice: Number(price),
        },
      });
      imported.push(variant);
    }
    return { count: imported.length, status: 'SUCCESS' };
  }
}
