import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/decorators/current-user.decorator';
import { MotorQuoteWorkflowService, CapturePreviousPolicyDto } from './services/motor-quote-workflow.service';
import { MotorInspectionService, CreateInspectionDto } from './services/motor-inspection.service';
import { MotorPaymentTrackingService, RecordPaymentDto } from './services/motor-payment-tracking.service';

@ApiTags('Motor — Workflow')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('motor')
export class MotorWorkflowController {
  constructor(
    private readonly workflowService: MotorQuoteWorkflowService,
    private readonly inspectionService: MotorInspectionService,
    private readonly paymentService: MotorPaymentTrackingService,
  ) {}

  // ─── Previous Policy + Rule Engine ───────────────────────────────────────

  @Post('quotations/:id/previous-policy')
  @ApiOperation({ summary: 'Capture previous policy and run the Motor Rule Engine. Returns NCB decision and inspection requirement.' })
  async capturePreviousPolicy(
    @Param('id') quotationId: string,
    @Body() dto: Omit<CapturePreviousPolicyDto, 'quotationId'>,
  ) {
    return this.workflowService.capturePreviousPolicyAndEvaluate({ ...dto, quotationId });
  }

  @Get('quotations/:id/rule-evaluation')
  @ApiOperation({ summary: 'Re-run rule engine from stored context — always recalculated, never trusts stored result alone.' })
  async getRuleEvaluation(@Param('id') quotationId: string) {
    return this.workflowService.reEvaluate(quotationId);
  }

  // ─── Inspection ──────────────────────────────────────────────────────────

  @Post('inspections')
  @ApiOperation({ summary: 'Create inspection record for a quotation.' })
  async createInspection(
    @Body() dto: Omit<CreateInspectionDto, 'createdById'>,
    @CurrentUser() user: RequestUser,
  ) {
    return this.inspectionService.createInspection({ ...dto, createdById: user.id });
  }

  @Get('quotations/:id/inspection')
  @ApiOperation({ summary: 'Get inspection status for a quotation.' })
  async getInspection(@Param('id') quotationId: string) {
    return this.inspectionService.getInspection(quotationId);
  }

  @Post('inspections/:id/complete')
  @ApiOperation({ summary: 'Mark inspection as completed. Validates all 7 photos are uploaded.' })
  async completeInspection(
    @Param('id') inspectionId: string,
    @Body() body: { pdfKey?: string; pdfUrl?: string },
  ) {
    return this.inspectionService.completeInspection(inspectionId, body.pdfKey, body.pdfUrl);
  }

  @Post('inspections/:id/reject')
  @ApiOperation({ summary: 'Reject an inspection with a reason.' })
  async rejectInspection(
    @Param('id') inspectionId: string,
    @Body('reason') reason: string,
  ) {
    return this.inspectionService.rejectInspection(inspectionId, reason);
  }

  // ─── Payment ─────────────────────────────────────────────────────────────

  @Post('quotations/:id/payment')
  @ApiOperation({ summary: 'Record payment status (NOT_DONE / UNDER_PROCESS / PAID). No gateway — tracking only.' })
  async recordPayment(
    @Param('id') quotationId: string,
    @Body() dto: Omit<RecordPaymentDto, 'quotationId' | 'recordedById'>,
    @CurrentUser() user: RequestUser,
  ) {
    return this.paymentService.recordPayment({ ...dto, quotationId, recordedById: user.id });
  }

  @Get('quotations/:id/payment')
  @ApiOperation({ summary: 'Get payment record for a quotation.' })
  async getPayment(@Param('id') quotationId: string) {
    return this.paymentService.getPayment(quotationId);
  }

  @Get('quotations/:id/policy-gate')
  @ApiOperation({ summary: 'Check if all conditions are met for policy creation. Backend-enforced gate.' })
  async policyCreationGate(@Param('id') quotationId: string) {
    return this.paymentService.canProceedToPolicy(quotationId);
  }
}
