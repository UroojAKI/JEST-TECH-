import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/decorators/current-user.decorator';
import {
  MotorTariffService,
  TariffLookupParams,
} from './services/motor-tariff.service';
import {
  SaodVerificationService,
  CreateSaodVerificationDto,
} from './services/saod-verification.service';
import {
  VehicleDataService,
  UpsertVehicleDto,
} from './services/vehicle-data.service';
import { VehicleCategory } from '@prisma/client';

@ApiTags('Motor')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('motor')
export class MotorController {
  constructor(
    private readonly tariffService: MotorTariffService,
    private readonly saodService: SaodVerificationService,
    private readonly vehicleDataService: VehicleDataService,
  ) {}

  @Get('tariff/lookup')
  async lookupTariff(
    @Query('vehicleCategory') vehicleCategory: string,
    @Query('policyType') policyType: string,
    @Query('engineCc') engineCc?: string,
    @Query('seatingCapacity') seatingCapacity?: string,
    @Query('gvwKg') gvwKg?: string,
    @Query('quotationDate') quotationDate?: string,
  ) {
    const params: TariffLookupParams = {
      vehicleCategory: vehicleCategory as VehicleCategory,
      policyType: policyType as 'TP_ONLY' | 'PACKAGE',
      engineCc: engineCc ? parseInt(engineCc) : undefined,
      seatingCapacity: seatingCapacity ? parseInt(seatingCapacity) : undefined,
      gvwKg: gvwKg ? parseFloat(gvwKg) : undefined,
      quotationDate: quotationDate ? new Date(quotationDate) : new Date(),
    };
    return this.tariffService.lookupTpTariff(params);
  }

  @Post('saod-verification')
  async createSaodVerification(
    @Body() body: Omit<CreateSaodVerificationDto, 'verifiedById'>,
    @CurrentUser() user: RequestUser,
  ) {
    return this.saodService.createVerification({
      ...body,
      verifiedById: user.id,
    });
  }

  @Post('vehicles/normalize-registration')
  normalizeRegistration(
    @Body('registrationNumber') registrationNumber: string,
  ) {
    return this.vehicleDataService.normalizeRegistrationNumber(
      registrationNumber,
    );
  }

  @Post('vehicles/validate-specs')
  validateVehicleSpecs(
    @Body('category') category: VehicleCategory,
    @Body('specs') specs: Record<string, any>,
  ) {
    return this.vehicleDataService.validateVehicleSpecs(category, specs);
  }

  @Post('vehicles')
  upsertVehicle(
    @Body() dto: UpsertVehicleDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.vehicleDataService.upsertVehicle(dto, user.id);
  }

  @Get('vehicles/lookup/:regNumber')
  lookupVehicleByPlate(@Query('regNumber') regNumber: string) {
    return this.vehicleDataService.findByRegistration(regNumber);
  }

  @Get('vehicles/by-contact/:contactId')
  getVehiclesByContact(@Query('contactId') contactId: string) {
    return this.vehicleDataService.findByContact(contactId);
  }
}
