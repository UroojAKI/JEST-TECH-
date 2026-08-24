-- CreateEnum
CREATE TYPE "public"."SaodVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."SaodVerificationMethod" AS ENUM ('POLICY_DOCUMENT', 'INSURER_PORTAL', 'INSURER_CONFIRMATION', 'OTHER');

-- CreateTable
CREATE TABLE "public"."motor_tariffs" (
    "id" TEXT NOT NULL,
    "vehicleCategory" "public"."VehicleCategory" NOT NULL,
    "vehicleSubCategory" TEXT,
    "engineCcMin" INTEGER,
    "engineCcMax" INTEGER,
    "seatingCapMin" INTEGER,
    "seatingCapMax" INTEGER,
    "gvwMin" DECIMAL(65,30),
    "gvwMax" DECIMAL(65,30),
    "policyType" TEXT NOT NULL,
    "annualPremium" DECIMAL(65,30) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "source" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verificationNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "motor_tariffs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."saod_tp_verifications" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "tpInsurer" TEXT NOT NULL,
    "tpPolicyNumber" TEXT NOT NULL,
    "tpStartDate" TIMESTAMP(3) NOT NULL,
    "tpExpiryDate" TIMESTAMP(3) NOT NULL,
    "verificationStatus" "public"."SaodVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verificationMethod" "public"."SaodVerificationMethod",
    "evidenceDocumentUrl" TEXT,
    "verifierNotes" TEXT,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saod_tp_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "motor_tariffs_vehicleCategory_effectiveFrom_isActive_idx" ON "public"."motor_tariffs"("vehicleCategory", "effectiveFrom", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "saod_tp_verifications_quotationId_key" ON "public"."saod_tp_verifications"("quotationId");

-- AddForeignKey
ALTER TABLE "public"."saod_tp_verifications" ADD CONSTRAINT "saod_tp_verifications_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "public"."quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."saod_tp_verifications" ADD CONSTRAINT "saod_tp_verifications_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
