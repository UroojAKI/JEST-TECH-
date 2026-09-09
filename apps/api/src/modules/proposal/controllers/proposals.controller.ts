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

const PROPOSAL_VIEW_ROLES: RoleType[] = [
  RoleType.SUPER_ADMIN,
  RoleType.ADMIN,
  RoleType.SYSTEM_ADMINISTRATOR,
  RoleType.MD_CEO,
  RoleType.BRANCH_MANAGER,
  RoleType.MARKETING_DIRECTOR,
  RoleType.TEAM_LEADER,
  RoleType.SALES_MANAGER,
  RoleType.SALES_AGENT,
  RoleType.SALES_EXECUTIVE,
  RoleType.POSP_ADVISOR,
  RoleType.AGENT_MANAGER,
  RoleType.OPERATIONS,
  RoleType.POLICY_ISSUANCE_EXECUTIVE,
  RoleType.UNDERWRITER,
  RoleType.RENEWAL_EXECUTIVE,
  RoleType.CUSTOMER_SERVICE_EXECUTIVE,
  RoleType.SUPPORT,
];

const PROPOSAL_MANAGE_ROLES: RoleType[] = [
  RoleType.SUPER_ADMIN,
  RoleType.ADMIN,
  RoleType.SYSTEM_ADMINISTRATOR,
  RoleType.MD_CEO,
  RoleType.BRANCH_MANAGER,
  RoleType.MARKETING_DIRECTOR,
  RoleType.TEAM_LEADER,
  RoleType.SALES_MANAGER,
  RoleType.SALES_AGENT,
  RoleType.SALES_EXECUTIVE,
  RoleType.POSP_ADVISOR,
  RoleType.AGENT_MANAGER,
  RoleType.OPERATIONS,
  RoleType.POLICY_ISSUANCE_EXECUTIVE,
  RoleType.UNDERWRITER,
  RoleType.RENEWAL_EXECUTIVE,
  RoleType.CUSTOMER_SERVICE_EXECUTIVE,
  RoleType.SUPPORT,
];

@ApiTags('Proposals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('proposals')
export class ProposalsController {
  constructor(private readonly proposalService: ProposalService) {}

  @Get()
  @Roles(...PROPOSAL_VIEW_ROLES)
  getProposals(
    @CurrentUser() user: RequestUser,
    @Query() pagination: PaginationDto,
  ) {
    const filterUserId =
      user.role === RoleType.SALES_AGENT ? user.id : undefined;
    return this.proposalService.getProposals(filterUserId, pagination);
  }

  @Get(':id')
  @Roles(...PROPOSAL_VIEW_ROLES)
  getProposalDetails(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.proposalService.getProposalDetails(id, user);
  }

  @Post()
  @Roles(...PROPOSAL_MANAGE_ROLES)
  createProposal(
    @Body('quotationId') quotationId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.proposalService.createProposal(quotationId, user.id);
  }

  @Post(':id/attach')
  @Roles(...PROPOSAL_MANAGE_ROLES)
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
  @Roles(...PROPOSAL_MANAGE_ROLES)
  submitProposal(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.proposalService.submitProposal(id, user.id);
  }

  @Post(':id/review')
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.SYSTEM_ADMINISTRATOR,
    RoleType.MD_CEO,
    RoleType.UNDERWRITER,
    RoleType.BRANCH_MANAGER,
  )
  reviewProposal(
    @Param('id') id: string,
    @Body('approve') approve: boolean,
    @Body('remarks') remarks: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.proposalService.reviewProposal(id, approve, remarks, user.id);
  }
}
