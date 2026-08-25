import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { RequestUser } from '../../auth/decorators/current-user.decorator';
import { MotorCalculationService } from '../services/motor-calculation.service';
import { MotorPolicyIssuanceService } from '../services/motor-policy-issuance.service';
import { PrismaService } from '../../../database/prisma.service';
import { MotorCalculationInputDto } from '../dto/motor-calculation.dto';
import { IssueMotorPolicyDto } from '../dto/issue-motor-policy.dto';

@Controller('motor/quotes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MotorQuoteController {
  constructor(
    private readonly calculationService: MotorCalculationService,
    private readonly issuanceService: MotorPolicyIssuanceService,
    private readonly prisma: PrismaService,
  ) {}

  @Post(':id/finalize')
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.BRANCH_MANAGER,
    RoleType.TEAM_LEADER,
    RoleType.SALES_MANAGER,
    RoleType.SALES_EXECUTIVE,
    RoleType.SALES_AGENT,
    RoleType.POSP_ADVISOR,
  )
  async finalizeQuote(
    @Param('id') id: string,
    @Body() input: MotorCalculationInputDto,
  ) {
    const calcResult = await this.calculationService.calculate(input);

    return this.prisma.quotation.update({
      where: { id },
      data: {
        totalPremium: calcResult.outputs.totalPremium,
        basePremium: calcResult.outputs.baseOdPremium + calcResult.outputs.baseTpPremium,
        gstAmount: calcResult.outputs.totalGst,
        calculationSnapshot: calcResult as any,
        calculationVersion: calcResult.calculationVersion,
        rateConfigurationVersion: calcResult.rateConfigurationVersion,
        issuanceStatus: 'PROPOSAL_READY',
      },
    });
  }

  @Post(':id/issue')
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.OPERATIONS,
    RoleType.POLICY_ISSUANCE_EXECUTIVE,
  )
  async issuePolicy(
    @Param('id') quoteId: string,
    @Body() dto: IssueMotorPolicyDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.issuanceService.issuePolicy(quoteId, dto, user);
  }
}
