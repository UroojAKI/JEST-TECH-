import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import { AuditAction } from '@prisma/client';
import { correlationStorage } from '../../../../common/logger/correlation.context';

export interface AuditLogOptions {
  userId?: string;
  module: string;
  entity: string;
  entityId: string;
  action: AuditAction;
  oldValue?: any;
  newValue?: any;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(options: AuditLogOptions): Promise<void> {
    const resolvedCorrelationId =
      options.correlationId ||
      correlationStorage.getStore() ||
      'system';

    await this.prisma.auditLog.create({
      data: {
        userId: options.userId || null,
        module: options.module,
        entity: options.entity,
        entityId: options.entityId,
        action: options.action,
        oldValue: options.oldValue ? JSON.parse(JSON.stringify(options.oldValue)) : null,
        newValue: options.newValue ? JSON.parse(JSON.stringify(options.newValue)) : null,
        ipAddress: options.ipAddress || null,
        userAgent: options.userAgent || null,
        correlationId: resolvedCorrelationId,
      },
    });
  }
}
