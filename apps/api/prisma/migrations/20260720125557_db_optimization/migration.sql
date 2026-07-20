-- CreateEnum
CREATE TYPE "public"."ProposalStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'DOCUMENT_PENDING', 'APPROVED', 'REJECTED', 'POLICY_ISSUED');

-- CreateEnum
CREATE TYPE "public"."EndorsementType" AS ENUM ('ADDRESS_CHANGE', 'OWNER_TRANSFER', 'NOMINEE_CHANGE');

-- CreateEnum
CREATE TYPE "public"."EndorsementStatus" AS ENUM ('REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "public"."ReportRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."KpiUnit" AS ENUM ('PERCENTAGE', 'CURRENCY', 'COUNT', 'RATIO', 'DAYS');

-- CreateEnum
CREATE TYPE "public"."ReportCategory" AS ENUM ('SALES', 'UNDERWRITING', 'CLAIMS', 'POLICY', 'CRM', 'FINANCE', 'AUDIT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "public"."ReportModule" AS ENUM ('LEADS', 'CONTACTS', 'QUOTATIONS', 'POLICIES', 'CLAIMS', 'REPORTS');

-- CreateEnum
CREATE TYPE "public"."ReportType" AS ENUM ('TABULAR', 'SUMMARY', 'CHART', 'MATRIX');

-- CreateEnum
CREATE TYPE "public"."ReportStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "public"."ReportFilterOperator" AS ENUM ('EQUALS', 'CONTAINS', 'STARTS_WITH', 'ENDS_WITH', 'BETWEEN', 'GREATER_THAN', 'LESS_THAN', 'IN', 'NOT_IN', 'NULL', 'NOT_NULL');

-- CreateEnum
CREATE TYPE "public"."ReportExecutionStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."ReportScheduleFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "public"."WorkflowModule" AS ENUM ('LEADS', 'PROPOSALS', 'ENDORSEMENTS', 'POLICIES', 'CLAIMS', 'QUOTATIONS');

-- CreateEnum
CREATE TYPE "public"."WorkflowEntityType" AS ENUM ('LEAD', 'PROPOSAL', 'POLICY', 'ENDORSEMENT', 'CLAIM', 'QUOTATION');

-- CreateEnum
CREATE TYPE "public"."WorkflowApprovalType" AS ENUM ('ANY', 'ALL', 'SEQUENTIAL');

-- AlterEnum
ALTER TYPE "public"."PermissionCategory" ADD VALUE 'WORKFLOW';

-- AlterTable
ALTER TABLE "public"."audit_logs" ADD COLUMN     "correlationId" TEXT,
ADD COLUMN     "module" TEXT;

-- AlterTable
ALTER TABLE "public"."claims" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "public"."leads" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "public"."policies" ADD COLUMN     "proposalId" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "public"."quotations" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "public"."proposals" (
    "id" TEXT NOT NULL,
    "proposalNumber" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "status" "public"."ProposalStatus" NOT NULL DEFAULT 'DRAFT',
    "remarks" TEXT,
    "submittedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "approvedById" TEXT,
    "rejectedReason" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."proposal_documents" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "documentId" TEXT,
    "mandatory" BOOLEAN NOT NULL DEFAULT true,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "remarks" TEXT,

    CONSTRAINT "proposal_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."proposal_histories" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "status" "public"."ProposalStatus" NOT NULL,
    "comments" TEXT,
    "performedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."endorsements" (
    "id" TEXT NOT NULL,
    "endorsementNumber" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "type" "public"."EndorsementType" NOT NULL,
    "status" "public"."EndorsementStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "reason" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "endorsements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."endorsement_documents" (
    "id" TEXT NOT NULL,
    "endorsementId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,

    CONSTRAINT "endorsement_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."endorsement_histories" (
    "id" TEXT NOT NULL,
    "endorsementId" TEXT NOT NULL,
    "status" "public"."EndorsementStatus" NOT NULL,
    "comments" TEXT,
    "performedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "endorsement_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."saved_reports" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "public"."ReportCategory" NOT NULL,
    "dataSource" TEXT NOT NULL,
    "columns" JSONB NOT NULL,
    "filters" JSONB NOT NULL,
    "sortBy" TEXT,
    "sortDir" TEXT DEFAULT 'asc',
    "isBuiltIn" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."report_runs" (
    "id" TEXT NOT NULL,
    "savedReportId" TEXT NOT NULL,
    "status" "public"."ReportRunStatus" NOT NULL DEFAULT 'PENDING',
    "rowCount" INTEGER,
    "exportPath" TEXT,
    "errorMessage" TEXT,
    "appliedFilters" JSONB,
    "triggeredById" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."kpi_definitions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "formula" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "unit" "public"."KpiUnit" NOT NULL DEFAULT 'COUNT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kpi_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."reports" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "category" "public"."ReportCategory" NOT NULL,
    "module" "public"."ReportModule" NOT NULL,
    "type" "public"."ReportType" NOT NULL DEFAULT 'TABULAR',
    "status" "public"."ReportStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "shared" BOOLEAN NOT NULL DEFAULT false,
    "parentId" TEXT,
    "executionCount" INTEGER NOT NULL DEFAULT 0,
    "lastExecutedAt" TIMESTAMP(3),
    "averageDuration" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."report_columns" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sortable" BOOLEAN NOT NULL DEFAULT true,
    "filterable" BOOLEAN NOT NULL DEFAULT true,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "configuration" JSONB,

    CONSTRAINT "report_columns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."report_filters" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "operator" "public"."ReportFilterOperator" NOT NULL,
    "defaultValue" JSONB,
    "required" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "report_filters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."report_executions" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "requestedById" TEXT,
    "status" "public"."ReportExecutionStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "filePath" TEXT,
    "recordCount" INTEGER NOT NULL DEFAULT 0,
    "parameters" JSONB,

    CONSTRAINT "report_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."report_schedules" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "cronExpression" TEXT NOT NULL,
    "frequency" "public"."ReportScheduleFrequency" NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "nextRun" TIMESTAMP(3),

    CONSTRAINT "report_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."saved_report_filters" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_report_filters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."favorite_reports" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorite_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workflows" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "module" "public"."WorkflowModule" NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workflow_states" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isInitial" BOOLEAN NOT NULL DEFAULT false,
    "isTerminal" BOOLEAN NOT NULL DEFAULT false,
    "slaMinutes" INTEGER,
    "escalationRoleId" TEXT,

    CONSTRAINT "workflow_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workflow_transitions" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "fromStateId" TEXT,
    "toStateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL DEFAULT 'MANUAL',
    "conditions" JSONB,

    CONSTRAINT "workflow_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workflow_actions" (
    "id" TEXT NOT NULL,
    "stateId" TEXT,
    "transitionId" TEXT,
    "type" TEXT NOT NULL,
    "configuration" JSONB,

    CONSTRAINT "workflow_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workflow_assignments" (
    "id" TEXT NOT NULL,
    "stateId" TEXT,
    "transitionId" TEXT,
    "roleId" TEXT,
    "userId" TEXT,
    "departmentId" TEXT,
    "branchId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "approvalType" "public"."WorkflowApprovalType" NOT NULL DEFAULT 'ANY',

    CONSTRAINT "workflow_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workflow_histories" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "workflowVersion" INTEGER NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityType" "public"."WorkflowEntityType" NOT NULL,
    "fromStateId" TEXT,
    "toStateId" TEXT NOT NULL,
    "performedById" TEXT,
    "comments" TEXT,
    "duration" INTEGER,
    "result" JSONB,
    "variables" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "proposals_proposalNumber_key" ON "public"."proposals"("proposalNumber");

-- CreateIndex
CREATE UNIQUE INDEX "proposals_quotationId_key" ON "public"."proposals"("quotationId");

-- CreateIndex
CREATE INDEX "proposals_quotationId_idx" ON "public"."proposals"("quotationId");

-- CreateIndex
CREATE INDEX "proposals_contactId_idx" ON "public"."proposals"("contactId");

-- CreateIndex
CREATE INDEX "proposals_submittedById_idx" ON "public"."proposals"("submittedById");

-- CreateIndex
CREATE INDEX "proposal_documents_proposalId_idx" ON "public"."proposal_documents"("proposalId");

-- CreateIndex
CREATE INDEX "proposal_histories_proposalId_idx" ON "public"."proposal_histories"("proposalId");

-- CreateIndex
CREATE INDEX "proposal_histories_performedById_idx" ON "public"."proposal_histories"("performedById");

-- CreateIndex
CREATE UNIQUE INDEX "endorsements_endorsementNumber_key" ON "public"."endorsements"("endorsementNumber");

-- CreateIndex
CREATE INDEX "endorsements_policyId_idx" ON "public"."endorsements"("policyId");

-- CreateIndex
CREATE INDEX "endorsements_requestedById_idx" ON "public"."endorsements"("requestedById");

-- CreateIndex
CREATE INDEX "endorsement_documents_endorsementId_idx" ON "public"."endorsement_documents"("endorsementId");

-- CreateIndex
CREATE INDEX "endorsement_documents_documentId_idx" ON "public"."endorsement_documents"("documentId");

-- CreateIndex
CREATE INDEX "endorsement_histories_endorsementId_idx" ON "public"."endorsement_histories"("endorsementId");

-- CreateIndex
CREATE INDEX "endorsement_histories_performedById_idx" ON "public"."endorsement_histories"("performedById");

-- CreateIndex
CREATE INDEX "saved_reports_createdById_idx" ON "public"."saved_reports"("createdById");

-- CreateIndex
CREATE INDEX "saved_reports_category_idx" ON "public"."saved_reports"("category");

-- CreateIndex
CREATE INDEX "report_runs_savedReportId_idx" ON "public"."report_runs"("savedReportId");

-- CreateIndex
CREATE INDEX "report_runs_status_idx" ON "public"."report_runs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "kpi_definitions_key_key" ON "public"."kpi_definitions"("key");

-- CreateIndex
CREATE INDEX "kpi_definitions_category_idx" ON "public"."kpi_definitions"("category");

-- CreateIndex
CREATE UNIQUE INDEX "reports_code_key" ON "public"."reports"("code");

-- CreateIndex
CREATE UNIQUE INDEX "saved_report_filters_userId_name_reportId_key" ON "public"."saved_report_filters"("userId", "name", "reportId");

-- CreateIndex
CREATE UNIQUE INDEX "favorite_reports_userId_reportId_key" ON "public"."favorite_reports"("userId", "reportId");

-- CreateIndex
CREATE UNIQUE INDEX "workflows_code_key" ON "public"."workflows"("code");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_states_workflowId_code_key" ON "public"."workflow_states"("workflowId", "code");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_idx" ON "public"."audit_logs"("entity", "entityId");

-- CreateIndex
CREATE INDEX "claims_contactId_idx" ON "public"."claims"("contactId");

-- CreateIndex
CREATE INDEX "claims_incidentDate_idx" ON "public"."claims"("incidentDate");

-- CreateIndex
CREATE INDEX "claims_accountId_idx" ON "public"."claims"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_documentId_version_key" ON "public"."document_versions"("documentId", "version");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "public"."notifications"("userId", "isRead");

-- CreateIndex
CREATE UNIQUE INDEX "policies_proposalId_key" ON "public"."policies"("proposalId");

-- CreateIndex
CREATE INDEX "policies_contactId_idx" ON "public"."policies"("contactId");

-- CreateIndex
CREATE INDEX "policies_expiryDate_idx" ON "public"."policies"("expiryDate");

-- CreateIndex
CREATE INDEX "policies_accountId_idx" ON "public"."policies"("accountId");

-- CreateIndex
CREATE INDEX "policies_deletedAt_idx" ON "public"."policies"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "policy_renewals_policyId_renewalNumber_key" ON "public"."policy_renewals"("policyId", "renewalNumber");

-- CreateIndex
CREATE INDEX "rating_rules_productId_insurerId_isActive_idx" ON "public"."rating_rules"("productId", "insurerId", "isActive");

-- CreateIndex
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "public"."refresh_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "renewal_tasks_status_idx" ON "public"."renewal_tasks"("status");

-- CreateIndex
CREATE INDEX "renewal_tasks_dueDate_idx" ON "public"."renewal_tasks"("dueDate");

-- CreateIndex
CREATE INDEX "renewal_tasks_agentId_status_idx" ON "public"."renewal_tasks"("agentId", "status");

-- AddForeignKey
ALTER TABLE "public"."policies" ADD CONSTRAINT "policies_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "public"."proposals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."proposals" ADD CONSTRAINT "proposals_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "public"."quotations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."proposals" ADD CONSTRAINT "proposals_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."proposals" ADD CONSTRAINT "proposals_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."proposals" ADD CONSTRAINT "proposals_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."proposals" ADD CONSTRAINT "proposals_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."proposal_documents" ADD CONSTRAINT "proposal_documents_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "public"."proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."proposal_documents" ADD CONSTRAINT "proposal_documents_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "public"."documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."proposal_histories" ADD CONSTRAINT "proposal_histories_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "public"."proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."proposal_histories" ADD CONSTRAINT "proposal_histories_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."endorsements" ADD CONSTRAINT "endorsements_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "public"."policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."endorsements" ADD CONSTRAINT "endorsements_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."endorsements" ADD CONSTRAINT "endorsements_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."endorsement_documents" ADD CONSTRAINT "endorsement_documents_endorsementId_fkey" FOREIGN KEY ("endorsementId") REFERENCES "public"."endorsements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."endorsement_documents" ADD CONSTRAINT "endorsement_documents_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "public"."documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."endorsement_histories" ADD CONSTRAINT "endorsement_histories_endorsementId_fkey" FOREIGN KEY ("endorsementId") REFERENCES "public"."endorsements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."endorsement_histories" ADD CONSTRAINT "endorsement_histories_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."saved_reports" ADD CONSTRAINT "saved_reports_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."report_runs" ADD CONSTRAINT "report_runs_savedReportId_fkey" FOREIGN KEY ("savedReportId") REFERENCES "public"."saved_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."report_runs" ADD CONSTRAINT "report_runs_triggeredById_fkey" FOREIGN KEY ("triggeredById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."kpi_definitions" ADD CONSTRAINT "kpi_definitions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reports" ADD CONSTRAINT "reports_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reports" ADD CONSTRAINT "reports_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reports" ADD CONSTRAINT "reports_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."report_columns" ADD CONSTRAINT "report_columns_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "public"."reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."report_filters" ADD CONSTRAINT "report_filters_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "public"."reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."report_executions" ADD CONSTRAINT "report_executions_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "public"."reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."report_executions" ADD CONSTRAINT "report_executions_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."report_schedules" ADD CONSTRAINT "report_schedules_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "public"."reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."saved_report_filters" ADD CONSTRAINT "saved_report_filters_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "public"."reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."saved_report_filters" ADD CONSTRAINT "saved_report_filters_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."favorite_reports" ADD CONSTRAINT "favorite_reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."favorite_reports" ADD CONSTRAINT "favorite_reports_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "public"."reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workflow_states" ADD CONSTRAINT "workflow_states_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "public"."workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workflow_transitions" ADD CONSTRAINT "workflow_transitions_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "public"."workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workflow_transitions" ADD CONSTRAINT "workflow_transitions_fromStateId_fkey" FOREIGN KEY ("fromStateId") REFERENCES "public"."workflow_states"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workflow_transitions" ADD CONSTRAINT "workflow_transitions_toStateId_fkey" FOREIGN KEY ("toStateId") REFERENCES "public"."workflow_states"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workflow_actions" ADD CONSTRAINT "workflow_actions_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "public"."workflow_states"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workflow_actions" ADD CONSTRAINT "workflow_actions_transitionId_fkey" FOREIGN KEY ("transitionId") REFERENCES "public"."workflow_transitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workflow_assignments" ADD CONSTRAINT "workflow_assignments_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "public"."workflow_states"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workflow_assignments" ADD CONSTRAINT "workflow_assignments_transitionId_fkey" FOREIGN KEY ("transitionId") REFERENCES "public"."workflow_transitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workflow_assignments" ADD CONSTRAINT "workflow_assignments_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workflow_assignments" ADD CONSTRAINT "workflow_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workflow_histories" ADD CONSTRAINT "workflow_histories_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "public"."workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workflow_histories" ADD CONSTRAINT "workflow_histories_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Custom FTS GIN Indexes
CREATE INDEX "contacts_firstName_fts_idx" ON "public"."contacts" USING GIN (to_tsvector('english', "firstName"));
CREATE INDEX "contacts_lastName_fts_idx" ON "public"."contacts" USING GIN (to_tsvector('english', "lastName"));
CREATE INDEX "contacts_email_fts_idx" ON "public"."contacts" USING GIN (to_tsvector('english', coalesce("email", '')));
CREATE INDEX "accounts_name_fts_idx" ON "public"."accounts" USING GIN (to_tsvector('english', "name"));
CREATE INDEX "accounts_email_fts_idx" ON "public"."accounts" USING GIN (to_tsvector('english', coalesce("email", '')));
