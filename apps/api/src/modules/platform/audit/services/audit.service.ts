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

export type CreateAuditLogDto = AuditLogOptions;

export type AuditAccessContext =
  | { scope: 'TENANT'; companyId: string }
  | { scope: 'GLOBAL'; actorId: string };

export interface AuditFilters {
  search?: string;
  entity?: string;
  action?: string;
  userId?: string;
  startDate?: string | Date;
  endDate?: string | Date;
  page?: number;
  limit?: number;
  maxLimit?: number;
}

export interface AuditExportFilters extends AuditFilters {
  format?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Logs an audit record asynchronously with PII & secret redaction (SEC-002).
   */
  async createAuditLog(options: CreateAuditLogDto) {
    const resolvedCorrelationId =
      options.correlationId || correlationStorage.getStore() || 'system';

    return this.prisma.auditLog.create({
      data: {
        userId: options.userId || null,
        module: options.module,
        entity: options.entity,
        entityId: options.entityId,
        action: options.action,
        oldValue: options.oldValue
          ? this.sanitizeAuditPayload(
              JSON.parse(JSON.stringify(options.oldValue)),
            )
          : null,
        newValue: options.newValue
          ? this.sanitizeAuditPayload(
              JSON.parse(JSON.stringify(options.newValue)),
            )
          : null,
        ...(options.metadata
          ? { metadata: this.sanitizeAuditPayload(options.metadata) }
          : {}),
        ipAddress: options.ipAddress || null,
        userAgent: options.userAgent || null,
        correlationId: resolvedCorrelationId,
      },
    });
  }

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
          ? this.sanitizeAuditPayload(
              JSON.parse(JSON.stringify(options.oldValue)),
            )
          : null,
        newValue: options.newValue
          ? this.sanitizeAuditPayload(
              JSON.parse(JSON.stringify(options.newValue)),
            )
          : null,
        ...(options.metadata
          ? { metadata: this.sanitizeAuditPayload(options.metadata) }
          : {}),
        ipAddress: options.ipAddress || null,
        userAgent: options.userAgent || null,
        correlationId: resolvedCorrelationId,
      },
    });
  }

  /**
   * Enforces transactional audit logging (G022) with PII & secret redaction (SEC-002).
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
          ? this.sanitizeAuditPayload(
              JSON.parse(JSON.stringify(options.oldValue)),
            )
          : null,
        newValue: options.newValue
          ? this.sanitizeAuditPayload(
              JSON.parse(JSON.stringify(options.newValue)),
            )
          : null,
        ...(options.metadata
          ? { metadata: this.sanitizeAuditPayload(options.metadata) }
          : {}),
        ipAddress: options.ipAddress || null,
        userAgent: options.userAgent || null,
        correlationId: resolvedCorrelationId,
      },
    });
  }

  /**
   * Redacts passwords, tokens, API keys and masks Aadhaar, PAN, and Bank Account numbers (SEC-002).
   */
  private sanitizeAuditPayload(data: any): any {
    if (!data || typeof data !== 'object') return data;
    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizeAuditPayload(item));
    }

    const sanitized: Record<string, any> = {};
    const secretKeys = [
      'password',
      'passwordhash',
      'token',
      'refreshtoken',
      'secret',
      'jwt',
      'apikey',
      'authorization',
    ];

    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();

      if (secretKeys.some((s) => lowerKey.includes(s))) {
        sanitized[key] = '[REDACTED]';
      } else if (lowerKey.includes('aadhaar') && typeof value === 'string') {
        sanitized[key] =
          value.length >= 4 ? `XXXXXXXX${value.slice(-4)}` : '[REDACTED]';
      } else if (
        lowerKey.includes('pan') &&
        typeof value === 'string' &&
        value.length === 10
      ) {
        sanitized[key] = `XXXXX${value.slice(5, 9)}X`;
      } else if (
        (lowerKey.includes('bankaccount') ||
          lowerKey.includes('accountnumber')) &&
        typeof value === 'string'
      ) {
        sanitized[key] =
          value.length >= 4 ? `XXXXXX${value.slice(-4)}` : '[REDACTED]';
      } else if (value && typeof value === 'object') {
        sanitized[key] = this.sanitizeAuditPayload(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  /**
   * Retrieves paginated system audit logs with mandatory tenant isolation (DEF-024 / Phase 1).
   * Unfiltered global queries are strictly limited to authorized GLOBAL access contexts.
   */
  async getAuditLogs(
    access: AuditAccessContext,
    params?: AuditFilters,
  ) {
    if (!access || !access.scope) {
      throw new ForbiddenException(
        'Audit access context is required to query audit records.',
      );
    }

    if (access.scope === 'TENANT') {
      if (!access.companyId || typeof access.companyId !== 'string' || !access.companyId.trim()) {
        throw new ForbiddenException(
          'Tenant identifier (companyId) is required for tenant-scoped audit access.',
        );
      }
    } else if (access.scope === 'GLOBAL') {
      if (!access.actorId || typeof access.actorId !== 'string' || !access.actorId.trim()) {
        throw new ForbiddenException(
          'Actor identifier is required for global audit access.',
        );
      }
    } else {
      throw new ForbiddenException(
        'Invalid audit access scope.',
      );
    }

    const page = Math.max(1, Number(params?.page) || 1);
    const maxAllowed = params?.maxLimit || 1000;
    const limit = Math.min(maxAllowed, Math.max(1, Number(params?.limit) || 50));
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {};

    // ── Enforce Tenant Boundary ─────────────────────────────────────────
    if (access.scope === 'TENANT') {
      where.user = { companyId: access.companyId.trim() };
    }

    if (params?.entity && params.entity !== 'ALL') {
      where.entity = params.entity;
    }
    if (params?.action && params.action !== 'ALL') {
      where.action = params.action as AuditAction;
    }
    if (params?.userId) {
      where.userId = params.userId;
    }
    if (params?.startDate || params?.endDate) {
      where.createdAt = {};
      if (params.startDate) {
        where.createdAt.gte = new Date(params.startDate);
      }
      if (params.endDate) {
        where.createdAt.lte = new Date(params.endDate);
      }
    }
    if (params?.search && params.search.trim()) {
      const q = params.search.trim();
      const searchConditions: Prisma.AuditLogWhereInput[] = [
        { entityId: { contains: q, mode: 'insensitive' } },
        { entity: { contains: q, mode: 'insensitive' } },
        { module: { contains: q, mode: 'insensitive' } },
        { correlationId: { contains: q, mode: 'insensitive' } },
        { user: { firstName: { contains: q, mode: 'insensitive' } } },
        { user: { lastName: { contains: q, mode: 'insensitive' } } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
      ];

      if (access.scope === 'TENANT') {
        where.AND = [
          { user: { companyId: access.companyId.trim() } },
          { OR: searchConditions },
        ];
      } else {
        where.OR = searchConditions;
      }
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
   * Export audit logs in CSV or JSON format with mandatory tenant boundary (DEF-024 / Phase 1).
   */
  async exportAuditLogs(
    access: AuditAccessContext,
    params?: AuditExportFilters,
  ) {
    const logsResult = await this.getAuditLogs(access, {
      entity: params?.entity,
      action: params?.action,
      userId: params?.userId,
      search: params?.search,
      startDate: params?.startDate,
      endDate: params?.endDate,
      page: 1,
      limit: 1000,
    });

    if (params?.format === 'json') {
      return logsResult.data;
    }

    const header = [
      'ID',
      'Timestamp',
      'Action',
      'Module',
      'Entity',
      'Entity ID',
      'User Email',
      'IP Address',
      'Correlation ID',
    ].join(',');

    const rows = logsResult.data.map((log: any) =>
      [
        log.id,
        log.createdAt ? new Date(log.createdAt).toISOString() : '',
        log.action,
        log.module || '',
        log.entity,
        log.entityId,
        log.user?.email || 'SYSTEM',
        log.ipAddress || '',
        log.correlationId || '',
      ]
        .map((val) => `"${String(val).replace(/"/g, '""')}"`)
        .join(','),
    );

    return [header, ...rows].join('\n');
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
