import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleType } from '@prisma/client';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { PrismaService } from '../../../../database/prisma.service';

@ApiTags('Audit Logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
@Controller('audit')
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Get system audit trail logs' })
  async getAuditLogs(@Query('entityType') entityType?: string, @Query('userId') userId?: string) {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        ...(entityType ? { entityName: entityType } : {}),
        ...(userId ? { userId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return logs;
  }
}
