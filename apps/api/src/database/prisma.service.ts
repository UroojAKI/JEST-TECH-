import {
  INestApplication,
  Injectable,
  Logger,
  OnModuleInit,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { installPiiEncryption } from './middleware/pii-encryption.middleware';
import { Prisma } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super();
    installPiiEncryption(this, Prisma.dmmf.datamodel.models.map((model) => model.name));
    // Enforce AuditLog immutability / append-only at the database client level (G023)
    const enforceAuditLogImmutability = () => {
      throw new ForbiddenException(
        'Audit logs are append-only and strictly immutable under IRDAI regulations (G023). Updates and deletions are forbidden.',
      );
    };

    if (this.auditLog) {
      (this.auditLog as any).update = enforceAuditLogImmutability;
      (this.auditLog as any).updateMany = enforceAuditLogImmutability;
      (this.auditLog as any).delete = enforceAuditLogImmutability;
      (this.auditLog as any).deleteMany = enforceAuditLogImmutability;
      (this.auditLog as any).upsert = enforceAuditLogImmutability;
    }
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Prisma Database Client connected successfully.');
      await this.ensureCoreSequences();
    } catch (err: any) {
      this.logger.warn(
        `[PrismaService] Database connection warning: ${err.message}. Ensure PostgreSQL is running on port 5432.`,
      );
    }
  }

  /**
   * Ensures all required PostgreSQL sequences exist idempotently on startup.
   * Eliminates 42P01 sequence relation missing errors on newly restored or migrated environments.
   */
  private async ensureCoreSequences(): Promise<void> {
    const sequences = [
      'policy_number_seq',
      'claim_number_seq',
      'quotation_number_seq',
      'contact_number_seq',
      'customer_number_seq',
      'account_number_seq',
      'lead_number_seq',
      'endorsement_number_seq',
      'proposal_number_seq',
      'journal_entry_number_seq',
      'receipt_number_seq',
      'settlement_batch_seq',
      'back_office_task_code_seq',
      'motor_quotation_number_seq',
      'vehicle_code_seq',
      'employee_code_seq',
    ];

    try {
      await Promise.all(
        sequences.map((seq) =>
          this.$executeRawUnsafe(
            `CREATE SEQUENCE IF NOT EXISTS ${seq} START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;`,
          ).catch((e) => {
            this.logger.debug(`[PrismaService] Sequence ${seq} provision check: ${e?.message}`);
          }),
        ),
      );
    } catch {
      // Ignored: defensive fallback
    }
  }

  enableShutdownHooks(app: INestApplication) {
    process.on('beforeExit', () => {
      void app.close();
    });
  }
}
