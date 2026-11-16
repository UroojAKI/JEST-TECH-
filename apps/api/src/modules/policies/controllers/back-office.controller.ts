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
import { IssueBackOfficePolicyDto } from '../dto/issue-back-office-policy.dto';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma } from '@prisma/client';

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
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('productType') productType?: 'MOTOR' | 'HEALTH',
  ) {
    return this.backOfficeQueueService.getBackOfficeQueue(user, {
      search,
      status,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      productType,
    });
  }

  @Post('issue/:quotationId')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  @ApiOperation({
    summary: 'Validate multi-gates and execute transactional policy issuance',
  })
  async issuePolicy(
    @Param('quotationId', ParseUUIDPipe) quotationId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto?: IssueBackOfficePolicyDto,
  ) {
    const quotation = await this.prisma.quotation.findUnique({
      where: { id: quotationId },
      include: { motorPaymentRecord: true },
    });

    if (!quotation) {
      throw new NotFoundException(`Quotation with ID ${quotationId} not found.`);
    }

    // If manual entry confirmed payment received with reference, ensure payment record is reconciled prior to gate checks
    if (
      dto?.confirmPaymentReceived &&
      (dto?.paymentReference || dto?.actualPolicyNumber) &&
      (!quotation.motorPaymentRecord || quotation.motorPaymentRecord.status !== 'PAID')
    ) {
      const rawRef = (dto.paymentReference || '').trim();
      const refNumber = rawRef || `MANUAL-${dto.actualPolicyNumber || Date.now()}`;
      const paidAmount = dto.actualPremium
        ? new Prisma.Decimal(dto.actualPremium)
        : new Prisma.Decimal(quotation.totalPremium);

      await this.prisma.motorPaymentRecord.upsert({
        where: { quotationId },
        update: {
          status: 'PAID',
          amount: paidAmount,
          referenceNumber: refNumber,
          paymentMethod: (dto.paymentMethod || 'DIRECT_SETTLEMENT') as any,
          paidAt: new Date(),
          recordedById: user.userId || user.id,
        },
        create: {
          companyId: quotation.companyId,
          quotationId,
          status: 'PAID',
          amount: paidAmount,
          referenceNumber: refNumber,
          paymentMethod: (dto.paymentMethod || 'DIRECT_SETTLEMENT') as any,
          paidAt: new Date(),
          recordedById: user.userId || user.id,
        },
      });
    }

    // 1. Validate all hard gates with tenant context
    await this.backOfficeQueueService.validateIssuanceGates(quotationId, user);

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
          productLine:
            quotation.productType === 'HEALTH'
              ? 'Health Insurance'
              : quotation.productType === 'LIFE'
                ? 'Life Insurance'
                : 'General Policy',
          ...dto,
          effectiveDate: dto?.effectiveDate || dto?.startDate,
          expiryDate: dto?.expiryDate || dto?.endDate,
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
