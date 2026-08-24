-- CreateEnum
CREATE TYPE "public"."MotorWorkflowState" AS ENUM ('LEAD_CREATED', 'CUSTOMER_CAPTURED', 'VEHICLE_CAPTURED', 'PREVIOUS_POLICY_CAPTURED', 'POLICY_TYPE_SELECTED', 'RULES_EVALUATED', 'INSPECTION_REQUIRED', 'INSPECTION_COMPLETED', 'QUOTE_FINALIZED', 'PAYMENT_PENDING', 'PAYMENT_UNDER_PROCESS', 'PAYMENT_DONE', 'DOCUMENT_CHECK', 'POLICY_CREATED', 'ACTIVE', 'RENEWAL');

-- CreateEnum
CREATE TYPE "public"."NcbResetReason" AS ENUM ('CLAIM_IN_PREVIOUS_YEAR', 'OWNERSHIP_TRANSFER', 'POLICY_EXPIRED_MORE_THAN_90_DAYS', 'ELIGIBLE');

-- CreateEnum
CREATE TYPE "public"."InspectionStatus" AS ENUM ('NOT_REQUIRED', 'REQUIRED', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."InspectionConductedBy" AS ENUM ('JEST_TEAM', 'INSURER_EMPLOYEE', 'CUSTOMER_SELF', 'AGENT', 'INSPECTION_AGENCY');

-- CreateEnum
CREATE TYPE "public"."PaymentTrackingStatus" AS ENUM ('NOT_DONE', 'UNDER_PROCESS', 'PAID');

-- CreateEnum
CREATE TYPE "public"."PreviousPolicyType" AS ENUM ('COMPREHENSIVE', 'THIRD_PARTY', 'SAOD', 'NOT_AVAILABLE');

-- AlterTable
ALTER TABLE "public"."quotations" ADD COLUMN     "workflowState" "public"."MotorWorkflowState";

-- CreateTable
CREATE TABLE "public"."motor_previous_policies" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "policyExpiryDate" TIMESTAMP(3),
    "expiredMoreThan90Days" BOOLEAN NOT NULL DEFAULT false,
    "ownershipTransfer" BOOLEAN NOT NULL DEFAULT false,
    "previousPolicyType" "public"."PreviousPolicyType",
    "previousInsurerName" TEXT,
    "previousPolicyNumber" TEXT,
    "previousOdInsurerName" TEXT,
    "previousOdPolicyNumber" TEXT,
    "odExpiryDate" TIMESTAMP(3),
    "tpExpiryDate" TIMESTAMP(3),
    "claimInPreviousYear" BOOLEAN NOT NULL DEFAULT false,
    "policyTransferStatus" BOOLEAN,
    "rcTransferStatus" BOOLEAN,
    "newOwnerName" TEXT,
    "previousPolicyCopyUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "motor_previous_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."motor_rule_evaluations" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "previousPolicyId" TEXT NOT NULL,
    "inspectionRequired" BOOLEAN NOT NULL DEFAULT false,
    "inspectionReasons" TEXT[],
    "ncb" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "ncbReason" "public"."NcbResetReason" NOT NULL DEFAULT 'ELIGIBLE',
    "eligibleNcb" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "tpVerificationRequired" BOOLEAN NOT NULL DEFAULT false,
    "policyTransferRequired" BOOLEAN NOT NULL DEFAULT false,
    "saodTpValid" BOOLEAN NOT NULL DEFAULT true,
    "missingDocuments" TEXT[],
    "nextStep" TEXT NOT NULL DEFAULT 'QUOTATION',
    "evaluationContext" JSONB NOT NULL,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "motor_rule_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."motor_inspections" (
    "id" TEXT NOT NULL,
    "inspectionCode" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "status" "public"."InspectionStatus" NOT NULL DEFAULT 'REQUIRED',
    "conductedByType" "public"."InspectionConductedBy",
    "inspectorUserId" TEXT,
    "inspectorName" TEXT,
    "inspectorPhone" TEXT,
    "inspectorEmail" TEXT,
    "inspectorCompany" TEXT,
    "inspectorEmployeeId" TEXT,
    "inspectionDate" TIMESTAMP(3),
    "inspectionTime" TEXT,
    "completedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "frontImageKey" TEXT,
    "backImageKey" TEXT,
    "leftImageKey" TEXT,
    "rightImageKey" TEXT,
    "windshieldImageKey" TEXT,
    "chassisImageKey" TEXT,
    "odometerImageKey" TEXT,
    "reportPdfKey" TEXT,
    "reportPdfUrl" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "motor_inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."motor_payment_records" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "status" "public"."PaymentTrackingStatus" NOT NULL DEFAULT 'NOT_DONE',
    "amount" DECIMAL(65,30),
    "paymentMethod" TEXT,
    "referenceNumber" TEXT,
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "motor_payment_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "motor_previous_policies_quotationId_key" ON "public"."motor_previous_policies"("quotationId");

-- CreateIndex
CREATE UNIQUE INDEX "motor_rule_evaluations_quotationId_key" ON "public"."motor_rule_evaluations"("quotationId");

-- CreateIndex
CREATE UNIQUE INDEX "motor_rule_evaluations_previousPolicyId_key" ON "public"."motor_rule_evaluations"("previousPolicyId");

-- CreateIndex
CREATE UNIQUE INDEX "motor_inspections_inspectionCode_key" ON "public"."motor_inspections"("inspectionCode");

-- CreateIndex
CREATE UNIQUE INDEX "motor_inspections_quotationId_key" ON "public"."motor_inspections"("quotationId");

-- CreateIndex
CREATE INDEX "motor_inspections_quotationId_idx" ON "public"."motor_inspections"("quotationId");

-- CreateIndex
CREATE INDEX "motor_inspections_status_idx" ON "public"."motor_inspections"("status");

-- CreateIndex
CREATE UNIQUE INDEX "motor_payment_records_quotationId_key" ON "public"."motor_payment_records"("quotationId");

-- CreateIndex
CREATE INDEX "motor_payment_records_quotationId_idx" ON "public"."motor_payment_records"("quotationId");

-- CreateIndex
CREATE INDEX "motor_payment_records_status_idx" ON "public"."motor_payment_records"("status");

-- AddForeignKey
ALTER TABLE "public"."motor_previous_policies" ADD CONSTRAINT "motor_previous_policies_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "public"."quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."motor_rule_evaluations" ADD CONSTRAINT "motor_rule_evaluations_previousPolicyId_fkey" FOREIGN KEY ("previousPolicyId") REFERENCES "public"."motor_previous_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."motor_inspections" ADD CONSTRAINT "motor_inspections_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "public"."quotations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."motor_payment_records" ADD CONSTRAINT "motor_payment_records_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "public"."quotations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
