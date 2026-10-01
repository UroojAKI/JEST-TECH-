-- Health Insurance CRM (Health_Insurance_CRM_Forms)
-- Adds HealthQuotationCase, HealthInsuredMember, HealthQuotationDocument
-- and Health link columns on quotations. Additive only.

-- CreateEnum
CREATE TYPE "public"."HealthPlanCategory" AS ENUM ('INDIVIDUAL', 'FAMILY_FLOATER', 'SENIOR_CITIZEN', 'CRITICAL_ILLNESS', 'TOP_UP', 'GROUP_CORPORATE', 'PERSONAL_ACCIDENT', 'MISCELLANEOUS');

-- CreateEnum
CREATE TYPE "public"."HealthPolicyForm" AS ENUM ('NEW_POLICY', 'RENEWAL_PORTABILITY', 'RIDERS_ADDON');

-- CreateEnum
CREATE TYPE "public"."HealthCaseStatus" AS ENUM ('OPEN', 'QUOTED', 'SELECTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."InsuredRelation" AS ENUM ('SELF', 'SPOUSE', 'CHILD', 'PARENT', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."NomineeRelation" AS ENUM ('SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."ProposerOccupation" AS ENUM ('SALARIED', 'SELF_EMPLOYED', 'BUSINESS', 'PROFESSIONAL', 'HOMEMAKER', 'STUDENT', 'RETIRED');

-- CreateEnum
CREATE TYPE "public"."HealthDocumentType" AS ENUM ('PROPOSAL_FORM', 'KYC_DOCUMENTS', 'AGE_PROOF', 'MEDICAL_TEST_REPORTS', 'PREVIOUS_POLICY', 'PORTABILITY_FORM', 'GOOD_HEALTH_DECLARATION', 'RELATIONSHIP_PROOF', 'DETAILED_MEDICAL_REPORTS', 'ILLNESS_MEDICATION_DECLARATION', 'BASE_POLICY_COPY', 'BASE_POLICY_CLAIMS_HISTORY', 'MASTER_POLICY_RULES', 'EMPLOYEE_CENSUS', 'HR_AUTHORIZATION', 'OCCUPATION_PROOF', 'INCOME_PROOF', 'TRAVEL_ITINERARY', 'QUOTE_DOCUMENT', 'OTHER');

-- AlterTable
ALTER TABLE "public"."quotations" ADD COLUMN     "healthCaseId" TEXT,
ADD COLUMN     "healthMetadata" JSONB,
ADD COLUMN     "healthPlanCategory" "public"."HealthPlanCategory";

-- CreateTable
CREATE TABLE "public"."health_quotation_cases" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "caseCode" TEXT NOT NULL,
    "planCategory" "public"."HealthPlanCategory" NOT NULL,
    "policyForm" "public"."HealthPolicyForm" NOT NULL DEFAULT 'NEW_POLICY',
    "status" "public"."HealthCaseStatus" NOT NULL DEFAULT 'OPEN',
    "contactId" TEXT NOT NULL,
    "leadId" TEXT,
    "selectedQuoteId" TEXT,
    "occupation" "public"."ProposerOccupation",
    "annualIncome" DECIMAL(14,2),
    "addressSnapshot" JSONB,
    "nomineeName" TEXT,
    "nomineeRelation" "public"."NomineeRelation",
    "planDetails" JSONB,
    "previousPolicySnapshot" JSONB,
    "customerSnapshot" JSONB NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "health_quotation_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."health_insured_members" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "familyMemberId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "relation" "public"."InsuredRelation" NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "gender" "public"."Gender" NOT NULL,
    "heightCm" DECIMAL(5,1),
    "weightKg" DECIMAL(5,1),
    "preExistingDiseases" TEXT,
    "isSmoker" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "health_insured_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."health_quotation_documents" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "caseId" TEXT,
    "quotationId" TEXT,
    "documentId" TEXT NOT NULL,
    "documentType" "public"."HealthDocumentType" NOT NULL,
    "verificationStatus" "public"."DocumentVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "health_quotation_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "health_quotation_cases_caseCode_key" ON "public"."health_quotation_cases"("caseCode");

-- CreateIndex
CREATE INDEX "health_quotation_cases_companyId_idx" ON "public"."health_quotation_cases"("companyId");

-- CreateIndex
CREATE INDEX "health_quotation_cases_contactId_idx" ON "public"."health_quotation_cases"("contactId");

-- CreateIndex
CREATE INDEX "health_quotation_cases_leadId_idx" ON "public"."health_quotation_cases"("leadId");

-- CreateIndex
CREATE INDEX "health_quotation_cases_selectedQuoteId_idx" ON "public"."health_quotation_cases"("selectedQuoteId");

-- CreateIndex
CREATE INDEX "health_quotation_cases_planCategory_idx" ON "public"."health_quotation_cases"("planCategory");

-- CreateIndex
CREATE INDEX "health_quotation_cases_deletedAt_idx" ON "public"."health_quotation_cases"("deletedAt");

-- CreateIndex
CREATE INDEX "health_insured_members_caseId_idx" ON "public"."health_insured_members"("caseId");

-- CreateIndex
CREATE INDEX "health_insured_members_familyMemberId_idx" ON "public"."health_insured_members"("familyMemberId");

-- CreateIndex
CREATE INDEX "health_quotation_documents_companyId_idx" ON "public"."health_quotation_documents"("companyId");

-- CreateIndex
CREATE INDEX "health_quotation_documents_caseId_idx" ON "public"."health_quotation_documents"("caseId");

-- CreateIndex
CREATE INDEX "health_quotation_documents_quotationId_idx" ON "public"."health_quotation_documents"("quotationId");

-- CreateIndex
CREATE INDEX "health_quotation_documents_documentId_idx" ON "public"."health_quotation_documents"("documentId");

-- CreateIndex
CREATE INDEX "quotations_healthCaseId_idx" ON "public"."quotations"("healthCaseId");

-- AddForeignKey
ALTER TABLE "public"."quotations" ADD CONSTRAINT "quotations_healthCaseId_fkey" FOREIGN KEY ("healthCaseId") REFERENCES "public"."health_quotation_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."health_quotation_cases" ADD CONSTRAINT "health_quotation_cases_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."health_quotation_cases" ADD CONSTRAINT "health_quotation_cases_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."health_quotation_cases" ADD CONSTRAINT "health_quotation_cases_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."health_quotation_cases" ADD CONSTRAINT "health_quotation_cases_selectedQuoteId_fkey" FOREIGN KEY ("selectedQuoteId") REFERENCES "public"."quotations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."health_insured_members" ADD CONSTRAINT "health_insured_members_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "public"."health_quotation_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."health_insured_members" ADD CONSTRAINT "health_insured_members_familyMemberId_fkey" FOREIGN KEY ("familyMemberId") REFERENCES "public"."FamilyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."health_quotation_documents" ADD CONSTRAINT "health_quotation_documents_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."health_quotation_documents" ADD CONSTRAINT "health_quotation_documents_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "public"."health_quotation_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."health_quotation_documents" ADD CONSTRAINT "health_quotation_documents_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "public"."quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."health_quotation_documents" ADD CONSTRAINT "health_quotation_documents_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "public"."documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
