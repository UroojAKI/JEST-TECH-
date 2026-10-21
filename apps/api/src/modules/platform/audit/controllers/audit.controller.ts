import { Controller, Get, Query, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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
  ) {
    const access = this.resolveAuditAccess(user);

    return this.auditService.exportAuditLogs(access, {
      format,
      entity,
      action,
      userId,
      search,
      startDate,
      endDate,
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
