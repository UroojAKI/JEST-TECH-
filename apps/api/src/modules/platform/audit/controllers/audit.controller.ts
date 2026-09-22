import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleType } from '@prisma/client';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import type { RequestUser } from '../../../auth/decorators/current-user.decorator';
import { AuditService } from '../services/audit.service';

@ApiTags('Audit Logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.ADMIN)
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  // ── F-012 FIX: All audit log queries are now scoped to actor's companyId ──
  // Super-admins (permissions: ['*']) see all tenants; regular admins see only their tenant.

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
  ) {
    const isSuperAdmin = (user as any).permissions?.includes('*');
    const companyId = isSuperAdmin
      ? undefined
      : user.companyId || (user as any).organizationId;

    return this.auditService.exportAuditLogs({
      format,
      entity,
      action,
      userId,
      search,
      companyId,
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
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const isSuperAdmin = (user as any).permissions?.includes('*');
    const companyId = isSuperAdmin
      ? undefined
      : user.companyId || (user as any).organizationId;

    return this.auditService.getAuditLogs({
      entity,
      action,
      userId,
      search,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      companyId,
    });
  }
}
