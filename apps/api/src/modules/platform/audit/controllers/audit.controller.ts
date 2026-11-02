import { Controller, Get, Query, UseGuards, ForbiddenException, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { RoleType } from '@prisma/client';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import type { RequestUser } from '../../../auth/decorators/current-user.decorator';
import { AuditService, AuditAccessContext } from '../services/audit.service';

@ApiTags('Audit Logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.ADMIN)
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * Resolves the authoritative audit access context (DEF-024 / Phase 1).
   * Distinguishes ordinary tenant administrators from verified platform super-administrators.
   * Rejects ordinary admin requests missing tenant context.
   */
  private resolveAuditAccess(user: RequestUser): AuditAccessContext {
    if (!user) {
      throw new ForbiddenException('Authentication context is required');
    }

    const tenantId = (user.companyId || (user as any).organizationId)?.trim();

    // Platform-wide global access is permitted ONLY for platform super-administrators
    // who have no tenant affiliation and hold platform super-admin permissions.
    const isGlobalSuperAdmin =
      !tenantId &&
      Array.isArray(user.permissions) &&
      (user.permissions.includes('*') ||
        user.permissions.includes('PLATFORM_SUPER_ADMIN') ||
        user.permissions.includes('SYSTEM_AUDIT_GLOBAL'));

    if (isGlobalSuperAdmin) {
      return {
        scope: 'GLOBAL',
        actorId: user.userId || user.id,
      };
    }

    // Tenant administrators MUST have a valid tenant context
    if (!tenantId) {
      throw new ForbiddenException(
        'Tenant context (companyId) is required to access audit trail.',
      );
    }

    return {
      scope: 'TENANT',
      companyId: tenantId,
    };
  }

  @Get('export')
  @ApiOperation({
    summary: 'Export system audit trail logs as CSV or JSON',
  })
  async exportAuditLogs(
    @CurrentUser() user: RequestUser,
    @Query('format') format = 'csv',
    @Query('entity') entity?: string,
    @Query('action') action?: string,
    @Query('userId') userId?: string,
    @Query('search') search?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const access = this.resolveAuditAccess(user);

    const result = await this.auditService.exportAuditLogs(access, {
      format,
      entity,
      action,
      userId,
      search,
      startDate,
      endDate,
    });

    if (res) {
      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
      } else {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="audit-log-${Date.now()}.csv"`,
        );
      }
    }

    return result;
  }


  @Get('summary')
  @ApiOperation({
    summary: 'Get user-wise activity summary and aggregated event metrics (REQ-6)',
  })
  async getUserActivitySummary(
    @CurrentUser() user: RequestUser,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const access = this.resolveAuditAccess(user);
    return this.auditService.getUserActivitySummary(access, {
      startDate,
      endDate,
    });
  }

  @Get('sessions')
  @ApiOperation({
    summary: 'Get user login/logout session history and duration intervals (REQ-6)',
  })
  async getUserSessions(
    @CurrentUser() user: RequestUser,
    @Query('userId') userId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const access = this.resolveAuditAccess(user);
    return this.auditService.getUserSessions(access, {
      userId,
      startDate,
      endDate,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Get('timeline')
  @ApiOperation({
    summary: 'Get chronological user activity timeline with formatted descriptions (REQ-6)',
  })
  async getActivityTimeline(
    @CurrentUser() user: RequestUser,
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('entity') entity?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const access = this.resolveAuditAccess(user);
    return this.auditService.getActivityTimeline(access, {
      userId,
      action,
      entity,
      startDate,
      endDate,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Get()
  @ApiOperation({
    summary: 'Get system audit trail logs with filtering & pagination',
  })
  async getAuditLogs(
    @CurrentUser() user: RequestUser,
    @Query('entity') entity?: string,
    @Query('action') action?: string,
    @Query('userId') userId?: string,
    @Query('search') search?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const access = this.resolveAuditAccess(user);

    return this.auditService.getAuditLogs(access, {
      entity,
      action,
      userId,
      search,
      startDate,
      endDate,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }
}
