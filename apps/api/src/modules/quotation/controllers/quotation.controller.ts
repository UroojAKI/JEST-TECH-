import {
  BadRequestException,
  ForbiddenException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Patch,
  Query,
  UseGuards,
  ParseUUIDPipe,
  Optional,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { RoleType } from '@prisma/client';
import { SkipThrottle } from '@nestjs/throttler';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { RequestUser } from '../../auth/decorators/current-user.decorator';

import { CreateQuotationDto } from '../dto/create-quotation.dto';
import { CreateMotorCaptureDto } from '../dto/create-motor-capture.dto';
import {
  CalculateComparativeQuotesDto,
  EnterpriseCompareDto,
} from '../dto/calculate-quotes.dto';
import { ContactsService } from '../../contacts/services/contacts.service';
import { NumberingEngineService } from '../../administration/services/numbering-engine/numbering-engine.service';
import { GenerateQuotationService } from '../services/commands/generate-quotation.service';
import { ApproveQuotationService } from '../services/commands/approve-quotation.service';
import { RejectQuotationService } from '../services/commands/reject-quotation.service';
import { ConvertQuotationService } from '../services/commands/convert-quotation.service';
import { AcceptQuotationService } from '../services/commands/accept-quotation.service';
import {
  CreateQuotationVersionService,
  CreateQuotationVersionInputDto,
} from '../services/commands/create-quotation-version.service';
import { GetQuotationService } from '../services/queries/get-quotation.service';
import { CompareQuotationService } from '../services/queries/compare-quotation.service';
import { GetQuotationHistoryService } from '../services/queries/get-quotation-history.service';
import { ComparisonService } from '../engine/comparison.service';
import { PrismaService } from '../../../database/prisma.service';
import { PaginationDto } from '../../../common/pagination/pagination.dto';
import { MotorCalculationService } from '../../motor/services/motor-calculation.service';
import { QuotationCompletionService } from '../services/queries/quotation-completion.service';

import { CreateMotorQuotationCommand } from '../services/commands/create-motor-quotation.command';

@ApiTags('Quotations & Motor Wizard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('quotations')
export class QuotationController {
  constructor(
    private readonly generateQuotationService: GenerateQuotationService,
    private readonly approveQuotationService: ApproveQuotationService,
    private readonly rejectQuotationService: RejectQuotationService,
    private readonly convertQuotationService: ConvertQuotationService,
    private readonly acceptQuotationService: AcceptQuotationService,
    private readonly createQuotationVersionService: CreateQuotationVersionService,
    private readonly getQuotationService: GetQuotationService,
    private readonly compareQuotationService: CompareQuotationService,
    private readonly getQuotationHistoryService: GetQuotationHistoryService,
    private readonly comparisonEngine: ComparisonService,
    private readonly prisma: PrismaService,
    private readonly motorCalculationService: MotorCalculationService,
    private readonly contactsService: ContactsService,
    private readonly numberingEngine: NumberingEngineService,
    private readonly quotationCompletionService: QuotationCompletionService,
    @Optional()
    private readonly createMotorQuotationCommand?: CreateMotorQuotationCommand,
  ) {}

  @Post('motor-capture')
  @HttpCode(HttpStatus.CREATED)
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  @ApiOperation({
    summary:
      'Capture a Motor quotation using authoritative backend calculation and transactional command.',
  })
  async motorCapture(
    @Body() dto: CreateMotorCaptureDto,
    @CurrentUser() user: RequestUser,
  ) {
    if (!this.createMotorQuotationCommand) {
      throw new BadRequestException('CreateMotorQuotationCommand service is not available');
    }
    return this.createMotorQuotationCommand.execute(dto, user);
  }

  @SkipThrottle()
  @Post('calculate')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  calculate(@Body() dto: CalculateComparativeQuotesDto) {
    return this.comparisonEngine.generateComparativeQuotes(dto);
  }

  @SkipThrottle()
  @Post('enterprise-compare')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  @ApiOperation({ summary: 'Enterprise Multi-Insurer Quotation Gateway' })
  enterpriseCompare(@Body() dto: EnterpriseCompareDto) {
    return this.comparisonEngine.generateEnterpriseInsurerComparisons(dto);
  }

  /**
   * Retired intentionally. Motor issuance is now owned by POST /motor/quotes/:id/issue
   * and can only be executed after the backend workflow gate passes.
   */
  @Post('wizard/issue-policy')
  @HttpCode(HttpStatus.GONE)
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  retiredMotorIssuanceEndpoint() {
    return {
      message:
        'This issuance endpoint is retired. Use POST /motor/quotes/:id/issue after payment and workflow gates pass.',
    };
  }

  @Post()
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  create(@Body() dto: CreateQuotationDto, @CurrentUser() user: RequestUser) {
    return this.generateQuotationService.execute(dto, user.id);
  }

  @Get()
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  findAll(
    @CurrentUser() user: RequestUser,
    @Query() pagination: PaginationDto,
  ) {
    return this.getQuotationService.executeAll(user, pagination);
  }

  @Get(':id/completion')
  @SkipThrottle()
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  @ApiOperation({
    summary:
      'Evaluate dynamic checklist and progressive quotation completion percentage (§24, AUD-033)',
  })
  getCompletion(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.quotationCompletionService.getCompletion(id, user);
  }

  @Get(':id')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.getQuotationService.executeOne(id, user);
  }

  @Get(':id/history')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  getHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.getQuotationHistoryService.execute(id, user);
  }

  @Post('compare')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  compare(@Body('ids') ids: string[], @CurrentUser() user: RequestUser) {
    return this.compareQuotationService.execute(ids, user);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('comments') comments: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.approveQuotationService.execute(
      id,
      comments,
      user.id,
      user.role,
    );
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('comments') comments: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.rejectQuotationService.execute(id, comments, user.id);
  }

  @Post(':id/convert')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  convert(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.convertQuotationService.execute(id, user.id);
  }

  @Post(':id/accept')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  @ApiOperation({
    summary:
      'Customer accepts a quotation version (locks version, qualifies lead, supersedes competing drafts)',
  })
  accept(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('comments') comments: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.acceptQuotationService.execute(id, user.id, comments);
  }

  @Post(':id/versions')
  @HttpCode(HttpStatus.CREATED)
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  @ApiOperation({
    summary:
      'Create an immutable revision version (V2, V3...) under an existing quotation',
  })
  createVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateQuotationVersionInputDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.createQuotationVersionService.execute(id, dto, user.id);
  }

  @Get(':id/versions')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  @ApiOperation({
    summary: 'List all revision version snapshots for a quotation',
  })
  async getVersions(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    // Verify the quotation exists and actor has access (via getQuotationService)
    await this.getQuotationService.executeOne(id, user); // will throw if unauthorized
    return this.prisma.quotationVersion.findMany({
      where: { quotationId: id },
      orderBy: { versionNumber: 'desc' },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  @Patch(':id/details')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  @ApiOperation({
    summary:
      'Save missing details inline and dynamically recalculate completion percentage',
  })
  async updateDetails(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() details: Record<string, any>,
    @CurrentUser() user: RequestUser,
  ) {
    return this.quotationCompletionService.updateDetails(id, details, user);
  }
}
