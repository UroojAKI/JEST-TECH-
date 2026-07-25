import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleType } from '@prisma/client';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { StatisticalPredictionService } from '../services/statistical-prediction/statistical-prediction.service';

@ApiTags('Business Intelligence Forecasting')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('forecasting')
export class ForecastingController {
  constructor(private readonly forecastingService: StatisticalPredictionService) {}

  @Get('revenue')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.BRANCH_MANAGER, RoleType.FINANCE)
  @ApiOperation({ summary: 'Predict future revenue pipeline based on historical moving average' })
  async forecastRevenue(
    @Query('monthsAhead') monthsAheadStr?: string,
    @Query('branchId') branchId?: string,
  ) {
    const monthsAhead = monthsAheadStr ? parseInt(monthsAheadStr, 10) : 3;
    const amount = await this.forecastingService.forecastRevenue(monthsAhead, branchId);
    return { monthsAhead, branchId, forecastedRevenue: amount };
  }

  @Get('renewals')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Predict expected policy renewals' })
  async forecastRenewals(
    @Query('monthsAhead') monthsAheadStr?: string,
    @Query('branchId') branchId?: string,
  ) {
    const monthsAhead = monthsAheadStr ? parseInt(monthsAheadStr, 10) : 1;
    const expectedCount = await this.forecastingService.forecastRenewals(monthsAhead, branchId);
    return { monthsAhead, branchId, expectedRenewalsCount: expectedCount };
  }

  @Get('customer-risk/:customerId')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.BRANCH_MANAGER, RoleType.UNDERWRITER)
  @ApiOperation({ summary: 'Predict customer churn risk score' })
  async predictRisk(@Param('customerId') customerId: string) {
    const riskScore = await this.forecastingService.predictCustomerRisk(customerId);
    return { customerId, churnProbabilityScore: riskScore };
  }
}
