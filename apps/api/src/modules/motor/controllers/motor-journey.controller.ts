import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../../auth/decorators/current-user.decorator';
import { RoleType } from '@prisma/client';
import { MotorJourneyService } from '../services/motor-journey.service';
import { CreateMotorJourneyDto } from '../dto/create-motor-journey.dto';

@ApiTags('Motor Insurance Journeys')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('motor/journeys')
export class MotorJourneyController {
  constructor(private readonly motorJourneyService: MotorJourneyService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(RoleType.AGENT, RoleType.BACK_OFFICE, RoleType.ADMIN)
  @ApiOperation({
    summary: 'Initialize a new Motor journey (24h TTL, 1:1 quotation binding)',
    description:
      'Creates a stateful journey session bound to the authenticated actor and company tenant.',
  })
  @ApiResponse({ status: 201, description: 'Motor journey initialized successfully.' })
  async createJourney(
    @Body() dto: CreateMotorJourneyDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.motorJourneyService.createJourney(dto, user);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleType.AGENT, RoleType.BACK_OFFICE, RoleType.ADMIN)
  @ApiOperation({
    summary: 'Retrieve motor journey by ID',
    description:
      'Fetches journey state, verifying tenant match and actor access.',
  })
  @ApiResponse({ status: 200, description: 'Motor journey details returned.' })
  async getJourney(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.motorJourneyService.getJourney(id, user);
  }
}
