-- CreateEnum
CREATE TYPE "public"."IssuanceStatus" AS ENUM ('DRAFT', 'PROPOSAL_READY', 'SUBMITTED', 'PAYMENT_PENDING', 'PAYMENT_CONFIRMED', 'ISSUANCE_PENDING', 'ISSUED', 'VERIFICATION_PENDING', 'VERIFIED');

-- CreateEnum
CREATE TYPE "public"."CrmCompletionStatus" AS ENUM ('INCOMPLETE', 'READY', 'COMPLETED');

-- CreateEnum
CREATE TYPE "public"."VehicleStatus" AS ENUM ('NEW', 'EXISTING');

-- CreateEnum
CREATE TYPE "public"."AddonRateType" AS ENUM ('PERCENT_OF_IDV', 'PERCENT_OF_OD', 'FIXED', 'TIERED', 'FORMULA', 'INSURER_QUOTE', 'MANUAL');

-- CreateEnum
CREATE TYPE "public"."RateSourceType" AS ENUM ('IRDAI_RULE', 'IRDAI_NOTIFICATION', 'INSURER_FILED_RATE', 'INSURER_PRODUCT', 'ADMIN_CONFIG');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."PolicyStatus" ADD VALUE 'DRAFT';
ALTER TYPE "public"."PolicyStatus" ADD VALUE 'RENEWED';

-- AlterTable
ALTER TABLE "public"."policies" ADD COLUMN     "actualPolicyNumber" TEXT,
ADD COLUMN     "actualPremium" DECIMAL(65,30),
ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "issueDate" TIMESTAMP(3),
ADD COLUMN     "issuedPolicyDocumentId" TEXT,
ADD COLUMN     "odExpiryDate" TIMESTAMP(3),
ADD COLUMN     "odStartDate" TIMESTAMP(3),
ADD COLUMN     "paymentStatus" "public"."PaymentStatus",
ADD COLUMN     "startDate" TIMESTAMP(3),
ADD COLUMN     "tpExpiryDate" TIMESTAMP(3),
ADD COLUMN     "tpStartDate" TIMESTAMP(3),
ADD COLUMN     "verificationStatus" "public"."DocumentVerificationStatus";

-- AlterTable
ALTER TABLE "public"."quotations" ADD COLUMN     "calculationSnapshot" JSONB,
ADD COLUMN     "calculationVersion" TEXT,
ADD COLUMN     "insurerId" TEXT,
ADD COLUMN     "issuanceStatus" "public"."IssuanceStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "productCode" TEXT,
ADD COLUMN     "rateConfigurationVersion" INTEGER;

-- AlterTable
ALTER TABLE "public"."vehicles" ADD COLUMN     "status" "public"."VehicleStatus" NOT NULL DEFAULT 'EXISTING',
ADD COLUMN     "subtype" TEXT;

-- CreateTable
CREATE TABLE "public"."motor_rate_configurations" (
    "id" TEXT NOT NULL,
    "rateCategory" TEXT NOT NULL,
    "addonCode" TEXT,
    "insurerId" TEXT,
    "productCode" TEXT,
    "vehicleCategory" TEXT,
    "vehicleSubType" TEXT,
    "policyType" TEXT,
    "pricingModel" "public"."AddonRateType" NOT NULL,
    "rateValue" DECIMAL(65,30),
    "minAmount" DECIMAL(65,30),
    "maxAmount" DECIMAL(65,30),
    "gstRate" DECIMAL(65,30),
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sourceType" "public"."RateSourceType" NOT NULL,
    "sourceReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "motor_rate_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "motor_rate_configurations_rateCategory_isActive_idx" ON "public"."motor_rate_configurations"("rateCategory", "isActive");

-- CreateIndex
CREATE INDEX "motor_rate_configurations_addonCode_idx" ON "public"."motor_rate_configurations"("addonCode");
