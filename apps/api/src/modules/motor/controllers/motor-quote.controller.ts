import { Controller, Post, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { MotorCalculationService } from '../services/motor-calculation.service';
import { PrismaService } from '../../../database/prisma.service';
import { MotorCalculationInputDto } from '../dto/motor-calculation.dto';

@Controller('motor/quotes')
@UseGuards(JwtAuthGuard)
export class MotorQuoteController {
  constructor(
    private readonly calculationService: MotorCalculationService,
    private readonly prisma: PrismaService,
  ) {}

  @Post(':id/finalize')
  async finalizeQuote(
    @Param('id') id: string,
    @Body() input: MotorCalculationInputDto
  ) {
    // 1. Authoritative Backend Calculation
    const calcResult = await this.calculationService.calculate(input);

    // 2. Persist the snapshot
    const quote = await this.prisma.quotation.update({
      where: { id },
      data: {
        totalPremium: calcResult.outputs.totalPremium,
        basePremium: calcResult.outputs.baseOdPremium + calcResult.outputs.baseTpPremium,
        gstAmount: calcResult.outputs.totalGst,
        calculationSnapshot: calcResult as any,
        calculationVersion: calcResult.calculationVersion,
        rateConfigurationVersion: calcResult.rateConfigurationVersion,
        issuanceStatus: 'PROPOSAL_READY'
      }
    });

    return quote;
  }
}
