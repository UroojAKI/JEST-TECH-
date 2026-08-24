import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { MotorCalculationService } from '../services/motor-calculation.service';
import { MotorCalculationInputDto } from '../dto/motor-calculation.dto';

@Controller('motor/calculate')
@UseGuards(JwtAuthGuard)
export class MotorCalculationController {
  constructor(private readonly calculationService: MotorCalculationService) {}

  @Post()
  async calculate(@Body() input: MotorCalculationInputDto) {
    return this.calculationService.calculate(input);
  }
}
