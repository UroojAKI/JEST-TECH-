-- AlterEnum
ALTER TYPE "public"."AuditAction" ADD VALUE 'SAOD_TP_VERIFICATION_RECORDED';

-- AlterTable
ALTER TABLE "public"."audit_logs" ADD COLUMN     "entityType" TEXT,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "performedById" TEXT;
