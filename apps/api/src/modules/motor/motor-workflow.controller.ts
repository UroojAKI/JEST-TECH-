import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/decorators/current-user.decorator';
import {
  MotorQuoteWorkflowService,
  CapturePreviousPolicyDto,
} from './services/motor-quote-workflow.service';
import {
  MotorPaymentTrackingService,
  RecordPaymentDto,
} from './services/motor-payment-tracking.service';

@ApiTags('Motor — Workflow')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('motor')
export class MotorWorkflowController {
  constructor(
    private readonly workflowService: MotorQuoteWorkflowService,
    private readonly paymentService: MotorPaymentTrackingService,
  ) {}

  @Post('quotations/:id/previous-policy')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  @ApiOperation({
    summary: 'Capture previous policy and run the Motor Rule Engine.',
  })
  async capturePreviousPolicy(
    @Param('id') quotationId: string,
    @Body() dto: Omit<CapturePreviousPolicyDto, 'quotationId'>,
  ) {
    return this.workflowService.capturePreviousPolicyAndEvaluate({
      ...dto,
      quotationId,
    });
  }

  @Get('quotations/:id/rule-evaluation')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  @ApiOperation({
    summary: 'Re-run the Motor Rule Engine from stored source context.',
  })
  async getRuleEvaluation(@Param('id') quotationId: string) {
    return this.workflowService.reEvaluate(quotationId);
  }

  @Post('quotations/:id/payment')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  @ApiOperation({
    summary: 'Record payment tracking state. Only Finance may verify PAID.',
  })
  async recordPayment(
    @Param('id') quotationId: string,
    @Body()
    dto: Omit<
      RecordPaymentDto,
      'quotationId' | 'recordedById' | 'recordedByRole'
    >,
    @CurrentUser() user: RequestUser,
  ) {
    return this.paymentService.recordPayment({
      ...dto,
      quotationId,
      recordedById: user.id,
      recordedByRole: user.role,
    });
  }

  @Get('quotations/:id/payment')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  @ApiOperation({ summary: 'Get payment record for a quotation.' })
  async getPayment(@Param('id') quotationId: string) {
    return this.paymentService.getPayment(quotationId);
  }

  @Get('quotations/:id/policy-gate')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  @ApiOperation({ summary: 'Check the server-side policy issuance gate.' })
  async policyCreationGate(@Param('id') quotationId: string) {
    return this.paymentService.canProceedToPolicy(quotationId);
  }
}
