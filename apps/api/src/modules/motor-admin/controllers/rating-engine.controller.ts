import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RoleType, ProductType } from '@prisma/client';
import { InsurerProductService } from '../services/insurer-product.service';

@ApiTags('Motor Admin - Insurers & Configuration')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('motor/rating')
export class RatingEngineController {
  constructor(private readonly insurerProductService: InsurerProductService) {}

  @Get('insurers')
  @ApiOperation({ summary: 'Get all configured partner insurers' })
  getInsurers() {
    return this.insurerProductService.getInsurers();
  }

  @Get('insurers/:id')
  @ApiOperation({ summary: 'Get insurer master details by ID' })
  getInsurerById(@Param('id') id: string) {
    return this.insurerProductService.getInsurerById(id);
  }

  @Post('insurers')
  @Roles(RoleType.ADMIN, RoleType.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create new partner insurer configuration' })
  createInsurer(@Body() data: any) {
    return this.insurerProductService.createInsurer(data);
  }

  @Put('insurers/:id')
  @Roles(RoleType.ADMIN, RoleType.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update partner insurer master configuration' })
  updateInsurer(@Param('id') id: string, @Body() data: any) {
    return this.insurerProductService.updateInsurer(id, data);
  }

  @Patch('insurers/:id/toggle')
  @Roles(RoleType.ADMIN, RoleType.SUPER_ADMIN)
  @ApiOperation({ summary: 'Toggle insurer active/inactive status' })
  toggleInsurerStatus(@Param('id') id: string) {
    return this.insurerProductService.toggleInsurerStatus(id);
  }

  @Delete('insurers/:id')
  @Roles(RoleType.ADMIN, RoleType.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete partner insurer' })
  deleteInsurer(@Param('id') id: string) {
    return this.insurerProductService.deleteInsurer(id);
  }

  @Get('insurance-products')
  @ApiOperation({ summary: 'Get insurer products' })
  getInsuranceProducts(@Query('insurerId') insurerId?: string) {
    return this.insurerProductService.getInsuranceProducts(insurerId);
  }

  @Post('insurance-products')
  @Roles(RoleType.ADMIN, RoleType.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create product for insurer' })
  createInsuranceProduct(@Body() data: any) {
    return this.insurerProductService.createInsuranceProduct(data);
  }

  @Get('discounts')
  @ApiOperation({ summary: 'Get discount rules' })
  getDiscountRules(@Query('insurerId') insurerId?: string) {
    return this.insurerProductService.getDiscountRules(insurerId);
  }

  @Post('discounts')
  @Roles(RoleType.ADMIN, RoleType.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create discount rule for insurer' })
  createDiscountRule(@Body() data: any) {
    return this.insurerProductService.createDiscountRule(data);
  }

  @Get('commissions')
  @ApiOperation({ summary: 'Get commission matrices' })
  getCommissionMatrices(@Query('insurerId') insurerId?: string) {
    return this.insurerProductService.getCommissionMatrices(insurerId);
  }

  @Post('commissions')
  @Roles(RoleType.ADMIN, RoleType.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create commission matrix for insurer' })
  createCommissionMatrix(@Body() data: any) {
    return this.insurerProductService.createCommissionMatrix(data);
  }

  @Get('products')
  getProducts() {
    return this.insurerProductService.getProducts();
  }

  @Post('products')
  @Roles(RoleType.ADMIN, RoleType.SUPER_ADMIN)
  createProduct(
    @Body('name') name: string,
    @Body('code') code: string,
    @Body('type') type: ProductType,
    @Body('commission') commission: number,
    @Body('description') description?: string,
  ) {
    return this.insurerProductService.createProduct(
      name,
      code,
      type,
      commission,
      description,
    );
  }
}
