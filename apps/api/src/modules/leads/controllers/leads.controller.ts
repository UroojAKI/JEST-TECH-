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
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { RoleType } from '@prisma/client';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { RequestUser } from '../../auth/decorators/current-user.decorator';
import { ActorContext } from '../../../common/interfaces/actor-context.interface';

import { CreateLeadDto } from '../dto/create-lead.dto';
import { UpdateLeadDto } from '../dto/update-lead.dto';
import { CreateNoteDto } from '../dto/create-note.dto';
import { CreateActivityDto } from '../dto/create-activity.dto';
import { GetLeadsQueryDto } from '../dto/get-leads-query.dto';
import { LeadsService } from '../services/leads.service';
import { LeadAssignmentService } from '../services/lead-assignment.service';
import { PrismaService } from '../../../database/prisma.service';
import { ParseUUIDPipe } from '../../../common/utils/parse-uuid.pipe';

import { DuplicateDetectionService } from '../deduplication/services/duplicate-detection/duplicate-detection.service';
import { LeadCompletionService } from '../services/lead-completion.service';

@ApiTags('Leads & Opportunity Pipeline')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('leads')
export class LeadsController {
  constructor(
    private readonly leadsService: LeadsService,
    private readonly leadAssignmentService: LeadAssignmentService,
    private readonly prisma: PrismaService,
    private readonly duplicateDetectionService: DuplicateDetectionService,
    private readonly leadCompletionService: LeadCompletionService,
  ) {}

  @Get('kpis')
  @ApiOperation({ summary: 'Get Lead Management Pipeline Telemetry & Conversion Metrics' })
  async getLeadKpis(@CurrentUser() user: RequestUser) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const role = String(user.role || '').toUpperCase();
    const where: any = {};
    if (role === 'BRANCH_MANAGER' && user.branchId) {
      where.assignedTo = { branchId: user.branchId };
    } else if (role === 'TEAM_LEADER' && user.teamId) {
      where.assignedTo = { teamId: user.teamId };
    } else if (!['SUPER_ADMIN', 'ADMIN', 'SYSTEM_ADMINISTRATOR', 'MD_CEO'].includes(role)) {
      where.assignedToId = user.id;
    }

    const [totalLeads, todaysLeads, hotLeads, wonLeads, lostLeads, pendingLeads, todaysFollowups] = await Promise.all([
      this.prisma.lead.count({ where }),
      this.prisma.lead.count({ where: { ...where, createdAt: { gte: today, lt: tomorrow } } }),
      this.prisma.lead.count({ where: { ...where, priority: 'HIGH', status: { notIn: ['CONVERTED', 'LOST', 'UNQUALIFIED'] } } }),
      this.prisma.lead.count({ where: { ...where, status: 'CONVERTED' } }),
      this.prisma.lead.count({ where: { ...where, status: { in: ['LOST', 'UNQUALIFIED'] } } }),
      this.prisma.lead.count({ where: { ...where, status: { in: ['NEW', 'CONTACTED', 'QUALIFIED', 'DOCS_RECEIVED', 'QUOTE_PREPARED', 'NEGOTIATION'] } } }),
      this.prisma.lead.count({ where: { ...where, nextFollowup: { gte: today, lt: tomorrow } } }),
    ]);

    const conversionRate = totalLeads > 0 ? ((wonLeads / totalLeads) * 100).toFixed(1) : '0.0';
    return { totalLeads, todaysLeads, hotLeads, won: wonLeads, lost: lostLeads, pending: pendingLeads, todaysFollowups, conversionRatePercentage: `${conversionRate}%` };
  }

  @Get('check-duplicate')
  @ApiOperation({ summary: 'Check mobile, email, PAN, and vehicle registration duplicate matches' })
  async checkDuplicate(@Query('phone') phone?: string, @Query('email') email?: string, @Query('panNumber') panNumber?: string, @Query('registrationNumber') registrationNumber?: string) {
    return this.duplicateDetectionService.checkDuplicates({ phone, email, panNumber, registrationNumber });
  }

  @Post('check-duplicate')
  @ApiOperation({ summary: 'Check duplicate customer/lead/vehicle matches via POST payload' })
  async checkDuplicatePost(@Body() body: { phone?: string; email?: string; panNumber?: string; registrationNumber?: string }) {
    return this.duplicateDetectionService.checkDuplicates(body);
  }

  @Post()
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.BRANCH_MANAGER, RoleType.TEAM_LEADER, RoleType.SALES_AGENT)
  create(@Body() dto: CreateLeadDto, @CurrentUser() user: RequestUser) {
    return this.leadsService.create(dto, user.id);
  }

  @Post(':id/merge')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.BRANCH_MANAGER, RoleType.TEAM_LEADER, RoleType.SALES_AGENT)
  merge(@Param('id') targetId: string, @Body('sourceLeadId') sourceLeadId: string, @CurrentUser() user: RequestUser) {
    return this.leadsService.mergeLeads(targetId, sourceLeadId, user.id);
  }

  @Get()
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.BRANCH_MANAGER, RoleType.TEAM_LEADER, RoleType.SALES_AGENT, RoleType.OPERATIONS)
  findAll(@Query() pagination: GetLeadsQueryDto, @CurrentUser() user: RequestUser) {
    return this.leadsService.findAll(user, pagination);
  }

  @Get(':id')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.BRANCH_MANAGER, RoleType.TEAM_LEADER, RoleType.SALES_AGENT, RoleType.OPERATIONS)
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.leadsService.findById(id, user);
  }

  @Get(':id/context')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.BRANCH_MANAGER, RoleType.TEAM_LEADER, RoleType.SALES_AGENT, RoleType.OPERATIONS)
  @ApiOperation({ summary: 'Get prefill context for Motor / Quotation wizard from Lead' })
  getLeadContext(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: ActorContext) {
    return this.leadsService.getLeadContext(id, actor);
  }

  @Get(':id/completion')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.BRANCH_MANAGER, RoleType.TEAM_LEADER, RoleType.SALES_AGENT, RoleType.OPERATIONS)
  @ApiOperation({ summary: 'Get 5-stage lead completion score and quotation gate readiness' })
  getLeadCompletion(@Param('id', ParseUUIDPipe) id: string) {
    return this.leadCompletionService.computeCompletionStatus(id);
  }

  @Patch(':id')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.BRANCH_MANAGER, RoleType.TEAM_LEADER, RoleType.SALES_AGENT)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLeadDto, @CurrentUser() user: RequestUser) {
    return this.leadsService.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.leadsService.remove(id, user.id);
  }

  @Post(':id/assign')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.BRANCH_MANAGER, RoleType.TEAM_LEADER, RoleType.SALES_MANAGER)
  @ApiOperation({ summary: 'Assign or reassign lead to a sales agent with branch/team boundary validation' })
  assign(@Param('id', ParseUUIDPipe) id: string, @Body('assignedToId') assignedToId: string, @CurrentUser() actor: ActorContext) {
    return this.leadAssignmentService.assignLead(id, assignedToId, actor);
  }

  @Post(':id/auto-assign')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.BRANCH_MANAGER, RoleType.TEAM_LEADER, RoleType.SALES_MANAGER)
  @ApiOperation({ summary: 'Auto-assign lead to agent with lowest active load (Round-Robin)' })
  autoAssign(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: ActorContext) {
    return this.leadAssignmentService.autoAssignRoundRobin(id, actor);
  }

  @Post('bulk-assign')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.BRANCH_MANAGER, RoleType.TEAM_LEADER, RoleType.SALES_MANAGER)
  @ApiOperation({ summary: 'Bulk reassign leads to a target agent within branch/team scope' })
  bulkAssign(@Body() body: { leadIds: string[]; targetAgentId: string }, @CurrentUser() actor: ActorContext) {
    return this.leadAssignmentService.bulkAssign(body.leadIds, body.targetAgentId, actor);
  }

  @Get('queues/workload')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.BRANCH_MANAGER, RoleType.TEAM_LEADER, RoleType.SALES_MANAGER)
  @ApiOperation({ summary: 'Get active workload telemetry for agents within authorized scope' })
  getWorkload(@CurrentUser() actor: ActorContext) {
    return this.leadAssignmentService.getAgentWorkloadQueue(actor);
  }

  @Post(':id/notes')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.BRANCH_MANAGER, RoleType.TEAM_LEADER, RoleType.SALES_AGENT)
  addNote(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateNoteDto, @CurrentUser() user: RequestUser) {
    return this.leadsService.addNote(id, dto, user.id);
  }

  @Post(':id/activities')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.BRANCH_MANAGER, RoleType.TEAM_LEADER, RoleType.SALES_AGENT)
  createActivity(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateActivityDto, @CurrentUser() user: RequestUser) {
    return this.leadsService.createActivity(id, dto, user.id);
  }

  @Post(':id/convert')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.BRANCH_MANAGER, RoleType.TEAM_LEADER, RoleType.SALES_AGENT)
  async convert(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    const completion = await this.leadCompletionService.computeCompletionStatus(id);
    if (!completion.isQualifiedForQuotation) {
      throw new BadRequestException({
        code: 'LEAD_NOT_READY',
        message: 'Lead cannot be converted until all quotation readiness gates are satisfied.',
        blockingReasons: completion.blockingReasons,
        missingFields: completion.stages.filter((stage) => !stage.isComplete).flatMap((stage) => stage.missingFields),
      });
    }
    return this.leadsService.convert(id, user.id);
  }
}
