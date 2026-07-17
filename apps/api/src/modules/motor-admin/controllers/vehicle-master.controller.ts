import { Controller, Get, Post, Body, Query, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RoleType, FuelType, TransmissionType, VehicleType } from '@prisma/client';
import { VehicleMasterService } from '../services/vehicle-master.service';

@ApiTags('Motor Admin - Vehicles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('motor/vehicles')
export class VehicleMasterController {
  constructor(private readonly vehicleService: VehicleMasterService) {}

  @Get('manufacturers')
  getManufacturers() {
    return this.vehicleService.getManufacturers();
  }

  @Post('manufacturers')
  @Roles(RoleType.ADMIN, RoleType.SUPER_ADMIN)
  createManufacturer(@Body('name') name: string, @Body('code') code: string) {
    return this.vehicleService.createManufacturer(name, code);
  }

  @Get('models')
  getModels(@Query('manufacturerId') manufacturerId?: string) {
    return this.vehicleService.getModels(manufacturerId);
  }

  @Post('models')
  @Roles(RoleType.ADMIN, RoleType.SUPER_ADMIN)
  createModel(
    @Body('manufacturerId') manufacturerId: string,
    @Body('name') name: string,
    @Body('code') code: string,
    @Body('type') type: VehicleType,
  ) {
    return this.vehicleService.createModel(manufacturerId, name, code, type);
  }

  @Get('variants')
  getVariants(@Query('modelId') modelId?: string) {
    return this.vehicleService.getVariants(modelId);
  }

  @Post('variants')
  @Roles(RoleType.ADMIN, RoleType.SUPER_ADMIN)
  createVariant(
    @Body('modelId') modelId: string,
    @Body('name') name: string,
    @Body('code') code: string,
    @Body('fuelType') fuelType: FuelType,
    @Body('transmissionType') transmissionType: TransmissionType,
    @Body('engineCapacity') engineCapacity: number,
    @Body('exShowroomPrice') exShowroomPrice: number,
  ) {
    return this.vehicleService.createVariant({
      modelId,
      name,
      code,
      fuelType,
      transmissionType,
      engineCapacity,
      exShowroomPrice,
    });
  }

  @Post('variants/import')
  @Roles(RoleType.ADMIN, RoleType.SUPER_ADMIN)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async importVariants(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('CSV file is required');
    }
    const csvContent = file.buffer.toString('utf-8');
    return this.vehicleService.importVariantsFromCSV(csvContent);
  }
}
