import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { WorkflowEntityType } from '@prisma/client';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../../auth/decorators/permissions.decorator';
import {
  CurrentUser,
  RequestUser,
} from '../../../auth/decorators/current-user.decorator';
import { WorkflowEngineService } from '../services/workflow-engine.service';
import { PrismaService } from '../../../../database/prisma.service';

@ApiTags('Workflows')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('workflow')
export class WorkflowsController {
  constructor(
    private readonly engine: WorkflowEngineService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('definitions')
  @RequirePermissions('WORKFLOW_VIEW')
  async listWorkflows() {
    return this.prisma.workflow.findMany({
      where: { deletedAt: null },
      include: { states: true, transitions: true },
    });
  }

  @Post('definitions')
  @RequirePermissions('WORKFLOW_EDIT')
  async createWorkflow(@Body() body: any) {
    return this.prisma.workflow.create({
      data: body,
    });
  }

  @Patch('definitions/:id')
  @RequirePermissions('WORKFLOW_EDIT')
  async updateWorkflow(@Param('id') id: string, @Body() body: any) {
    return this.prisma.workflow.update({
      where: { id },
      data: body,
    });
  }

  @Delete('definitions/:id')
  @RequirePermissions('WORKFLOW_EDIT')
  async deleteWorkflow(@Param('id') id: string) {
    return this.prisma.workflow.update({
      where: { id },
      data: { deletedAt: new Date(), active: false },
    });
  }

  @Get(':entityType/:entityId/transitions')
  @RequirePermissions('WORKFLOW_VIEW')
  async getTransitions(
    @Param('entityType') entityType: WorkflowEntityType,
    @Param('entityId') entityId: string,
    @CurrentUser() user: any,
  ) {
    return this.engine.getAvailableTransitions(entityType, entityId, user.id);
  }

  @Post(':entityType/:entityId/transition')
  @RequirePermissions('WORKFLOW_EXECUTE')
  async triggerTransition(
    @Param('entityType') entityType: WorkflowEntityType,
    @Param('entityId') entityId: string,
    @Body() body: { transitionId: string; comments?: string },
    @CurrentUser() user: any,
  ) {
    await this.engine.transition(
      entityType,
      entityId,
      body.transitionId,
      user.id,
      body.comments,
    );
    return { success: true };
  }

  @Get(':entityType/:entityId/history')
  @RequirePermissions('WORKFLOW_VIEW')
  async getHistory(
    @Param('entityType') entityType: WorkflowEntityType,
    @Param('entityId') entityId: string,
  ) {
    return this.prisma.workflowHistory.findMany({
      where: { entityId, entityType },
      include: {
        performedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
