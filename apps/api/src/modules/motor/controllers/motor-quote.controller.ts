import {
  Body,
  Controller,
  Param,
  Post,
  UseGuards,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
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
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  async finalizeQuote(
    @Param('id') id: string,
    @Body() input: MotorCalculationInputDto,
    @CurrentUser() user: RequestUser,
  ) {
    const quote = await this.prisma.quotation.findUnique({
      where: { id },
    });

    if (!quote || (quote as any).deletedAt) {
      throw new NotFoundException(`Quotation ${id} not found`);
    }

    const actorCompanyId = user.companyId || user.organizationId;
    if (
      actorCompanyId &&
      quote.companyId &&
      quote.companyId !== actorCompanyId
    ) {
      throw new ForbiddenException('Quotation belongs to another organization');
    }

    if (user.role === RoleType.AGENT) {
      const isOwner =
        quote.createdById === user.id ||
        (user.agentId && quote.agentId === user.agentId);
      if (!isOwner) {
        throw new ForbiddenException(
          'Agents can only finalize their own quotations',
        );
      }
    }

    const calcResult = await this.calculationService.calculate(input);

    return this.prisma.quotation.update({
      where: { id },
      data: {
        totalPremium: calcResult.outputs.totalPremium,
        basePremium:
          calcResult.outputs.baseOdPremium + calcResult.outputs.baseTpPremium,
        gstAmount: calcResult.outputs.totalGst,
        calculationSnapshot: calcResult as any,
        calculationVersion: calcResult.calculationVersion,
        // rateConfig is stored inside calculationSnapshot for full auditability.
        issuanceStatus: 'PROPOSAL_READY',
      },
    });
  }

  @Post(':id/issue')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  async issuePolicy(
    @Param('id') quoteId: string,
    @Body() dto: IssueMotorPolicyDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.issuanceService.issuePolicy(quoteId, dto, user);
  }
}
