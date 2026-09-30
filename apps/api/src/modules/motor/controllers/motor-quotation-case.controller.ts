import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../../auth/decorators/current-user.decorator';
import { RoleType } from '@prisma/client';
import { MotorQuotationCaseService } from '../services/motor-quotation-case.service';
import {
  CreateMotorQuotationCaseDto,
  SelectCaseQuotationDto,
  TransitionCaseStatusDto,
  CancelCaseDto,
} from '../dto/motor-quotation-case.dto';

@ApiTags('Motor Quotation Cases (V2 Architecture)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('motor/quotation-cases')
export class MotorQuotationCaseController {
  constructor(private readonly caseService: MotorQuotationCaseService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(RoleType.AGENT, RoleType.BACK_OFFICE, RoleType.ADMIN)
  @ApiOperation({
    summary: 'Create a new Motor Quotation Case',
    description: 'Establishes the authoritative case baseline snapshots for multiple quotation iterations.',
  })
  @ApiResponse({ status: 201, description: 'Motor quotation case created successfully.' })
  async createCase(
    @Body() dto: CreateMotorQuotationCaseDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.caseService.createCase(dto, user);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleType.AGENT, RoleType.BACK_OFFICE, RoleType.ADMIN)
  @ApiOperation({
    summary: 'Retrieve Motor Quotation Case by ID',
    description: 'Fetches case with all associated quotations, documents, and baseline snapshots.',
  })
  async getCase(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.caseService.getCase(id, user);
  }

  @Get('lead/:leadId')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleType.AGENT, RoleType.BACK_OFFICE, RoleType.ADMIN)
  @ApiOperation({
    summary: 'List Motor Quotation Cases for a lead',
    description: 'Returns all quotation cases linked to the specified lead with quote summaries.',
  })
  async getCasesForLead(
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.caseService.getCasesForLead(leadId, user);
  }

  @Post(':id/select')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleType.AGENT, RoleType.BACK_OFFICE, RoleType.ADMIN)
  @ApiOperation({
    summary: 'Select a winning quotation for this case',
    description: 'Binds selectedQuotationId on the case and transitions quotation status to ACCEPTED.',
  })
  async selectQuotation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SelectCaseQuotationDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.caseService.selectQuotation(id, dto.quotationId, user);
  }

  @Get(':id/compare')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleType.AGENT, RoleType.BACK_OFFICE, RoleType.ADMIN)
  @ApiOperation({
    summary: 'Compare all quotations in this case side-by-side',
    description: 'Returns structured multi-insurer comparison matrix for this motor case.',
  })
  async compareCaseQuotations(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.caseService.compareCaseQuotations(id, user);
  }

  @Post(':id/transition')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleType.AGENT, RoleType.BACK_OFFICE, RoleType.ADMIN)
  @ApiOperation({
    summary: 'Transition Motor Quotation Case status',
    description: 'Enforces canonical lifecycle state machine validation (OPEN -> QUOTED -> SELECTED -> COMPLETED, or CANCELLED).',
  })
  async transitionStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransitionCaseStatusDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.caseService.transitionCaseStatus(id, dto.targetStatus as any, user, dto.reason);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleType.AGENT, RoleType.BACK_OFFICE, RoleType.ADMIN)
  @ApiOperation({
    summary: 'Cancel Motor Quotation Case',
    description: 'Cancels case from OPEN or QUOTED status with audit reason.',
  })
  async cancelCase(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelCaseDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.caseService.cancelCase(id, dto.reason, user);
  }
}