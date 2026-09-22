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
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  getEndorsements(
    @Query() pagination: PaginationDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.endorsementService.getEndorsements(pagination, user);
  }

  @Get(':id')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  getEndorsementDetails(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.endorsementService.getEndorsementDetails(id, user);
  }

  @Post()
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
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
      user,
    );
  }

  @Post('policies/:policyId/calculate-prorata')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  calculateProRata(
    @Param('policyId', ParseUUIDPipe) policyId: string,
    @Body('newAnnualPremium') newAnnualPremium: number,
    @CurrentUser() user: RequestUser,
  ) {
    return this.endorsementService.calculateProRataPremium(
      policyId,
      newAnnualPremium,
      user,
    );
  }

  @Post(':id/attach')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  attachDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('documentId') documentId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.endorsementService.attachDocument(id, documentId, user);
  }

  @Post(':id/approve')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  approveEndorsement(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('comments') comments: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.endorsementService.approveEndorsement(
      id,
      comments,
      user.id,
      user,
    );
  }

  @Post(':id/reject')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  rejectEndorsement(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.endorsementService.rejectEndorsement(id, reason, user.id, user);
  }
}
