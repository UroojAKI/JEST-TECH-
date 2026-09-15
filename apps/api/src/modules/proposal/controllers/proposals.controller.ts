import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/pagination/pagination.dto';
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
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  getProposals(
    @CurrentUser() user: RequestUser,
    @Query() pagination: PaginationDto,
  ) {
    // AGENT only sees their own proposals; ADMIN/BACK_OFFICE see all
    const filterUserId =
      user.role === RoleType.AGENT ? user.id : undefined;
    return this.proposalService.getProposals(filterUserId, pagination);
  }

  @Get(':id')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  getProposalDetails(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.proposalService.getProposalDetails(id, user);
  }

  @Post()
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  createProposal(
    @Body('quotationId') quotationId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.proposalService.createProposal(quotationId, user.id);
  }

  @Post(':id/attach')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  attachDocument(
    @Param('id') id: string,
    @Body('checklistItemId') checklistItemId: string,
    @Body('documentId') documentId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.proposalService.attachDocument(
      id,
      checklistItemId,
      documentId,
      user.id,
    );
  }

  @Post(':id/submit')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  submitProposal(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.proposalService.submitProposal(id, user.id);
  }

  @Post(':id/review')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  reviewProposal(
    @Param('id') id: string,
    @Body('approve') approve: boolean,
    @Body('remarks') remarks: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.proposalService.reviewProposal(id, approve, remarks, user.id);
  }
}
