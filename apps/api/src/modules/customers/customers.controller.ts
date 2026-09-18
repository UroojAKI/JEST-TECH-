import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RoleType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/decorators/current-user.decorator';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomerQueryDto } from './dto/customer-query.dto';
import { CheckDuplicateDto } from './dto/check-duplicate.dto';
import { CreateCustomerAlertDto } from './dto/create-alert.dto';
import { ParseUUIDPipe } from '../../common/utils/parse-uuid.pipe';

@ApiTags('Customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get('check-duplicate')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  @ApiOperation({ summary: 'Soft check for duplicate customer by mobile or email' })
  checkDuplicate(@Query() query: CheckDuplicateDto) {
    return this.customersService.checkDuplicate(query);
  }

  @Get()
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  @ApiOperation({ summary: 'List customers with pagination and filtering' })
  findAll(@Query() query: CustomerQueryDto, @CurrentUser() user: RequestUser) {
    return this.customersService.findAll(query, user);
  }

  @Get(':id')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  @ApiOperation({ summary: 'Get customer by ID with full 360 overview' })
  findById(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.customersService.findById(id, user);
  }

  @Post()
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create customer with soft duplicate warning' })
  create(@Body() dto: CreateCustomerDto, @CurrentUser() user: RequestUser) {
    return this.customersService.create(dto, user);
  }

  @Patch(':id')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  @ApiOperation({ summary: 'Update customer details' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.customersService.update(id, dto, user);
  }

  @Get(':id/alerts')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  @ApiOperation({ summary: 'Get alerts for customer' })
  getAlerts(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.customersService.getAlerts(id, user);
  }

  @Post(':id/alerts')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create alert for customer' })
  createAlert(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCustomerAlertDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.customersService.createAlert(id, dto, user);
  }

  @Patch(':id/alerts/:alertId/read')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  @ApiOperation({ summary: 'Mark customer alert as read' })
  markAlertRead(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('alertId', ParseUUIDPipe) alertId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.customersService.markAlertRead(id, alertId, user);
  }
}
