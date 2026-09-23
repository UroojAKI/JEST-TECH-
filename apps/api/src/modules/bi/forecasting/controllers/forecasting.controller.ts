import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleType } from '@prisma/client';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import type { RequestUser } from '../../../auth/decorators/current-user.decorator';
import { StatisticalPredictionService } from '../services/statistical-prediction/statistical-prediction.service';

@ApiTags('Business Intelligence Forecasting')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('forecasting')
export class ForecastingController {
  constructor(
    private readonly forecastingService: StatisticalPredictionService,
  ) {}

  @Get('revenue')
  @Roles(RoleType.ADMIN)
  @ApiOperation({
    summary:
      'Predict future revenue pipeline based on historical moving average',
  })
  async forecastRevenue(
    @CurrentUser() actor: RequestUser,
    @Query('monthsAhead') monthsAheadStr?: string,
    @Query('branchId') branchId?: string,
  ) {
    const monthsAhead = monthsAheadStr ? parseInt(monthsAheadStr, 10) : 3;
    const amount = await this.forecastingService.forecastRevenue(
      monthsAhead,
      branchId,
      actor,
    );
    return { monthsAhead, branchId, forecastedRevenue: amount };
  }

  @Get('renewals')
  @Roles(RoleType.ADMIN)
  @ApiOperation({ summary: 'Predict expected policy renewals' })
  async forecastRenewals(
    @CurrentUser() actor: RequestUser,
    @Query('monthsAhead') monthsAheadStr?: string,
    @Query('branchId') branchId?: string,
  ) {
    const monthsAhead = monthsAheadStr ? parseInt(monthsAheadStr, 10) : 1;
    const expectedCount = await this.forecastingService.forecastRenewals(
      monthsAhead,
      branchId,
      actor,
    );
    return { monthsAhead, branchId, expectedRenewalsCount: expectedCount };
  }

  @Get('customer-risk/:customerId')
  @Roles(RoleType.ADMIN)
  @ApiOperation({ summary: 'Predict customer churn risk score' })
  async predictRisk(
    @Param('customerId') customerId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    const riskScore = await this.forecastingService.predictCustomerRisk(
      customerId,
      actor,
    );
    return { customerId, churnProbabilityScore: riskScore };
  }
}
