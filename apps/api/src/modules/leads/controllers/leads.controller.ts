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
import { RoleType, LeadStatus } from '@prisma/client';

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
import { LeadLifecycleService } from '../services/lead-lifecycle.service';

const LEAD_VIEW_ROLES: RoleType[] = [
  RoleType.ADMIN,
  RoleType.BACK_OFFICE,
  RoleType.AGENT,
];

const LEAD_MANAGE_ROLES: RoleType[] = [
  RoleType.ADMIN,
  RoleType.BACK_OFFICE,
  RoleType.AGENT,
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
    private readonly leadLifecycleService: LeadLifecycleService,
  ) {}

  @Get('kpis')
  @Roles(...LEAD_VIEW_ROLES)
  @ApiOperation({
    summary: 'Get Lead Management Pipeline Telemetry & Conversion Metrics',
  })
  async getLeadKpis(@CurrentUser() user: RequestUser) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const role = String(user.role || '').toUpperCase();
    const where: any = {};
    const companyId = user.companyId || (user as any).organizationId;
    if (companyId && !user.permissions?.includes('*')) {
      where.companyId = companyId;
    }
    if (role === 'AGENT') {
      where.assignedToId = user.id;
    }

    const [
      totalLeads,
      todaysLeads,
      hotLeads,
      wonLeads,
      lostLeads,
      pendingLeads,
      todaysFollowups,
    ] = await Promise.all([
      this.prisma.lead.count({ where }),
      this.prisma.lead.count({
        where: { ...where, createdAt: { gte: today, lt: tomorrow } },
      }),
      this.prisma.lead.count({
        where: {
          ...where,
          priority: 'HIGH',
          status: { notIn: ['CONVERTED', 'LOST', 'UNQUALIFIED'] },
        },
      }),
      this.prisma.lead.count({ where: { ...where, status: 'CONVERTED' } }),
      this.prisma.lead.count({
        where: { ...where, status: { in: ['LOST', 'UNQUALIFIED'] } },
      }),
      this.prisma.lead.count({
        where: {
          ...where,
          status: {
            in: [
              'NEW',
              'CONTACTED',
              'QUALIFIED',
              'DOCS_RECEIVED',
              'QUOTE_PREPARED',
              'NEGOTIATION',
            ],
          },
        },
      }),
      this.prisma.lead.count({
        where: { ...where, nextFollowup: { gte: today, lt: tomorrow } },
      }),
    ]);

    const conversionRate =
      totalLeads > 0 ? ((wonLeads / totalLeads) * 100).toFixed(1) : '0.0';
    return {
      totalLeads,
      todaysLeads,
      hotLeads,
      won: wonLeads,
      lost: lostLeads,
      pending: pendingLeads,
      todaysFollowups,
      conversionRatePercentage: `${conversionRate}%`,
    };
  }

  @Get('check-duplicate')
  @Roles(...LEAD_VIEW_ROLES)
  @ApiOperation({
    summary:
      'Check mobile, email, PAN, and vehicle registration duplicate matches',
  })
  async checkDuplicate(
    @Query('phone') phone?: string,
    @Query('email') email?: string,
    @Query('panNumber') panNumber?: string,
    @Query('registrationNumber') registrationNumber?: string,
  ) {
    return this.duplicateDetectionService.checkDuplicates({
      phone,
      email,
      panNumber,
      registrationNumber,
    });
  }

  @Post('check-duplicate')
  @Roles(...LEAD_VIEW_ROLES)
  @ApiOperation({
    summary: 'Check duplicate customer/lead/vehicle matches via POST payload',
  })
  async checkDuplicatePost(
    @Body()
    body: {
      phone?: string;
      email?: string;
      panNumber?: string;
      registrationNumber?: string;
    },
  ) {
    return this.duplicateDetectionService.checkDuplicates(body);
  }

  @Post()
  @Roles(...LEAD_MANAGE_ROLES)
  create(@Body() dto: CreateLeadDto, @CurrentUser() user: RequestUser) {
    return this.leadsService.create(dto, user);
  }

  @Post(':id/merge')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  merge(
    @Param('id') targetId: string,
    @Body('sourceLeadId') sourceLeadId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.leadsService.mergeLeads(targetId, sourceLeadId, user.id);
  }

  @Get()
  @Roles(...LEAD_VIEW_ROLES)
  findAll(
    @Query() pagination: GetLeadsQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.leadsService.findAll(user, pagination);
  }

  @Get(':id')
  @Roles(...LEAD_VIEW_ROLES)
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.leadsService.findById(id, user);
  }

  @Get(':id/context')
  @Roles(...LEAD_VIEW_ROLES)
  @ApiOperation({
    summary: 'Get prefill context for Motor / Quotation wizard from Lead',
  })
  getLeadContext(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: ActorContext,
  ) {
    return this.leadsService.getLeadContext(id, actor);
  }

  @Get(':id/completion')
  @Roles(...LEAD_VIEW_ROLES)
  @ApiOperation({
    summary: 'Get 5-stage lead completion score and quotation gate readiness',
  })
  getLeadCompletion(@Param('id', ParseUUIDPipe) id: string) {
    return this.leadCompletionService.computeCompletionStatus(id);
  }

  @Patch(':id')
  @Roles(...LEAD_MANAGE_ROLES)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeadDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.leadsService.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleType.ADMIN)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.leadsService.remove(id, user.id);
  }

  @Post(':id/assign')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({
    summary:
      'Assign or reassign lead to a sales agent with branch/team boundary validation',
  })
  assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('assignedToId') assignedToId: string,
    @CurrentUser() actor: ActorContext,
  ) {
    return this.leadAssignmentService.assignLead(id, assignedToId, actor);
  }

  @Post(':id/auto-assign')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({
    summary: 'Auto-assign lead to agent with lowest active load (Round-Robin)',
  })
  autoAssign(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: ActorContext,
  ) {
    return this.leadAssignmentService.autoAssignRoundRobin(id, actor);
  }

  @Post('bulk-assign')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({
    summary: 'Bulk reassign leads to a target agent within branch/team scope',
  })
  bulkAssign(
    @Body() body: { leadIds: string[]; targetAgentId: string },
    @CurrentUser() actor: ActorContext,
  ) {
    return this.leadAssignmentService.bulkAssign(
      body.leadIds,
      body.targetAgentId,
      actor,
    );
  }

  @Get('queues/workload')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({
    summary: 'Get active workload telemetry for agents within authorized scope',
  })
  getWorkload(@CurrentUser() actor: ActorContext) {
    return this.leadAssignmentService.getAgentWorkloadQueue(actor);
  }

  @Post(':id/notes')
  @Roles(...LEAD_MANAGE_ROLES)
  addNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateNoteDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.leadsService.addNote(id, dto, user);
  }

  @Post(':id/activities')
  @Roles(...LEAD_MANAGE_ROLES)
  createActivity(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateActivityDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.leadsService.createActivity(id, dto, user);
  }

  @Post(':id/convert')
  @Roles(...LEAD_MANAGE_ROLES)
  async convert(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    const completion =
      await this.leadCompletionService.computeCompletionStatus(id);
    if (!completion.isQualifiedForQuotation) {
      throw new BadRequestException({
        code: 'LEAD_NOT_READY',
        message:
          'Lead cannot be converted until all quotation readiness gates are satisfied.',
        blockingReasons: completion.blockingReasons,
        missingFields: completion.stages
          .filter((stage) => !stage.isComplete)
          .flatMap((stage) => stage.missingFields),
      });
    }
    return this.leadsService.convert(id, user);
  }

  @Post(':id/mark-lost')
  @Roles(...LEAD_MANAGE_ROLES)
  async markLost(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { lossReason: string },
    @CurrentUser() user: RequestUser,
  ) {
    if (
      !body.lossReason ||
      typeof body.lossReason !== 'string' ||
      body.lossReason.trim() === ''
    ) {
      throw new BadRequestException(
        'lossReason is required and must be a non-empty string',
      );
    }
    return this.leadsService.markLost(id, body.lossReason.trim(), user);
  }

  @Get(':id/allowed-transitions')
  @Roles(...LEAD_VIEW_ROLES)
  @ApiOperation({
    summary: 'Get allowed lifecycle state transitions for a lead',
  })
  async getAllowedTransitions(@Param('id', ParseUUIDPipe) id: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      select: { id: true, leadCode: true, status: true },
    });
    if (!lead) {
      throw new BadRequestException(`Lead with ID ${id} not found`);
    }
    const allowed = this.leadLifecycleService.getAllowedTransitions(
      lead.status,
    );
    return {
      leadId: lead.id,
      leadCode: lead.leadCode,
      currentStatus: lead.status,
      allowedTransitions: allowed,
    };
  }

  @Post(':id/transition')
  @Roles(...LEAD_MANAGE_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Execute state machine lifecycle transition for a lead',
  })
  async executeTransition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { targetStatus: LeadStatus; remarks?: string },
    @CurrentUser() user: RequestUser,
  ) {
    if (!body.targetStatus) {
      throw new BadRequestException('targetStatus is required');
    }
    return this.leadLifecycleService.transition(
      id,
      body.targetStatus,
      user,
      body.remarks,
    );
  }
}
