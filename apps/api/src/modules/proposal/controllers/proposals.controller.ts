import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { RequestUser } from '../../auth/decorators/current-user.decorator';
import { RoleType } from '@prisma/client';
import { ProposalService } from '../services/proposal.service';

@ApiTags('Proposals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('proposals')
export class ProposalsController {
  constructor(private readonly proposalService: ProposalService) {}

  @Get()
  getProposals(@CurrentUser() user: RequestUser) {
    const filterUserId = user.role === RoleType.SALES_AGENT ? user.id : undefined;
    return this.proposalService.getProposals(filterUserId);
  }

  @Get(':id')
  getProposalDetails(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.proposalService.getProposalDetails(id, user);
  }

  @Post()
  createProposal(@Body('quotationId') quotationId: string, @CurrentUser() user: RequestUser) {
    return this.proposalService.createProposal(quotationId, user.id);
  }

  @Post(':id/attach')
  attachDocument(
    @Param('id') id: string,
    @Body('checklistItemId') checklistItemId: string,
    @Body('documentId') documentId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.proposalService.attachDocument(id, checklistItemId, documentId, user.id);
  }

  @Post(':id/submit')
  submitProposal(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.proposalService.submitProposal(id, user.id);
  }

  @Post(':id/review')
  @Roles(RoleType.ADMIN, RoleType.SUPER_ADMIN)
  reviewProposal(
    @Param('id') id: string,
    @Body('approve') approve: boolean,
    @Body('remarks') remarks: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.proposalService.reviewProposal(id, approve, remarks, user.id);
  }
}
