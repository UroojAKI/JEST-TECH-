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

const LEAD_VIEW_ROLES: RoleType[] = [
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
  RoleType.UNDERWRITER,
  RoleType.RENEWAL_EXECUTIVE,
  RoleType.CUSTOMER_SERVICE_EXECUTIVE,
];

const LEAD_MANAGE_ROLES: RoleType[] = [
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
  RoleType.CUSTOMER_SERVICE_EXECUTIVE,
];

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
  @Roles(...LEAD_MANAGE_ROLES)
  create(@Body() dto: CreateLeadDto, @CurrentUser() user: RequestUser) {
    return this.leadsService.create(dto, user.id);
  }

  @Post(':id/merge')
  @Roles(...LEAD_MANAGE_ROLES)
  merge(@Param('id') targetId: string, @Body('sourceLeadId') sourceLeadId: string, @CurrentUser() user: RequestUser) {
    return this.leadsService.mergeLeads(targetId, sourceLeadId, user.id);
  }

  @Get()
  @Roles(...LEAD_VIEW_ROLES)
  findAll(@Query() pagination: GetLeadsQueryDto, @CurrentUser() user: RequestUser) {
    return this.leadsService.findAll(user, pagination);
  }

  @Get(':id')
  @Roles(...LEAD_VIEW_ROLES)
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.leadsService.findById(id, user);
  }

  @Get(':id/context')
  @Roles(...LEAD_VIEW_ROLES)
  @ApiOperation({ summary: 'Get prefill context for Motor / Quotation wizard from Lead' })
  getLeadContext(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: ActorContext) {
    return this.leadsService.getLeadContext(id, actor);
  }

  @Get(':id/completion')
  @Roles(...LEAD_VIEW_ROLES)
  @ApiOperation({ summary: 'Get 5-stage lead completion score and quotation gate readiness' })
  getLeadCompletion(@Param('id', ParseUUIDPipe) id: string) {
    return this.leadCompletionService.computeCompletionStatus(id);
  }

  @Patch(':id')
  @Roles(...LEAD_MANAGE_ROLES)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLeadDto, @CurrentUser() user: RequestUser) {
    return this.leadsService.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.SYSTEM_ADMINISTRATOR, RoleType.MD_CEO)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.leadsService.remove(id, user.id);
  }

  @Post(':id/assign')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.BRANCH_MANAGER, RoleType.TEAM_LEADER, RoleType.SALES_MANAGER, RoleType.MD_CEO, RoleType.SYSTEM_ADMINISTRATOR)
  @ApiOperation({ summary: 'Assign or reassign lead to a sales agent with branch/team boundary validation' })
  assign(@Param('id', ParseUUIDPipe) id: string, @Body('assignedToId') assignedToId: string, @CurrentUser() actor: ActorContext) {
    return this.leadAssignmentService.assignLead(id, assignedToId, actor);
  }

  @Post(':id/auto-assign')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.BRANCH_MANAGER, RoleType.TEAM_LEADER, RoleType.SALES_MANAGER, RoleType.MD_CEO, RoleType.SYSTEM_ADMINISTRATOR)
  @ApiOperation({ summary: 'Auto-assign lead to agent with lowest active load (Round-Robin)' })
  autoAssign(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: ActorContext) {
    return this.leadAssignmentService.autoAssignRoundRobin(id, actor);
  }

  @Post('bulk-assign')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.BRANCH_MANAGER, RoleType.TEAM_LEADER, RoleType.SALES_MANAGER, RoleType.MD_CEO, RoleType.SYSTEM_ADMINISTRATOR)
  @ApiOperation({ summary: 'Bulk reassign leads to a target agent within branch/team scope' })
  bulkAssign(@Body() body: { leadIds: string[]; targetAgentId: string }, @CurrentUser() actor: ActorContext) {
    return this.leadAssignmentService.bulkAssign(body.leadIds, body.targetAgentId, actor);
  }

  @Get('queues/workload')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.BRANCH_MANAGER, RoleType.TEAM_LEADER, RoleType.SALES_MANAGER, RoleType.MD_CEO, RoleType.SYSTEM_ADMINISTRATOR)
  @ApiOperation({ summary: 'Get active workload telemetry for agents within authorized scope' })
  getWorkload(@CurrentUser() actor: ActorContext) {
    return this.leadAssignmentService.getAgentWorkloadQueue(actor);
  }

  @Post(':id/notes')
  @Roles(...LEAD_MANAGE_ROLES)
  addNote(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateNoteDto, @CurrentUser() user: RequestUser) {
    return this.leadsService.addNote(id, dto, user.id);
  }

  @Post(':id/activities')
  @Roles(...LEAD_MANAGE_ROLES)
  createActivity(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateActivityDto, @CurrentUser() user: RequestUser) {
    return this.leadsService.createActivity(id, dto, user.id);
  }

  @Post(':id/convert')
  @Roles(...LEAD_MANAGE_ROLES)
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
