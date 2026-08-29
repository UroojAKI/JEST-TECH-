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
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { RequestUser } from '../../auth/decorators/current-user.decorator';
import { RoleType, EndorsementType } from '@prisma/client';
import { EndorsementService } from '../services/endorsement.service';
import { PaginationDto } from '../../../common/pagination/pagination.dto';

@ApiTags('Endorsements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('endorsements')
export class EndorsementsController {
  constructor(private readonly endorsementService: EndorsementService) {}

  @Get()
  @Roles(
    RoleType.ADMIN,
    RoleType.SUPER_ADMIN,
    RoleType.UNDERWRITER,
    RoleType.OPERATIONS,
    RoleType.SALES_AGENT,
    RoleType.BRANCH_MANAGER,
    RoleType.TEAM_LEADER,
  )
  getEndorsements(@Query() pagination: PaginationDto) {
    return this.endorsementService.getEndorsements(pagination);
  }

  @Get(':id')
  @Roles(
    RoleType.ADMIN,
    RoleType.SUPER_ADMIN,
    RoleType.UNDERWRITER,
    RoleType.OPERATIONS,
    RoleType.SALES_AGENT,
    RoleType.BRANCH_MANAGER,
    RoleType.TEAM_LEADER,
  )
  getEndorsementDetails(@Param('id', ParseUUIDPipe) id: string) {
    return this.endorsementService.getEndorsementDetails(id);
  }

  @Post()
  @Roles(
    RoleType.ADMIN,
    RoleType.SUPER_ADMIN,
    RoleType.OPERATIONS,
    RoleType.SALES_AGENT,
  )
  createEndorsement(
    @Body('policyId') policyId: string,
    @Body('type') type: EndorsementType,
    @Body('reason') reason: string,
    @Body('requestedChanges') requestedChanges: Record<string, any>,
    @CurrentUser() user: RequestUser,
  ) {
    return this.endorsementService.createEndorsement(
      policyId,
      type,
      reason,
      user.id,
      requestedChanges,
    );
  }

  @Post('policies/:policyId/calculate-prorata')
  @Roles(
    RoleType.ADMIN,
    RoleType.SUPER_ADMIN,
    RoleType.UNDERWRITER,
    RoleType.OPERATIONS,
    RoleType.SALES_AGENT,
    RoleType.BRANCH_MANAGER,
  )
  calculateProRata(
    @Param('policyId', ParseUUIDPipe) policyId: string,
    @Body('newAnnualPremium') newAnnualPremium: number,
  ) {
    return this.endorsementService.calculateProRataPremium(
      policyId,
      newAnnualPremium,
    );
  }

  @Post(':id/attach')
  @Roles(
    RoleType.ADMIN,
    RoleType.SUPER_ADMIN,
    RoleType.OPERATIONS,
    RoleType.SALES_AGENT,
  )
  attachDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('documentId') documentId: string,
  ) {
    return this.endorsementService.attachDocument(id, documentId);
  }

  @Post(':id/approve')
  @Roles(
    RoleType.ADMIN,
    RoleType.SUPER_ADMIN,
    RoleType.UNDERWRITER,
    RoleType.OPERATIONS,
  )
  approveEndorsement(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('comments') comments: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.endorsementService.approveEndorsement(id, comments, user.id);
  }

  @Post(':id/reject')
  @Roles(
    RoleType.ADMIN,
    RoleType.SUPER_ADMIN,
    RoleType.UNDERWRITER,
    RoleType.OPERATIONS,
  )
  rejectEndorsement(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.endorsementService.rejectEndorsement(id, reason, user.id);
  }
}
