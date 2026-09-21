import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RoleType } from '@prisma/client';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ActorContext } from '../../../common/interfaces/actor-context.interface';
import {
  MotorInspectionService,
  CreateInspectionDto,
  InspectionPhotoType,
} from '../services/motor-inspection.service';

@ApiTags('Motor Inspection')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('motor/inspections')
export class MotorInspectionController {
  constructor(private readonly inspectionService: MotorInspectionService) {}

  @Post()
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  @ApiOperation({
    summary: 'Create or initialize a vehicle inspection record for quotation',
  })
  async createInspection(
    @Body() dto: CreateInspectionDto,
    @CurrentUser() actor: ActorContext,
  ) {
    return this.inspectionService.createInspection(
      {
        ...dto,
        createdById: actor.userId,
      },
      actor,
    );
  }

  @Get(':quotationId')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  @ApiOperation({ summary: 'Get inspection details for a quotation' })
  async getInspection(
    @Param('quotationId') quotationId: string,
    @CurrentUser() actor: ActorContext,
  ) {
    return this.inspectionService.getInspection(quotationId, actor);
  }

  @Post(':id/photos')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  @ApiOperation({
    summary: 'Record uploaded photo key for a specific vehicle view',
  })
  async recordPhoto(
    @Param('id') inspectionId: string,
    @Body() body: { photoType: InspectionPhotoType; storageKey: string },
    @CurrentUser() actor: ActorContext,
  ) {
    if (!body.photoType || !body.storageKey) {
      throw new BadRequestException('photoType and storageKey are required');
    }
    return this.inspectionService.recordPhoto(
      inspectionId,
      body.photoType,
      body.storageKey,
      actor,
    );
  }

  @Post(':id/submit-for-review')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  @ApiOperation({
    summary:
      'Submit inspection for underwriting review once all 7 mandatory photographs are uploaded',
  })
  async submitForReview(
    @Param('id') inspectionId: string,
    @CurrentUser() actor: ActorContext,
  ) {
    return this.inspectionService.submitForReview(inspectionId, actor);
  }

  @Post(':id/approve')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({
    summary: 'Approve vehicle inspection (Back-Office / Underwriter only)',
  })
  async approveInspection(
    @Param('id') inspectionId: string,
    @Body() body: { reportPdfKey?: string; reportPdfUrl?: string },
    @CurrentUser() actor: ActorContext,
  ) {
    return this.inspectionService.approveInspection(
      inspectionId,
      actor,
      body?.reportPdfKey,
      body?.reportPdfUrl,
    );
  }

  @Post(':id/reject')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({
    summary:
      'Reject vehicle inspection with reason (Back-Office / Underwriter only)',
  })
  async rejectInspection(
    @Param('id') inspectionId: string,
    @Body() body: { reason: string },
    @CurrentUser() actor: ActorContext,
  ) {
    if (!body.reason) {
      throw new BadRequestException('Rejection reason is required');
    }
    return this.inspectionService.rejectInspection(
      inspectionId,
      body.reason,
      actor,
    );
  }

  @Post(':id/waive')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({
    summary:
      'Waive vehicle inspection with reason (Underwriting override by Back-Office / Admin)',
  })
  async waiveInspection(
    @Param('id') inspectionId: string,
    @Body() body: { reason: string },
    @CurrentUser() actor: ActorContext,
  ) {
    if (!body.reason) {
      throw new BadRequestException('Waiver reason is required');
    }
    return this.inspectionService.waiveInspection(
      inspectionId,
      body.reason,
      actor,
    );
  }
}
