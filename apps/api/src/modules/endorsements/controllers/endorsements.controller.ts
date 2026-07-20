import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { RequestUser } from '../../auth/decorators/current-user.decorator';
import { RoleType, EndorsementType } from '@prisma/client';
import { EndorsementService } from '../services/endorsement.service';

@ApiTags('Endorsements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('endorsements')
export class EndorsementsController {
  constructor(private readonly endorsementService: EndorsementService) {}

  @Get()
  @Roles(RoleType.ADMIN, RoleType.SUPER_ADMIN, RoleType.UNDERWRITER, RoleType.OPERATIONS, RoleType.SALES_AGENT, RoleType.BRANCH_MANAGER, RoleType.TEAM_LEADER)
  getEndorsements() {
    return this.endorsementService.getEndorsements();
  }

  @Get(':id')
  @Roles(RoleType.ADMIN, RoleType.SUPER_ADMIN, RoleType.UNDERWRITER, RoleType.OPERATIONS, RoleType.SALES_AGENT, RoleType.BRANCH_MANAGER, RoleType.TEAM_LEADER)
  getEndorsementDetails(@Param('id') id: string) {
    return this.endorsementService.getEndorsementDetails(id);
  }

  @Post()
  @Roles(RoleType.ADMIN, RoleType.SUPER_ADMIN, RoleType.OPERATIONS, RoleType.SALES_AGENT)
  createEndorsement(
    @Body('policyId') policyId: string,
    @Body('type') type: EndorsementType,
    @Body('reason') reason: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.endorsementService.createEndorsement(policyId, type, reason, user.id);
  }

  @Post(':id/attach')
  @Roles(RoleType.ADMIN, RoleType.SUPER_ADMIN, RoleType.OPERATIONS, RoleType.SALES_AGENT)
  attachDocument(@Param('id') id: string, @Body('documentId') documentId: string) {
    return this.endorsementService.attachDocument(id, documentId);
  }

  @Post(':id/approve')
  @Roles(RoleType.ADMIN, RoleType.SUPER_ADMIN, RoleType.UNDERWRITER)
  approveEndorsement(
    @Param('id') id: string,
    @Body('comments') comments: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.endorsementService.approveEndorsement(id, comments, user.id);
  }
}
