import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import { AuditAction, Prisma } from '@prisma/client';
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
  metadata?: Record<string, any>;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Logs an audit record asynchronously.
   */
  async log(options: AuditLogOptions): Promise<void> {
    const resolvedCorrelationId =
      options.correlationId || correlationStorage.getStore() || 'system';

    await this.prisma.auditLog.create({
      data: {
        userId: options.userId || null,
        module: options.module,
        entity: options.entity,
        entityId: options.entityId,
        action: options.action,
        oldValue: options.oldValue
          ? JSON.parse(JSON.stringify(options.oldValue))
          : null,
        newValue: options.newValue
          ? JSON.parse(JSON.stringify(options.newValue))
          : null,
        ...(options.metadata ? { metadata: options.metadata } : {}),
        ipAddress: options.ipAddress || null,
        userAgent: options.userAgent || null,
        correlationId: resolvedCorrelationId,
      },
    });
  }

  /**
   * Enforces transactional audit logging (G022).
   * Executes audit record creation inside the caller's Prisma transaction client.
   * If the business mutation rolls back, the audit log rolls back atomically.
   */
  async logInTransaction(
    tx: Prisma.TransactionClient,
    options: AuditLogOptions,
  ): Promise<void> {
    const resolvedCorrelationId =
      options.correlationId || correlationStorage.getStore() || 'system';

    await tx.auditLog.create({
      data: {
        userId: options.userId || null,
        module: options.module,
        entity: options.entity,
        entityId: options.entityId,
        action: options.action,
        oldValue: options.oldValue
          ? JSON.parse(JSON.stringify(options.oldValue))
          : null,
        newValue: options.newValue
          ? JSON.parse(JSON.stringify(options.newValue))
          : null,
        ...(options.metadata ? { metadata: options.metadata } : {}),
        ipAddress: options.ipAddress || null,
        userAgent: options.userAgent || null,
        correlationId: resolvedCorrelationId,
      },
    });
  }

  /**
   * Retrieves paginated system audit logs with filtering.
   */
  async getAuditLogs(params?: {
    search?: string;
    entity?: string;
    action?: string;
    userId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(params?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params?.limit) || 50));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params?.entity && params.entity !== 'ALL') {
      where.entity = params.entity;
    }
    if (params?.action && params.action !== 'ALL') {
      where.action = params.action as AuditAction;
    }
    if (params?.userId) {
      where.userId = params.userId;
    }
    if (params?.search && params.search.trim()) {
      const q = params.search.trim();
      where.OR = [
        { entityId: { contains: q, mode: 'insensitive' } },
        { entity: { contains: q, mode: 'insensitive' } },
        { correlationId: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, logs] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      data: logs,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Append-only guardrail (G023).
   * Prevents any runtime attempt to update or delete audit logs.
   */
  assertImmutableOperation(operation: string): void {
    if (
      ['update', 'updatemany', 'delete', 'deletemany', 'upsert'].includes(
        operation.toLowerCase(),
      )
    ) {
      throw new ForbiddenException(
        'Audit logs are append-only and strictly immutable under IRDAI regulations (G023). Updates and deletions are forbidden.',
      );
    }
  }
}
