-- Life Insurance CRM (Life_Insurance_CRM_Forms)
-- Adds LifeQuotationCase, LifeQuotationRider, LifeQuotationDocument
-- and Life link columns on quotations. Additive only.

-- CreateEnum
CREATE TYPE "public"."LifePlanCategory" AS ENUM ('TERM_INSURANCE', 'SAVINGS_PLANS', 'INVESTMENT_PLANS', 'RETIREMENT_PENSION', 'CHILD_FUTURE', 'WHOLE_LIFE', 'ANNUITY', 'GROUP_INSURANCE');

-- CreateEnum
CREATE TYPE "public"."LifePolicyType" AS ENUM ('INDIVIDUAL_PURE_RISK', 'JOINT_LIFE_ANNUITY', 'GROUP_LIFE');

-- CreateEnum
CREATE TYPE "public"."PremiumPaymentType" AS ENUM ('REGULAR_PAY', 'LIMITED_PAY', 'SINGLE_PAY');

-- CreateEnum
CREATE TYPE "public"."PremiumPaymentFrequency" AS ENUM ('ANNUAL', 'SEMI_ANNUAL', 'QUARTERLY', 'MONTHLY', 'SINGLE');

-- CreateEnum
CREATE TYPE "public"."LifePolicyForm" AS ENUM ('NEW_POLICY', 'RENEWAL', 'RIDERS_ADDON');

-- CreateEnum
CREATE TYPE "public"."LifeCaseStatus" AS ENUM ('DRAFT', 'PROPOSAL_CREATED', 'QUOTED', 'UNDERWRITING_REVIEW', 'MEDICAL_SCHEDULED', 'APPROVED', 'REJECTED', 'CONVERTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."ProposerRelation" AS ENUM ('SELF', 'SPOUSE', 'CHILD', 'PARENT', 'EMPLOYER', 'BUSINESS_PARTNER', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."AppointeeRelation" AS ENUM ('FATHER', 'MOTHER', 'LEGAL_GUARDIAN', 'GRANDPARENT', 'SPOUSE', 'SIBLING', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."SmokerStatus" AS ENUM ('SMOKER', 'NON_SMOKER', 'FORMER_SMOKER', 'OCCASIONAL_SMOKER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "public"."LifeRiderType" AS ENUM ('ACCIDENTAL_DEATH_BENEFIT', 'ACCIDENTAL_TOTAL_PERMANENT_DISABILITY', 'CRITICAL_ILLNESS_RIDER', 'WOP_CRITICAL_ILLNESS', 'WOP_DISABILITY', 'TERM_RIDER', 'HOSPITAL_CASH_RIDER', 'INCOME_BENEFIT_RIDER', 'CANCER_COVER_RIDER', 'COVID_COVER_RIDER', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."LifeDocumentType" AS ENUM ('PROPOSER_PAN', 'PROPOSER_AADHAAR', 'LIFE_ASSURED_AGE_PROOF', 'LIFE_ASSURED_PHOTO', 'INCOME_PROOF_ITR', 'SALARY_SLIPS_3M', 'BANK_STATEMENT_6M', 'MEDICAL_REPORT', 'INVESTMENT_RISK_PROFILE', 'GROUP_EMPLOYEE_LIST', 'PREVIOUS_POLICY_COPY', 'GUARDIAN_APPOINTEE_KYC', 'OTHER');

-- AlterTable
ALTER TABLE "public"."quotations" ADD COLUMN     "lifeCaseId" TEXT,
ADD COLUMN     "lifeMetadata" JSONB,
ADD COLUMN     "lifePlanCategory" "public"."LifePlanCategory",
ADD COLUMN     "lifePolicyType" "public"."LifePolicyType",
ADD COLUMN     "policyTermYears" INTEGER,
ADD COLUMN     "premiumFrequency" "public"."PremiumPaymentFrequency",
ADD COLUMN     "premiumPayingTermYears" INTEGER,
ADD COLUMN     "premiumPaymentType" "public"."PremiumPaymentType";

-- CreateTable
CREATE TABLE "public"."life_quotation_cases" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "caseCode" TEXT NOT NULL,
    "planCategory" "public"."LifePlanCategory" NOT NULL,
    "policyForm" "public"."LifePolicyForm" NOT NULL DEFAULT 'NEW_POLICY',
    "status" "public"."LifeCaseStatus" NOT NULL DEFAULT 'DRAFT',
    "contactId" TEXT NOT NULL,
    "agentId" TEXT,
    "agentExternalCodeId" TEXT,
    "leadId" TEXT,
    "selectedQuoteId" TEXT,
    "proposerOccupation" "public"."ProposerOccupation",
    "annualIncome" DECIMAL(14,2),
    "addressSnapshot" JSONB,
    "customerSnapshot" JSONB NOT NULL,
    "isLifeAssuredDifferent" BOOLEAN NOT NULL DEFAULT false,
    "proposerRelation" "public"."ProposerRelation" NOT NULL DEFAULT 'SELF',
    "lifeAssuredName" TEXT,
    "lifeAssuredDob" TIMESTAMP(3),
    "lifeAssuredGender" "public"."Gender",
    "smokerStatus" "public"."SmokerStatus" NOT NULL DEFAULT 'UNKNOWN',
    "heightCm" DECIMAL(5,1),
    "weightKg" DECIMAL(5,1),
    "bmi" DECIMAL(4,1),
    "occupationRiskCategory" TEXT,
    "hasPreExistingIllness" BOOLEAN NOT NULL DEFAULT false,
    "medicalHistoryDetails" TEXT,
    "secondaryLifeAssured" JSONB,
    "nomineeName" TEXT,
    "nomineeDob" TIMESTAMP(3),
    "nomineeRelation" "public"."NomineeRelation",
    "isNomineeMinor" BOOLEAN NOT NULL DEFAULT false,
    "appointeeName" TEXT,
    "appointeeDob" TIMESTAMP(3),
    "appointeeRelation" "public"."AppointeeRelation",
    "categoryData" JSONB,
    "previousPolicySnapshot" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "life_quotation_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."life_quotation_riders" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "riderType" "public"."LifeRiderType" NOT NULL,
    "riderName" TEXT NOT NULL,
    "sumAssured" DECIMAL(14,2) NOT NULL,
    "termYears" INTEGER,
    "pptYears" INTEGER,
    "basePremium" DECIMAL(12,2) NOT NULL,
    "gstRate" DECIMAL(5,2) NOT NULL DEFAULT 18.0,
    "gstAmount" DECIMAL(12,2) NOT NULL,
    "totalPremium" DECIMAL(12,2) NOT NULL,
    "brokeragePercent" DECIMAL(5,2) NOT NULL DEFAULT 0.0,
    "brokerageAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "calculationSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "life_quotation_riders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."life_quotation_documents" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "quotationId" TEXT,
    "documentId" TEXT NOT NULL,
    "documentType" "public"."LifeDocumentType" NOT NULL,
    "verificationStatus" "public"."DocumentVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "life_quotation_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "life_quotation_cases_caseCode_key" ON "public"."life_quotation_cases"("caseCode");

-- CreateIndex
CREATE INDEX "life_quotation_cases_companyId_idx" ON "public"."life_quotation_cases"("companyId");

-- CreateIndex
CREATE INDEX "life_quotation_cases_contactId_idx" ON "public"."life_quotation_cases"("contactId");

-- CreateIndex
CREATE INDEX "life_quotation_cases_companyId_agentId_idx" ON "public"."life_quotation_cases"("companyId", "agentId");

-- CreateIndex
CREATE INDEX "life_quotation_cases_agentExternalCodeId_idx" ON "public"."life_quotation_cases"("agentExternalCodeId");

-- CreateIndex
CREATE INDEX "life_quotation_cases_leadId_idx" ON "public"."life_quotation_cases"("leadId");

-- CreateIndex
CREATE INDEX "life_quotation_cases_selectedQuoteId_idx" ON "public"."life_quotation_cases"("selectedQuoteId");

-- CreateIndex
CREATE INDEX "life_quotation_cases_planCategory_idx" ON "public"."life_quotation_cases"("planCategory");

-- CreateIndex
CREATE INDEX "life_quotation_cases_status_idx" ON "public"."life_quotation_cases"("status");

-- CreateIndex
CREATE INDEX "life_quotation_cases_deletedAt_idx" ON "public"."life_quotation_cases"("deletedAt");

-- CreateIndex
CREATE INDEX "life_quotation_riders_quotationId_idx" ON "public"."life_quotation_riders"("quotationId");

-- CreateIndex
CREATE INDEX "life_quotation_riders_riderType_idx" ON "public"."life_quotation_riders"("riderType");

-- CreateIndex
CREATE INDEX "life_quotation_documents_companyId_idx" ON "public"."life_quotation_documents"("companyId");

-- CreateIndex
CREATE INDEX "life_quotation_documents_caseId_idx" ON "public"."life_quotation_documents"("caseId");

-- CreateIndex
CREATE INDEX "life_quotation_documents_quotationId_idx" ON "public"."life_quotation_documents"("quotationId");

-- CreateIndex
CREATE INDEX "life_quotation_documents_documentId_idx" ON "public"."life_quotation_documents"("documentId");

-- CreateIndex
CREATE INDEX "quotations_lifeCaseId_idx" ON "public"."quotations"("lifeCaseId");

-- AddForeignKey
ALTER TABLE "public"."quotations" ADD CONSTRAINT "quotations_lifeCaseId_fkey" FOREIGN KEY ("lifeCaseId") REFERENCES "public"."life_quotation_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."life_quotation_cases" ADD CONSTRAINT "life_quotation_cases_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."life_quotation_cases" ADD CONSTRAINT "life_quotation_cases_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."life_quotation_cases" ADD CONSTRAINT "life_quotation_cases_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "public"."agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."life_quotation_cases" ADD CONSTRAINT "life_quotation_cases_agentExternalCodeId_fkey" FOREIGN KEY ("agentExternalCodeId") REFERENCES "public"."agent_external_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."life_quotation_cases" ADD CONSTRAINT "life_quotation_cases_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."life_quotation_cases" ADD CONSTRAINT "life_quotation_cases_selectedQuoteId_fkey" FOREIGN KEY ("selectedQuoteId") REFERENCES "public"."quotations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."life_quotation_riders" ADD CONSTRAINT "life_quotation_riders_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "public"."quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."life_quotation_documents" ADD CONSTRAINT "life_quotation_documents_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."life_quotation_documents" ADD CONSTRAINT "life_quotation_documents_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "public"."life_quotation_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."life_quotation_documents" ADD CONSTRAINT "life_quotation_documents_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "public"."quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."life_quotation_documents" ADD CONSTRAINT "life_quotation_documents_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "public"."documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

