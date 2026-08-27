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
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ActorContext } from '../../../common/interfaces/actor-context.interface';
import {
  MotorInspectionService,
  CreateInspectionDto,
  InspectionPhotoType,
} from '../services/motor-inspection.service';

@ApiTags('Motor Inspection')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('motor/inspections')
export class MotorInspectionController {
  constructor(private readonly inspectionService: MotorInspectionService) {}

  @Post()
  @ApiOperation({ summary: 'Create or initialize a vehicle inspection record for quotation' })
  async createInspection(
    @Body() dto: CreateInspectionDto,
    @CurrentUser() actor: ActorContext,
  ) {
    return this.inspectionService.createInspection({
      ...dto,
      createdById: actor.userId,
    });
  }

  @Get(':quotationId')
  @ApiOperation({ summary: 'Get inspection details for a quotation' })
  async getInspection(@Param('quotationId') quotationId: string) {
    return this.inspectionService.getInspection(quotationId);
  }

  @Post(':id/photos')
  @ApiOperation({ summary: 'Record uploaded photo key for a specific vehicle view' })
  async recordPhoto(
    @Param('id') inspectionId: string,
    @Body() body: { photoType: InspectionPhotoType; storageKey: string },
  ) {
    if (!body.photoType || !body.storageKey) {
      throw new BadRequestException('photoType and storageKey are required');
    }
    return this.inspectionService.recordPhoto(
      inspectionId,
      body.photoType,
      body.storageKey,
    );
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Submit inspection once all 7 mandatory photographs are uploaded' })
  async completeInspection(
    @Param('id') inspectionId: string,
    @Body() body: { reportPdfKey?: string; reportPdfUrl?: string },
  ) {
    return this.inspectionService.completeInspection(
      inspectionId,
      body.reportPdfKey,
      body.reportPdfUrl,
    );
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve vehicle inspection (Back-Office / Underwriter)' })
  async approveInspection(
    @Param('id') inspectionId: string,
    @CurrentUser() actor: ActorContext,
  ) {
    return this.inspectionService.completeInspection(inspectionId);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject vehicle inspection with reason' })
  async rejectInspection(
    @Param('id') inspectionId: string,
    @Body() body: { reason: string },
  ) {
    if (!body.reason) {
      throw new BadRequestException('Rejection reason is required');
    }
    return this.inspectionService.rejectInspection(inspectionId, body.reason);
  }
}
