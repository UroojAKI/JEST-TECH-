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
   * Validates caller audit context and enforces tenant boundaries (DEF-024).
   */
  private validateAccess(access: AuditAccessContext): void {
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
      throw new ForbiddenException('Invalid audit access scope.');
    }
  }

  /**
   * Retrieves paginated system audit logs with mandatory tenant isolation (DEF-024 / Phase 1).
   * Unfiltered global queries are strictly limited to authorized GLOBAL access contexts.
   */
  async getAuditLogs(
    access: AuditAccessContext,
    params?: AuditFilters,
  ) {
    this.validateAccess(access);

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
   * REQ-6: Complete Admin Audit Dashboard - User Activity Summary
   * Computes user-wise action aggregations (created, edited, saved, deleted, approved, rejected, login/logout).
   */
  async getUserActivitySummary(
    access: AuditAccessContext,
    params?: { startDate?: string | Date; endDate?: string | Date },
  ) {
    this.validateAccess(access);

    const where: Prisma.AuditLogWhereInput = {};
    if (access.scope === 'TENANT') {
      where.user = { companyId: access.companyId.trim() };
    }
    if (params?.startDate || params?.endDate) {
      where.createdAt = {};
      if (params.startDate) where.createdAt.gte = new Date(params.startDate);
      if (params.endDate) where.createdAt.lte = new Date(params.endDate);
    }

    const [totalEvents, creates, updates, deletes, approvals, rejections, logins, logouts] =
      await Promise.all([
        this.prisma.auditLog.count({ where }),
        this.prisma.auditLog.count({ where: { ...where, action: AuditAction.CREATE } }),
        this.prisma.auditLog.count({ where: { ...where, action: AuditAction.UPDATE } }),
        this.prisma.auditLog.count({ where: { ...where, action: AuditAction.DELETE } }),
        this.prisma.auditLog.count({ where: { ...where, action: AuditAction.APPROVE } }),
        this.prisma.auditLog.count({ where: { ...where, action: AuditAction.REJECT } }),
        this.prisma.auditLog.count({ where: { ...where, action: AuditAction.LOGIN } }),
        this.prisma.auditLog.count({ where: { ...where, action: AuditAction.LOGOUT } }),
      ]);

    const logs = await this.prisma.auditLog.findMany({
      where,
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        module: true,
        createdAt: true,
        userId: true,
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
      take: 2000,
    });

    const userMap = new Map<string, {
      userId: string;
      userName: string;
      email: string;
      role: string;
      creates: number;
      updates: number;
      deletes: number;
      approvals: number;
      rejections: number;
      logins: number;
      logouts: number;
      totalActions: number;
      lastActive: Date | null;
    }>();

    for (const log of logs) {
      const uId = log.userId || 'system';
      let entry = userMap.get(uId);
      if (!entry) {
        const u = log.user;
        const name = u
          ? `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email
          : uId === 'system'
            ? 'System / Background Job'
            : 'Unknown User';

        const roleStr =
          (u?.role as any)?.type ||
          (u?.role as any)?.name ||
          (typeof u?.role === 'string' ? u.role : 'SYSTEM');

        entry = {
          userId: uId,
          userName: name,
          email: u?.email || 'system@crm.internal',
          role: roleStr,
          creates: 0,
          updates: 0,
          deletes: 0,
          approvals: 0,
          rejections: 0,
          logins: 0,
          logouts: 0,
          totalActions: 0,
          lastActive: null,
        };
        userMap.set(uId, entry);
      }

      entry.totalActions += 1;
      if (!entry.lastActive || log.createdAt > entry.lastActive) {
        entry.lastActive = log.createdAt;
      }

      if (log.action === AuditAction.CREATE) entry.creates += 1;
      else if (log.action === AuditAction.UPDATE) entry.updates += 1;
      else if (log.action === AuditAction.DELETE) entry.deletes += 1;
      else if (log.action === AuditAction.APPROVE) entry.approvals += 1;
      else if (log.action === AuditAction.REJECT) entry.rejections += 1;
      else if (log.action === AuditAction.LOGIN) entry.logins += 1;
      else if (log.action === AuditAction.LOGOUT) entry.logouts += 1;
    }

    const userBreakdown = Array.from(userMap.values()).sort(
      (a, b) => b.totalActions - a.totalActions,
    );

    return {
      totals: {
        totalEvents,
        creates,
        updates,
        deletes,
        approvals,
        rejections,
        logins,
        logouts,
      },
      userBreakdown,
    };
  }

  /**
   * REQ-6: Complete Admin Audit Dashboard - User Sessions
   * Pairs LOGIN and LOGOUT records to determine connection duration.
   * Clarifies that session duration reflects authenticated connection interval, not active employee work time.
   */
  async getUserSessions(
    access: AuditAccessContext,
    params?: {
      userId?: string;
      startDate?: string | Date;
      endDate?: string | Date;
      page?: number;
      limit?: number;
    },
  ) {
    this.validateAccess(access);

    const page = Math.max(1, Number(params?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params?.limit) || 25));

    const where: Prisma.AuditLogWhereInput = {
      action: { in: [AuditAction.LOGIN, AuditAction.LOGOUT] },
    };

    if (access.scope === 'TENANT') {
      where.user = { companyId: access.companyId.trim() };
    }
    if (params?.userId) {
      where.userId = params.userId;
    }
    if (params?.startDate || params?.endDate) {
      where.createdAt = {};
      if (params.startDate) where.createdAt.gte = new Date(params.startDate);
      if (params.endDate) where.createdAt.lte = new Date(params.endDate);
    }

    const authLogs = await this.prisma.auditLog.findMany({
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
      take: 1000,
    });

    const sessions: Array<{
      sessionId: string;
      userId: string;
      user: {
        id: string;
        name: string;
        email: string;
        role: string;
      };
      loginTime: string;
      logoutTime: string | null;
      durationMinutes: number | null;
      durationFormatted: string;
      status: 'ENDED' | 'ACTIVE' | 'EXPIRED';
      ipAddress: string | null;
      userAgent: string | null;
    }> = [];

    const chronological = [...authLogs].reverse();
    const activeLogins = new Map<string, (typeof authLogs)[0]>();

    for (const log of chronological) {
      const uId = log.userId;
      if (!uId) continue;

      if (log.action === AuditAction.LOGIN) {
        const prevLogin = activeLogins.get(uId);
        if (prevLogin) {
          const userName = prevLogin.user
            ? `${prevLogin.user.firstName || ''} ${prevLogin.user.lastName || ''}`.trim() ||
              prevLogin.user.email
            : 'Unknown User';

          const roleStr =
            (prevLogin.user?.role as any)?.type ||
            (prevLogin.user?.role as any)?.name ||
            (typeof prevLogin.user?.role === 'string' ? prevLogin.user.role : 'USER');

          sessions.push({
            sessionId: `sess-${prevLogin.id.slice(0, 8)}`,
            userId: uId,
            user: {
              id: uId,
              name: userName,
              email: prevLogin.user?.email || 'N/A',
              role: roleStr,
            },
            loginTime: prevLogin.createdAt.toISOString(),
            logoutTime: null,
            durationMinutes: null,
            durationFormatted: 'Expired (No logout recorded)',
            status: 'EXPIRED',
            ipAddress: prevLogin.ipAddress,
            userAgent: prevLogin.userAgent,
          });
        }
        activeLogins.set(uId, log);
      } else if (log.action === AuditAction.LOGOUT) {
        const login = activeLogins.get(uId);
        if (login) {
          const diffMs = log.createdAt.getTime() - login.createdAt.getTime();
          const durationMins = Math.max(1, Math.round(diffMs / 60000));
          const hours = Math.floor(durationMins / 60);
          const mins = durationMins % 60;
          const durationFormatted = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

          const userName = login.user
            ? `${login.user.firstName || ''} ${login.user.lastName || ''}`.trim() || login.user.email
            : 'Unknown User';

          const roleStr =
            (login.user?.role as any)?.type ||
            (login.user?.role as any)?.name ||
            (typeof login.user?.role === 'string' ? login.user.role : 'USER');

          sessions.push({
            sessionId: `sess-${login.id.slice(0, 8)}`,
            userId: uId,
            user: {
              id: uId,
              name: userName,
              email: login.user?.email || 'N/A',
              role: roleStr,
            },
            loginTime: login.createdAt.toISOString(),
            logoutTime: log.createdAt.toISOString(),
            durationMinutes: durationMins,
            durationFormatted,
            status: 'ENDED',
            ipAddress: login.ipAddress || log.ipAddress,
            userAgent: login.userAgent || log.userAgent,
          });
          activeLogins.delete(uId);
        }
      }
    }

    const now = Date.now();
    for (const [uId, login] of activeLogins.entries()) {
      const diffMs = now - login.createdAt.getTime();
      const hoursAgo = diffMs / 3600000;
      const userName = login.user
        ? `${login.user.firstName || ''} ${login.user.lastName || ''}`.trim() || login.user.email
        : 'Unknown User';

      const roleStr =
        (login.user?.role as any)?.type ||
        (login.user?.role as any)?.name ||
        (typeof login.user?.role === 'string' ? login.user.role : 'USER');

      if (hoursAgo < 8) {
        const durationMins = Math.max(1, Math.round(diffMs / 60000));
        const hours = Math.floor(durationMins / 60);
        const mins = durationMins % 60;
        const durationFormatted =
          hours > 0 ? `${hours}h ${mins}m (In Progress)` : `${mins}m (In Progress)`;

        sessions.push({
          sessionId: `sess-${login.id.slice(0, 8)}`,
          userId: uId,
          user: {
            id: uId,
            name: userName,
            email: login.user?.email || 'N/A',
            role: roleStr,
          },
          loginTime: login.createdAt.toISOString(),
          logoutTime: null,
          durationMinutes: durationMins,
          durationFormatted,
          status: 'ACTIVE',
          ipAddress: login.ipAddress,
          userAgent: login.userAgent,
        });
      } else {
        sessions.push({
          sessionId: `sess-${login.id.slice(0, 8)}`,
          userId: uId,
          user: {
            id: uId,
            name: userName,
            email: login.user?.email || 'N/A',
            role: roleStr,
          },
          loginTime: login.createdAt.toISOString(),
          logoutTime: null,
          durationMinutes: null,
          durationFormatted: 'Expired (Session timed out)',
          status: 'EXPIRED',
          ipAddress: login.ipAddress,
          userAgent: login.userAgent,
        });
      }
    }

    sessions.sort((a, b) => new Date(b.loginTime).getTime() - new Date(a.loginTime).getTime());

    const total = sessions.length;
    const paginated = sessions.slice((page - 1) * limit, page * limit);

    return {
      data: paginated,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
      disclaimer:
        'Audit session duration uses reliable login/logout session association intervals and does not indicate continuous employee active working time.',
    };
  }

  /**
   * REQ-6: Complete Admin Audit Dashboard - User Activity Timeline
   * Formats a chronological user activity stream with human-readable descriptions.
   */
  async getActivityTimeline(
    access: AuditAccessContext,
    params?: {
      userId?: string;
      action?: string;
      entity?: string;
      startDate?: string | Date;
      endDate?: string | Date;
      page?: number;
      limit?: number;
    },
  ) {
    this.validateAccess(access);

    const page = Math.max(1, Number(params?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params?.limit) || 30));
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {};
    if (access.scope === 'TENANT') {
      where.user = { companyId: access.companyId.trim() };
    }
    if (params?.userId) where.userId = params.userId;
    if (params?.action && params.action !== 'ALL') where.action = params.action as AuditAction;
    if (params?.entity && params.entity !== 'ALL') where.entity = params.entity;
    if (params?.startDate || params?.endDate) {
      where.createdAt = {};
      if (params.startDate) where.createdAt.gte = new Date(params.startDate);
      if (params.endDate) where.createdAt.lte = new Date(params.endDate);
    }

    const [total, rawLogs] = await Promise.all([
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

    const formattedEvents = rawLogs.map((log) => {
      const actorName = log.user
        ? `${log.user.firstName || ''} ${log.user.lastName || ''}`.trim() || log.user.email
        : 'System';

      const roleStr =
        (log.user?.role as any)?.type ||
        (log.user?.role as any)?.name ||
        (typeof log.user?.role === 'string' ? log.user.role : 'SYSTEM');

      let description = `${actorName} performed ${log.action} on ${log.entity} [${log.entityId}]`;
      if (log.action === AuditAction.LOGIN) {
        description = `${actorName} logged in from IP ${log.ipAddress || 'unknown'}`;
      } else if (log.action === AuditAction.LOGOUT) {
        description = `${actorName} logged out of session`;
      } else if (log.action === AuditAction.APPROVE) {
        description = `${actorName} approved ${log.entity} amendment [${log.entityId}]`;
      } else if (log.action === AuditAction.REJECT) {
        description = `${actorName} rejected ${log.entity} change request [${log.entityId}]`;
      } else if (log.action === AuditAction.CREATE) {
        description = `${actorName} created new ${log.entity} record [${log.entityId}]`;
      } else if (log.action === AuditAction.UPDATE) {
        description = `${actorName} updated ${log.entity} [${log.entityId}]`;
      } else if (log.action === AuditAction.DELETE) {
        description = `${actorName} deleted ${log.entity} [${log.entityId}]`;
      }

      return {
        id: log.id,
        timestamp: log.createdAt.toISOString(),
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        module: log.module,
        correlationId: log.correlationId,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        description,
        user: {
          id: log.user?.id || log.userId || 'system',
          name: actorName,
          email: log.user?.email || 'system@crm.internal',
          role: roleStr,
        },
        hasDiff: Boolean(log.oldValue || log.newValue),
        oldValue: log.oldValue,
        newValue: log.newValue,
        metadata: log.metadata,
      };
    });

    return {
      data: formattedEvents,
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
