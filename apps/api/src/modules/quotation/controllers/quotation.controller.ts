import {
  BadRequestException,
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
  ) {}

  @Post('motor-capture')
  @HttpCode(HttpStatus.CREATED)
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  @ApiOperation({
    summary: 'List all revision version snapshots for a quotation',
  })
  async getVersions(@Param('id', ParseUUIDPipe) id: string) {
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
  @ApiOperation({
    summary:
      'Save missing details inline and dynamically recalculate completion percentage',
  })
  async updateDetails(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() details: Record<string, any>,
  ) {
    return this.quotationCompletionService.updateDetails(id, details);
  }
}
