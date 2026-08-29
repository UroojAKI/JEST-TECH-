import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  FuelType,
  TransmissionType,
  VehicleType,
  Prisma,
} from '@prisma/client';

import { PaginationDto } from '../../../common/pagination/pagination.dto';
import { PaginatedResponseDto } from '../../../common/pagination/paginated-response.dto';

@Injectable()
export class VehicleMasterService {
  constructor(private readonly prisma: PrismaService) {}

  // RTO Master CRUD
  async getRtos(search?: string, state?: string) {
    const where: any = { isActive: true };
    if (state) where.state = state;
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { rtoOfficeName: { contains: search, mode: 'insensitive' } },
        { district: { contains: search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.rtoMaster.findMany({
      where,
      orderBy: { code: 'asc' },
    });
  }

  async getRtoByCode(code: string) {
    const rto = await this.prisma.rtoMaster.findUnique({ where: { code } });
    if (!rto) throw new NotFoundException(`RTO with code '${code}' not found`);
    return rto;
  }

  async createRto(data: {
    code: string;
    state: string;
    district: string;
    rtoOfficeName: string;
    rtoZone?: string;
  }) {
    return this.prisma.rtoMaster.create({
      data: {
        code: data.code.toUpperCase(),
        state: data.state,
        district: data.district,
        rtoOfficeName: data.rtoOfficeName,
        rtoZone: data.rtoZone || 'ZONE_A',
      },
    });
  }

  async updateRto(id: string, data: any) {
    return this.prisma.rtoMaster.update({
      where: { id },
      data,
    });
  }

  async deleteRto(id: string) {
    return this.prisma.rtoMaster.delete({ where: { id } });
  }

  // Manufacturer CRUD
  async getManufacturers(pagination: PaginationDto) {
    const page = pagination.page || 1;
    const limit = pagination.limit || 10;
    const skip = (page - 1) * limit;
    const where: Prisma.VehicleManufacturerWhereInput = {};
    if (pagination.search) {
      where.OR = [
        { name: { contains: pagination.search, mode: 'insensitive' } },
        { code: { contains: pagination.search, mode: 'insensitive' } },
      ];
    }
    const orderBy = pagination.sortBy
      ? ({ [pagination.sortBy]: pagination.sortOrder || 'asc' } as any)
      : { name: 'asc' };

    const [data, total] = await Promise.all([
      this.prisma.vehicleManufacturer.findMany({
        skip,
        take: limit,
        where,
        orderBy,
      }),
      this.prisma.vehicleManufacturer.count({ where }),
    ]);

    return new PaginatedResponseDto(data, total, page, limit);
  }

  async createManufacturer(name: string, code: string) {
    return this.prisma.vehicleManufacturer.create({
      data: { name, code: code.toUpperCase() },
    });
  }

  // Model CRUD
  async getModels(pagination: PaginationDto, manufacturerId?: string) {
    const page = pagination.page || 1;
    const limit = pagination.limit || 10;
    const skip = (page - 1) * limit;
    const where: Prisma.VehicleModelWhereInput = manufacturerId
      ? { manufacturerId }
      : {};
    if (pagination.search) {
      where.OR = [
        { name: { contains: pagination.search, mode: 'insensitive' } },
        { code: { contains: pagination.search, mode: 'insensitive' } },
      ];
    }
    const orderBy = pagination.sortBy
      ? ({ [pagination.sortBy]: pagination.sortOrder || 'asc' } as any)
      : { name: 'asc' };

    const [data, total] = await Promise.all([
      this.prisma.vehicleModel.findMany({
        skip,
        take: limit,
        where,
        orderBy,
        include: { manufacturer: true },
      }),
      this.prisma.vehicleModel.count({ where }),
    ]);

    return new PaginatedResponseDto(data, total, page, limit);
  }

  async createModel(
    manufacturerId: string,
    name: string,
    code: string,
    type: VehicleType,
  ) {
    return this.prisma.vehicleModel.create({
      data: {
        manufacturerId,
        name,
        code: code.toUpperCase(),
        vehicleType: type,
      },
    });
  }

  // Variant CRUD
  async getVariants(pagination: PaginationDto, modelId?: string) {
    const page = pagination.page || 1;
    const limit = pagination.limit || 10;
    const skip = (page - 1) * limit;
    const where: Prisma.VehicleVariantWhereInput = modelId ? { modelId } : {};
    if (pagination.search) {
      where.OR = [
        { name: { contains: pagination.search, mode: 'insensitive' } },
        { code: { contains: pagination.search, mode: 'insensitive' } },
      ];
    }
    const orderBy = pagination.sortBy
      ? ({ [pagination.sortBy]: pagination.sortOrder || 'asc' } as any)
      : { name: 'asc' };

    const [data, total] = await Promise.all([
      this.prisma.vehicleVariant.findMany({
        skip,
        take: limit,
        where,
        orderBy,
        include: { model: { include: { manufacturer: true } } },
      }),
      this.prisma.vehicleVariant.count({ where }),
    ]);

    return new PaginatedResponseDto(data, total, page, limit);
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
      data: {
        modelId: params.modelId,
        name: params.name,
        code: params.code.toUpperCase(),
        fuelType: params.fuelType,
        transmissionType: params.transmissionType,
        engineCapacity: params.engineCapacity,
        exShowroomPrice: new Prisma.Decimal(params.exShowroomPrice),
      },
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

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split(',');
      if (parts.length < 7) continue;

      const [
        modelCode,
        variantName,
        variantCode,
        fuel,
        transmission,
        cc,
        price,
      ] = parts.map((p) => p.trim());
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

    const uniqueModelCodes = Array.from(
      new Set(parsedRows.map((r) => r.modelCode)),
    );
    const models: any[] = [];
    for (let i = 0; i < uniqueModelCodes.length; i += 1000) {
      models.push(
        ...(await this.prisma.vehicleModel.findMany({
          where: { code: { in: uniqueModelCodes.slice(i, i + 1000) } },
        })),
      );
    }
    const modelMap = new Map(models.map((m) => [m.code, m.id]));

    const uniqueVariantCodes = Array.from(
      new Set(parsedRows.map((r) => r.variantCode)),
    );
    const existingVariants: any[] = [];
    for (let i = 0; i < uniqueVariantCodes.length; i += 1000) {
      existingVariants.push(
        ...(await this.prisma.vehicleVariant.findMany({
          where: { code: { in: uniqueVariantCodes.slice(i, i + 1000) } },
        })),
      );
    }
    const existingMap = new Map(existingVariants.map((v) => [v.code, v]));

    const toCreate: any[] = [];
    const toUpdate: Array<{ code: string; price: number; cc: number }> = [];

    for (const row of parsedRows) {
      const modelId = modelMap.get(row.modelCode);
      if (!modelId) continue;

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

    await this.prisma.$transaction(async (tx) => {
      const CREATE_BATCH_SIZE = 1000;
      for (let i = 0; i < toCreate.length; i += CREATE_BATCH_SIZE) {
        const batch = toCreate.slice(i, i + CREATE_BATCH_SIZE);
        await tx.vehicleVariant.createMany({
          data: batch,
          skipDuplicates: true,
        });
      }

      const UPDATE_BATCH_SIZE = 500;
      for (let i = 0; i < toUpdate.length; i += UPDATE_BATCH_SIZE) {
        const batch = toUpdate.slice(i, i + UPDATE_BATCH_SIZE);
        await Promise.all(
          batch.map((updateItem) =>
            tx.vehicleVariant.update({
              where: { code: updateItem.code },
              data: {
                exShowroomPrice: new Prisma.Decimal(updateItem.price),
                engineCapacity: updateItem.cc,
              },
            }),
          ),
        );
      }
    });

    return { count: toCreate.length + toUpdate.length, status: 'SUCCESS' };
  }
}
