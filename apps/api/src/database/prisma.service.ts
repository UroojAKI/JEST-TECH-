import { INestApplication, Injectable, Logger, OnModuleInit, ForbiddenException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super();
    // Enforce AuditLog immutability / append-only at the database client level (G023)
    (this as any).$use?.(async (params: any, next: any) => {
      if (params.model === 'AuditLog') {
        const forbiddenActions = ['update', 'updateMany', 'delete', 'deleteMany', 'upsert'];
        if (forbiddenActions.includes(params.action)) {
          throw new ForbiddenException(
            'Audit logs are append-only and strictly immutable under IRDAI regulations (G023). Updates and deletions are forbidden.',
          );
        }
      }
      return next(params);
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Prisma Database Client connected successfully.');
    } catch (err: any) {
      this.logger.warn(`[PrismaService] Database connection warning: ${err.message}. Ensure PostgreSQL is running on port 5432.`);
    }
  }

  enableShutdownHooks(app: INestApplication) {
    process.on('beforeExit', () => {
      void app.close();
    });
  }
}
