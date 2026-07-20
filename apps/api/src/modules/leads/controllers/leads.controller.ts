import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoleType } from '@prisma/client';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { RequestUser } from '../../auth/decorators/current-user.decorator';

import { CreateLeadDto } from '../dto/create-lead.dto';
import { UpdateLeadDto } from '../dto/update-lead.dto';
import { CreateNoteDto } from '../dto/create-note.dto';
import { CreateActivityDto } from '../dto/create-activity.dto';
import { LeadsService } from '../services/leads.service';

@ApiTags('Leads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Post()
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.BRANCH_MANAGER,
    RoleType.TEAM_LEADER,
    RoleType.SALES_AGENT,
  )
  create(@Body() dto: CreateLeadDto, @CurrentUser() user: RequestUser) {
    return this.leadsService.create(dto, user.id);
  }

  @Get()
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.BRANCH_MANAGER,
    RoleType.TEAM_LEADER,
    RoleType.SALES_AGENT,
    RoleType.OPERATIONS,
  )
  findAll(@CurrentUser() user: RequestUser) {
    return this.leadsService.findAll(user);
  }

  @Get(':id')
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.BRANCH_MANAGER,
    RoleType.TEAM_LEADER,
    RoleType.SALES_AGENT,
    RoleType.OPERATIONS,
  )
  findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.leadsService.findById(id, user);
  }

  @Patch(':id')
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.BRANCH_MANAGER,
    RoleType.TEAM_LEADER,
    RoleType.SALES_AGENT,
  )
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLeadDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.leadsService.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.leadsService.remove(id, user.id);
  }

  @Post(':id/assign')
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.BRANCH_MANAGER,
    RoleType.TEAM_LEADER,
  )
  assign(
    @Param('id') id: string,
    @Body('assignedToId') assignedToId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.leadsService.assign(id, assignedToId, user.id);
  }

  @Post(':id/notes')
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.BRANCH_MANAGER,
    RoleType.TEAM_LEADER,
    RoleType.SALES_AGENT,
  )
  addNote(
    @Param('id') id: string,
    @Body() dto: CreateNoteDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.leadsService.addNote(id, dto, user.id);
  }

  @Post(':id/activities')
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.BRANCH_MANAGER,
    RoleType.TEAM_LEADER,
    RoleType.SALES_AGENT,
  )
  createActivity(
    @Param('id') id: string,
    @Body() dto: CreateActivityDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.leadsService.createActivity(id, dto, user.id);
  }

  @Post(':id/convert')
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.BRANCH_MANAGER,
    RoleType.TEAM_LEADER,
    RoleType.SALES_AGENT,
  )
  convert(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.leadsService.convert(id, user.id);
  }
}
