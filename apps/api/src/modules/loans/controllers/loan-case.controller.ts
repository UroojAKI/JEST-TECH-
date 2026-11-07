import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ActorContext } from '../../../common/interfaces/actor-context.interface';
import { PaginationDto } from '../../../common/pagination/pagination.dto';
import { LoanCaseService } from '../services/loan-case.service';
import { LoanDocumentService } from '../services/loan-document.service';
import { CreateLoanCaseDto } from '../dto/create-loan-case.dto';
import { UpdateLoanCaseDto } from '../dto/update-loan-case.dto';
import { CreateLoanPartyDto } from '../dto/loan-party.dto';
import {
  IssueLoanSanctionDto,
  IssueLoanDisbursementDto,
  UpdateLoanStatusDto,
} from '../dto/issue-loan.dto';

@ApiTags('Loans')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('loans/cases')
export class LoanCaseController {
  constructor(
    private readonly loanCaseService: LoanCaseService,
    private readonly loanDocumentService: LoanDocumentService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new loan application enquiry' })
  async createCase(
    @Body() dto: CreateLoanCaseDto,
    @CurrentUser() actor: ActorContext,
  ) {
    return this.loanCaseService.createCase(dto, actor);
  }

  @Get()
  @ApiOperation({ summary: 'List loan application cases with tenant scoping and search' })
  async findAll(
    @Query() pagination: PaginationDto,
    @CurrentUser() actor: ActorContext,
    @Query('category') category?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.loanCaseService.findAll(pagination, actor, {
      category,
      status,
      search,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get loan application case details by ID' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: ActorContext,
  ) {
    return this.loanCaseService.findOne(id, actor);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update loan application case' })
  async updateCase(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLoanCaseDto,
    @CurrentUser() actor: ActorContext,
  ) {
    return this.loanCaseService.updateCase(id, dto, actor);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Directly update loan case status' })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLoanStatusDto,
    @CurrentUser() actor: ActorContext,
  ) {
    return this.loanCaseService.updateStatus(id, dto.status, actor, dto.reason);
  }

  @Post(':id/sanction')
  @ApiOperation({ summary: 'Issue or record loan sanction letter' })
  async issueSanction(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: IssueLoanSanctionDto,
    @CurrentUser() actor: ActorContext,
  ) {
    return this.loanCaseService.issueSanction(id, dto, actor);
  }

  @Post(':id/issue')
  @ApiOperation({ summary: 'Formally issue / disburse loan' })
  async issueLoan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: IssueLoanDisbursementDto,
    @CurrentUser() actor: ActorContext,
  ) {
    return this.loanCaseService.issueLoanDisbursement(id, dto, actor);
  }

  @Post(':id/disburse')
  @ApiOperation({ summary: 'Disburse loan with account number and payment reference' })
  async disburseLoan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: IssueLoanDisbursementDto,
    @CurrentUser() actor: ActorContext,
  ) {
    return this.loanCaseService.issueLoanDisbursement(id, dto, actor);
  }

  @Post(':id/parties')
  @ApiOperation({ summary: 'Add a co-applicant or guarantor to loan case' })
  async addParty(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateLoanPartyDto,
    @CurrentUser() actor: ActorContext,
  ) {
    return this.loanCaseService.addParty(id, dto, actor);
  }

  @Delete(':id/parties/:partyId')
  @ApiOperation({ summary: 'Remove a party from loan case' })
  async removeParty(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('partyId', ParseUUIDPipe) partyId: string,
    @CurrentUser() actor: ActorContext,
  ) {
    return this.loanCaseService.removeParty(id, partyId, actor);
  }

  @Post(':id/submit-for-review')
  @ApiOperation({ summary: 'Submit loan case to back-office underwriting queue' })
  async submitForReview(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: ActorContext,
  ) {
    return this.loanCaseService.submitForReview(id, actor);
  }

  @Post(':id/documents')
  @ApiOperation({ summary: 'Attach a checklist document to loan case' })
  async attachDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { documentId: string; documentType: string },
    @CurrentUser() actor: ActorContext,
  ) {
    return this.loanDocumentService.attachDocument(
      id,
      body.documentId,
      body.documentType,
      actor,
    );
  }

  @Post('documents/:loanDocId/verify')
  @ApiOperation({ summary: 'Verify or reject a loan document' })
  async verifyDocument(
    @Param('loanDocId', ParseUUIDPipe) loanDocId: string,
    @Body() body: { status: 'VERIFIED' | 'REJECTED'; rejectionReason?: string },
    @CurrentUser() actor: ActorContext,
  ) {
    return this.loanDocumentService.verifyDocument(
      loanDocId,
      body.status,
      body.rejectionReason,
      actor,
    );
  }
}
