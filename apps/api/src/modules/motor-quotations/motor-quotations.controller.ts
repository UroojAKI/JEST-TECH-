import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ConflictException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RoleType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/decorators/current-user.decorator';
import { MotorQuotationsService } from './motor-quotations.service';
import { CreateMotorQuotationDto } from './dto/create-motor-quotation.dto';
import { MotorQuotationQueryDto } from './dto/motor-quotation-query.dto';
import { ParseUUIDPipe } from '../../common/utils/parse-uuid.pipe';

@ApiTags('Motor Quotations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('motor-quotations')
export class MotorQuotationsController {
  constructor(
    private readonly motorQuotationsService: MotorQuotationsService,
  ) {}

  @Get('compare')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  @ApiOperation({
    summary: 'Compare multiple insurer quotations for a vehicle',
  })
  compareQuotes(
    @Query('vehicleId', ParseUUIDPipe) vehicleId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.motorQuotationsService.compareQuotes(vehicleId, user);
  }

  @Get()
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  @ApiOperation({ summary: 'List motor quotations with pagination' })
  findAll(
    @Query() query: MotorQuotationQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.motorQuotationsService.findAll(query, user);
  }

  @Get(':id')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  @ApiOperation({
    summary: 'Get motor quotation by ID with category schema configuration',
  })
  findById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.motorQuotationsService.findById(id, user);
  }

  @Post()
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  @HttpCode(HttpStatus.GONE)
  @ApiOperation({ summary: 'Create a motor quotation (RETIRED)' })
  create(
    @Body() dto: CreateMotorQuotationDto,
    @CurrentUser() user: RequestUser,
  ) {
    throw new ConflictException(
      'LEGACY_MOTOR_QUOTATION_CREATION_DISABLED: Direct creation of legacy MotorQuotation is permanently retired. Motor quotations must be captured via canonical POST /quotations/motor-capture backed by MotorCalculationService.',
    );
  }

  @Post(':id/accept')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  @HttpCode(HttpStatus.GONE)
  @ApiOperation({
    summary:
      'Accept quotation (RETIRED)',
  })
  acceptQuotation(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    throw new ConflictException(
      'LEGACY_MOTOR_QUOTATION_ACCEPT_DISABLED: Direct acceptance of legacy MotorQuotation is retired. Quotation acceptance is managed via canonical Quotation workflow.',
    );
  }
}
