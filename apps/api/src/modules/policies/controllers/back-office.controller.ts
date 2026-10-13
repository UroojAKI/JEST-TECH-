import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RoleType } from '@prisma/client';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { RequestUser } from '../../auth/decorators/current-user.decorator';

import { BackOfficeQueueService } from '../services/queries/back-office-queue.service';
import { IssuePolicyService } from '../services/commands/issue-policy.service';
import { MotorPolicyIssuanceService } from '../../motor/services/motor-policy-issuance.service';
import { IssueMotorPolicyDto } from '../../motor/dto/issue-motor-policy.dto';
import { PrismaService } from '../../../database/prisma.service';

@ApiTags('Back Office Workbench & Policy Issuance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('back-office')
export class BackOfficeController {
  constructor(
    private readonly backOfficeQueueService: BackOfficeQueueService,
    private readonly issuePolicyService: IssuePolicyService,
    private readonly motorPolicyIssuanceService: MotorPolicyIssuanceService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('queue')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  @ApiOperation({
    summary:
      'Get Back-Office policy issuance workbench queue with multi-gate validation (G021)',
  })
  async getQueue(
    @CurrentUser() user: RequestUser,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.backOfficeQueueService.getBackOfficeQueue(user, { search, status });
  }

  @Post('issue/:quotationId')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({
    summary: 'Validate multi-gates and execute transactional policy issuance',
  })
  async issuePolicy(
    @Param('quotationId', ParseUUIDPipe) quotationId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto?: IssueMotorPolicyDto,
  ) {
    // 1. Validate all hard gates with tenant context
    await this.backOfficeQueueService.validateIssuanceGates(quotationId, user);

    const quotation = await this.prisma.quotation.findUnique({
      where: { id: quotationId },
      select: { productType: true },
    });

    if (!quotation) {
      throw new NotFoundException(`Quotation with ID ${quotationId} not found.`);
    }

    let policy: any;

    if (quotation.productType === 'MOTOR') {
      // Motor policies must be issued exclusively via MotorPolicyIssuanceService
      policy = await this.motorPolicyIssuanceService.issuePolicy(
        quotationId,
        dto || {},
        user,
      );
    } else {
      // Non-motor policies use standard IssuePolicyService
      policy = await this.issuePolicyService.execute(
        {
          quotationId,
          productLine: 'General Policy',
          ...dto,
        },
        user.id,
        user,
      );
    }

    return {
      success: true,
      policy,
      message: `Policy successfully issued under number ${policy.policyNumber}. Confirmation documents generated.`,
    };
  }
}
