import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RoleType } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../../auth/decorators/current-user.decorator';
import { HealthQuotationCaseService } from '../services/health-quotation-case.service';
import { HealthPremiumService } from '../services/health-premium.service';
import {
  AddHealthQuoteDto,
  CreateHealthQuotationCaseDto,
  SelectHealthQuoteDto,
} from '../dto/health-quotation-case.dto';

@ApiTags('Health Quotation Cases')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.AGENT, RoleType.BACK_OFFICE, RoleType.ADMIN)
@Controller('health/quotation-cases')
export class HealthQuotationCaseController {
  constructor(
    private readonly caseService: HealthQuotationCaseService,
    private readonly premiumService: HealthPremiumService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a Health proposal (case) with insured members and nominee' })
  @ApiResponse({ status: 201, description: 'Health quotation case created.' })
  createCase(@Body() dto: CreateHealthQuotationCaseDto, @CurrentUser() user: RequestUser) {
    return this.caseService.createCase(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List all Health cases for the tenant' })
  findAll(@CurrentUser() user: RequestUser) {
    return this.caseService.getAllCases(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a Health case with members, quotes and documents' })
  getCase(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.caseService.getCase(id, user);
  }

  @Get('lead/:leadId')
  @ApiOperation({ summary: 'List Health cases for a lead' })
  getCasesForLead(@Param('leadId', ParseUUIDPipe) leadId: string, @CurrentUser() user: RequestUser) {
    return this.caseService.getCasesForLead(leadId, user);
  }

  @Post(':id/quotes')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add an insurer quote to the case (multiple quotes per case allowed)' })
  addQuote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddHealthQuoteDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.caseService.addQuote(id, dto, user);
  }

  @Post(':id/select')
  @ApiOperation({ summary: 'Select the winning quote for the case' })
  selectQuote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SelectHealthQuoteDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.caseService.selectQuote(id, dto.quotationId, user);
  }

  @Post('premium/preview')
  @ApiOperation({ summary: 'Preview premium: base + rider + 18% GST, and commission' })
  previewPremium(@Body() dto: AddHealthQuoteDto) {
    return this.premiumService.calculate({
      basePremium: dto.basePremium,
      riders: dto.riders,
      commissionPercent: dto.commissionPercent,
      riderCommissionPercent: dto.riderCommissionPercent,
    });
  }
}
