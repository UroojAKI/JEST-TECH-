import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RoleType } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../../auth/decorators/current-user.decorator';
import { LifeQuotationCaseService } from '../services/life-quotation-case.service';
import { LifeQuotationCalculationService } from '../services/life-quotation-calculation.service';
import {
  AddLifeQuoteDto,
  CreateLifeQuotationCaseDto,
  LifeCaseFilterDto,
  RecordLifePaymentDto,
  SelectLifeQuoteDto,
  UpdateLifeQuotationCaseDto,
} from '../dto/life-quotation-case.dto';

@ApiTags('Life Quotation Cases')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.AGENT, RoleType.BACK_OFFICE, RoleType.ADMIN)
@Controller('life/quotation-cases')
export class LifeQuotationCaseController {
  constructor(
    private readonly caseService: LifeQuotationCaseService,
    private readonly calculationService: LifeQuotationCalculationService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a Life proposal (case) with underwriting, nominee and category details' })
  @ApiResponse({ status: 201, description: 'Life quotation case created successfully.' })
  createCase(@Body() dto: CreateLifeQuotationCaseDto, @CurrentUser() user: RequestUser) {
    return this.caseService.createCase(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List Life proposal cases for the tenant with optional filters' })
  findAll(@Query() filter: LifeCaseFilterDto, @CurrentUser() user: RequestUser) {
    return this.caseService.getAllCases(user, filter);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a Life proposal case with quotations, riders and documents' })
  getCase(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.caseService.getCase(id, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update Life proposal case details' })
  updateCase(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLifeQuotationCaseDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.caseService.updateCase(id, dto, user);
  }

  @Post(':id/quotes')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add an insurer quote with optional riders to the proposal case' })
  addQuote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddLifeQuoteDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.caseService.addQuote(id, dto, user);
  }

  @Post(':id/select')
  @ApiOperation({ summary: 'Select the winning quotation for the proposal case' })
  selectQuote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SelectLifeQuoteDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.caseService.selectQuote(id, dto.quotationId, user);
  }

  @Post('premium/preview')
  @ApiOperation({ summary: 'Preview Life premium: base + riders + statutory GST and brokerage calculation' })
  previewPremium(@Body() dto: AddLifeQuoteDto) {
    return this.calculationService.calculate({
      planCategory: (dto as any).planCategory || 'TERM_INSURANCE',
      basePremium: dto.basePremium,
      discountAmount: dto.discountAmount,
      brokeragePercent: dto.brokeragePercent,
      riders: dto.riders,
    });
  }

  @Post(':id/payment')
  @ApiOperation({ summary: 'Record or verify payment for the selected quote in the Life proposal' })
  recordPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordLifePaymentDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.caseService.recordPayment(caseId(id), dto, user);
  }
}

function caseId(id: string): string {
  return id;
}

