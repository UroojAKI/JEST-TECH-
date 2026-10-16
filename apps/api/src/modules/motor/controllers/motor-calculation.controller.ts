import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RoleType } from '@prisma/client';
import { MotorCalculationService } from '../services/motor-calculation.service';
import { MotorCalculationInputDto } from '../dto/motor-calculation.dto';
import { MotorCalculationOverrideInputDto } from '../dto/motor-pricing-contract.dto';

@Controller('motor/calculate')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MotorCalculationController {
  constructor(private readonly calculationService: MotorCalculationService) {}

  @Post()
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  async calculate(@Body() input: MotorCalculationInputDto) {
    return this.calculationService.calculate(input);
  }

  /**
   * Controlled Tax & Tariff Override Route (D-03, T-08)
   * Strictly limited to ADMIN and BACK_OFFICE. AGENTS calling this receive 403 Forbidden.
   */
  @Post('override')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  async calculateWithOverride(
    @Body() input: MotorCalculationOverrideInputDto,
    @Req() req: any,
  ) {
    return this.calculationService.calculateWithOverride(input, req.user);
  }
}
