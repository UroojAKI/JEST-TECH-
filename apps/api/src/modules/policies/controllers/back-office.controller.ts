import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
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

@ApiTags('Back Office Workbench & Policy Issuance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('back-office')
export class BackOfficeController {
  constructor(
    private readonly backOfficeQueueService: BackOfficeQueueService,
    private readonly issuePolicyService: IssuePolicyService,
  ) {}

  @Get('queue')
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.OPERATIONS,
    RoleType.UNDERWRITER,
    RoleType.POLICY_ISSUANCE_EXECUTIVE,
    RoleType.BRANCH_MANAGER,
  )
  @ApiOperation({ summary: 'Get Back-Office policy issuance workbench queue with multi-gate validation (G021)' })
  async getQueue(
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.backOfficeQueueService.getBackOfficeQueue({ search, status });
  }

  @Post('issue/:quotationId')
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.OPERATIONS,
    RoleType.POLICY_ISSUANCE_EXECUTIVE,
  )
  @ApiOperation({ summary: 'Validate multi-gates and execute transactional policy issuance' })
  async issuePolicy(
    @Param('quotationId', ParseUUIDPipe) quotationId: string,
    @CurrentUser() user: RequestUser,
  ) {
    // 1. Validate all 4 hard gates
    await this.backOfficeQueueService.validateIssuanceGates(quotationId);

    // 2. Execute transactional policy issuance
    const policy = await this.issuePolicyService.execute(
      {
        quotationId,
        productLine: 'Motor Policy',
        policyType: 'COMPREHENSIVE',
        effectiveDate: new Date().toISOString(),
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      },
      user.id,
    );

    return {
      success: true,
      policy,
      message: `Policy successfully issued under number ${policy.policyNumber}. Confirmation documents generated.`,
    };
  }
}
