import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/decorators/current-user.decorator';
import { MotorQuoteWorkflowService, CapturePreviousPolicyDto } from './services/motor-quote-workflow.service';
import { MotorInspectionService, CreateInspectionDto, InspectionPhotoType } from './services/motor-inspection.service';
import { MotorPaymentTrackingService, RecordPaymentDto } from './services/motor-payment-tracking.service';

const SALES_ROLES = [
  RoleType.SUPER_ADMIN,
  RoleType.ADMIN,
  RoleType.SALES_MANAGER,
  RoleType.SALES_EXECUTIVE,
  RoleType.SALES_AGENT,
  RoleType.POSP_ADVISOR,
  RoleType.OPERATIONS,
];

@ApiTags('Motor — Workflow')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('motor')
export class MotorWorkflowController {
  constructor(
    private readonly workflowService: MotorQuoteWorkflowService,
    private readonly inspectionService: MotorInspectionService,
    private readonly paymentService: MotorPaymentTrackingService,
  ) {}

  @Post('quotations/:id/previous-policy')
  @Roles(...SALES_ROLES)
  @ApiOperation({ summary: 'Capture previous policy and run the Motor Rule Engine.' })
  async capturePreviousPolicy(@Param('id') quotationId: string, @Body() dto: Omit<CapturePreviousPolicyDto, 'quotationId'>) {
    return this.workflowService.capturePreviousPolicyAndEvaluate({ ...dto, quotationId });
  }

  @Get('quotations/:id/rule-evaluation')
  @Roles(...SALES_ROLES)
  @ApiOperation({ summary: 'Re-run the Motor Rule Engine from stored source context.' })
  async getRuleEvaluation(@Param('id') quotationId: string) {
    return this.workflowService.reEvaluate(quotationId);
  }

  @Post('inspections')
  @Roles(...SALES_ROLES)
  @ApiOperation({ summary: 'Create an inspection record. No placeholder evidence is created.' })
  async createInspection(@Body() dto: Omit<CreateInspectionDto, 'createdById'>, @CurrentUser() user: RequestUser) {
    return this.inspectionService.createInspection({ ...dto, createdById: user.id });
  }

  @Get('quotations/:id/inspection')
  @Roles(...SALES_ROLES)
  @ApiOperation({ summary: 'Get inspection status for a quotation.' })
  async getInspection(@Param('id') quotationId: string) {
    return this.inspectionService.getInspection(quotationId);
  }

  @Post('inspections/:id/photos')
  @Roles(...SALES_ROLES)
  @ApiOperation({ summary: 'Record one real inspection photo storage key.' })
  async recordInspectionPhoto(@Param('id') inspectionId: string, @Body() body: { photoType: InspectionPhotoType; storageKey: string }) {
    return this.inspectionService.recordPhoto(inspectionId, body.photoType, body.storageKey);
  }

  @Post('inspections/:id/complete')
  @Roles(...SALES_ROLES)
  @ApiOperation({ summary: 'Complete an inspection only after all 7 required photos exist.' })
  async completeInspection(@Param('id') inspectionId: string, @Body() body: { pdfKey?: string; pdfUrl?: string }) {
    return this.inspectionService.completeInspection(inspectionId, body.pdfKey, body.pdfUrl);
  }

  @Post('inspections/:id/reject')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.OPERATIONS, RoleType.POLICY_ISSUANCE_EXECUTIVE, RoleType.SALES_MANAGER)
  @ApiOperation({ summary: 'Reject an inspection with a reason.' })
  async rejectInspection(@Param('id') inspectionId: string, @Body('reason') reason: string) {
    return this.inspectionService.rejectInspection(inspectionId, reason);
  }

  @Post('quotations/:id/payment')
  @Roles(...SALES_ROLES)
  @ApiOperation({ summary: 'Record payment tracking state. PAID requires amount and reference.' })
  async recordPayment(@Param('id') quotationId: string, @Body() dto: Omit<RecordPaymentDto, 'quotationId' | 'recordedById'>, @CurrentUser() user: RequestUser) {
    return this.paymentService.recordPayment({ ...dto, quotationId, recordedById: user.id });
  }

  @Get('quotations/:id/payment')
  @Roles(...SALES_ROLES)
  @ApiOperation({ summary: 'Get payment record for a quotation.' })
  async getPayment(@Param('id') quotationId: string) {
    return this.paymentService.getPayment(quotationId);
  }

  @Get('quotations/:id/policy-gate')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.OPERATIONS, RoleType.POLICY_ISSUANCE_EXECUTIVE, RoleType.SALES_MANAGER)
  @ApiOperation({ summary: 'Check the server-side policy issuance gate.' })
  async policyCreationGate(@Param('id') quotationId: string) {
    return this.paymentService.canProceedToPolicy(quotationId);
  }
}
