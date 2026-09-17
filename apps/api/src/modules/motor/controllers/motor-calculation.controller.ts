import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RoleType } from '@prisma/client';
import { MotorCalculationService } from '../services/motor-calculation.service';
import { MotorCalculationInputDto } from '../dto/motor-calculation.dto';

@Controller('motor/calculate')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
export class MotorCalculationController {
  constructor(private readonly calculationService: MotorCalculationService) {}

  @Post()
  async calculate(@Body() input: MotorCalculationInputDto) {
    return this.calculationService.calculate(input);
  }
}
