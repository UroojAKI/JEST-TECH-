import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RoleType, ProductType, RatingRuleType } from '@prisma/client';
import { InsurerProductService } from '../services/insurer-product.service';
import { RatingEngineService } from '../services/rating-engine.service';

@ApiTags('Motor Admin - Rating & Rules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('motor/rating')
export class RatingEngineController {
  constructor(
    private readonly insurerProductService: InsurerProductService,
    private readonly ratingEngineService: RatingEngineService,
  ) {}

  @Get('insurers')
  getInsurers() {
    return this.insurerProductService.getInsurers();
  }

  @Post('insurers')
  @Roles(RoleType.ADMIN, RoleType.SUPER_ADMIN)
  createInsurer(
    @Body('name') name: string,
    @Body('code') code: string,
    @Body('rating') rating?: number,
    @Body('contactDetails') contactDetails?: any,
    @Body('logoUrl') logoUrl?: string,
  ) {
    return this.insurerProductService.createInsurer(name, code, rating, contactDetails, logoUrl);
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
    @Body('baseCommissionRate') baseCommissionRate: number,
    @Body('description') description?: string,
  ) {
    return this.insurerProductService.createProduct(name, code, type, baseCommissionRate, description);
  }

  @Get('rules')
  getRatingRules(@Query('insurerId') insurerId?: string, @Query('productId') productId?: string) {
    return this.insurerProductService.getRatingRules(insurerId, productId);
  }

  @Post('rules')
  @Roles(RoleType.ADMIN, RoleType.SUPER_ADMIN)
  createRatingRule(
    @Body('productId') productId: string,
    @Body('insurerId') insurerId: string,
    @Body('ruleName') ruleName: string,
    @Body('ruleType') ruleType: RatingRuleType,
    @Body('eligibilityCriteria') eligibilityCriteria: any,
    @Body('formulaOrRate') formulaOrRate: any,
    @Body('priority') priority?: number,
  ) {
    return this.insurerProductService.createRatingRule({
      productId,
      insurerId,
      ruleName,
      ruleType,
      eligibilityCriteria,
      formulaOrRate,
      priority,
    });
  }

  @Post('calculate')
  calculatePremium(
    @Body('variantId') variantId: string,
    @Body('insurerId') insurerId: string,
    @Body('productId') productId: string,
    @Body('vehicleAgeYears') vehicleAgeYears: number,
    @Body('ncbPercentage') ncbPercentage?: number,
    @Body('rtoZone') rtoZone?: string,
    @Body('selectedAddons') selectedAddons?: string[],
  ) {
    return this.ratingEngineService.calculatePremium({
      variantId,
      insurerId,
      productId,
      vehicleAgeYears,
      ncbPercentage,
      rtoZone,
      selectedAddons,
    });
  }
}
