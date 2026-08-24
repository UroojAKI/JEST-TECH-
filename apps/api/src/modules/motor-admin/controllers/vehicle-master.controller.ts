import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiTags, ApiOperation } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import {
  RoleType,
  FuelType,
  TransmissionType,
  VehicleType,
} from '@prisma/client';

import { PaginationDto } from '../../../common/pagination/pagination.dto';
import { ParseUUIDPipe } from '../../../common/utils/parse-uuid.pipe';

import { VehicleMasterService } from '../services/vehicle-master.service';

@ApiTags('Motor Admin - Vehicles & RTO')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('motor/vehicles')
export class VehicleMasterController {
  constructor(private readonly vehicleService: VehicleMasterService) {}

  // RTO Endpoints
  @Get('rto')
  @ApiOperation({ summary: 'Search and filter RTO Code master records' })
  getRtos(@Query('search') search?: string, @Query('state') state?: string) {
    return this.vehicleService.getRtos(search, state);
  }

  @Get('rto/:code')
  @ApiOperation({ summary: 'Get RTO master record by RTO Code (e.g. MH12, KA01)' })
  getRtoByCode(@Param('code') code: string) {
    return this.vehicleService.getRtoByCode(code.toUpperCase());
  }

  @Post('rto')
  @Roles(RoleType.ADMIN, RoleType.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create new RTO master record' })
  createRto(@Body() data: { code: string; state: string; district: string; rtoOfficeName: string; rtoZone?: string }) {
    return this.vehicleService.createRto(data);
  }

  @Put('rto/:id')
  @Roles(RoleType.ADMIN, RoleType.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update RTO master record' })
  updateRto(@Param('id', ParseUUIDPipe) id: string, @Body() data: any) {
    return this.vehicleService.updateRto(id, data);
  }

  @Delete('rto/:id')
  @Roles(RoleType.ADMIN, RoleType.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete RTO master record' })
  deleteRto(@Param('id', ParseUUIDPipe) id: string) {
    return this.vehicleService.deleteRto(id);
  }

  // Manufacturer Endpoints
  @Get('manufacturers')
  getManufacturers(@Query() pagination: PaginationDto) {
    return this.vehicleService.getManufacturers(pagination);
  }

  @Post('manufacturers')
  @Roles(RoleType.ADMIN, RoleType.SUPER_ADMIN)
  createManufacturer(@Body('name') name: string, @Body('code') code: string) {
    return this.vehicleService.createManufacturer(name, code);
  }

  // Model Endpoints
  @Get('models')
  getModels(
    @Query() pagination: PaginationDto,
    @Query('manufacturerId') manufacturerId?: string,
  ) {
    return this.vehicleService.getModels(pagination, manufacturerId);
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

  // Variant Endpoints
  @Get('variants')
  getVariants(
    @Query() pagination: PaginationDto,
    @Query('modelId') modelId?: string,
  ) {
    return this.vehicleService.getVariants(pagination, modelId);
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
