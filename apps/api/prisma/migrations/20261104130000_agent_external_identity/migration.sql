CREATE TYPE "AgentExternalCodeStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "AgentIdentifierVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');
CREATE TYPE "AgentExternalCodeHistoryAction" AS ENUM ('CREATED', 'UPDATED', 'VERIFIED', 'REJECTED', 'DEACTIVATED', 'REACTIVATED');
CREATE TYPE "AgentAssignmentEntityType" AS ENUM ('CONTACT', 'CUSTOMER', 'LEAD');

CREATE TABLE "agent_external_codes" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "externalCode" TEXT NOT NULL,
    "normalizedCode" TEXT NOT NULL,
    "codeSystem" TEXT NOT NULL,
    "sourceName" TEXT,
    "status" "AgentExternalCodeStatus" NOT NULL DEFAULT 'ACTIVE',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "verificationStatus" "AgentIdentifierVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verificationNotes" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_external_codes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agent_external_code_history" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "externalCodeId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "action" "AgentExternalCodeHistoryAction" NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "reason" TEXT,
    "correlationId" TEXT,
    "changedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_external_code_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agent_assignment_history" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "entityType" "AgentAssignmentEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "previousAgentId" TEXT,
    "newAgentId" TEXT,
    "previousExternalCodeId" TEXT,
    "newExternalCodeId" TEXT,
    "changedById" TEXT NOT NULL,
    "reason" TEXT,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_assignment_history_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "contacts" ADD COLUMN "assignedAgentId" TEXT;
ALTER TABLE "contacts" ADD COLUMN "assignedExternalCodeId" TEXT;
ALTER TABLE "customers" ADD COLUMN "primaryAgentExternalCodeId" TEXT;
ALTER TABLE "quotations" ADD COLUMN "agentExternalCodeId" TEXT;
ALTER TABLE "policies" ADD COLUMN "agentExternalCodeId" TEXT;
ALTER TABLE "claims" ADD COLUMN "agentExternalCodeId" TEXT;
ALTER TABLE "health_quotation_cases" ADD COLUMN "agentExternalCodeId" TEXT;
ALTER TABLE "motor_quotations" ADD COLUMN "agentExternalCodeId" TEXT;
ALTER TABLE "leads" ADD COLUMN "agentExternalCodeId" TEXT;

CREATE UNIQUE INDEX "agent_external_codes_companyId_codeSystem_normalizedCode_key"
ON "agent_external_codes"("companyId", "codeSystem", "normalizedCode");

CREATE UNIQUE INDEX "agent_external_codes_one_active_primary_per_system"
ON "agent_external_codes"("companyId", "agentId", "codeSystem")
WHERE "isPrimary" = true AND "status" = 'ACTIVE';

CREATE INDEX "agent_external_codes_companyId_agentId_status_idx"
ON "agent_external_codes"("companyId", "agentId", "status");
CREATE INDEX "agent_external_codes_companyId_normalizedCode_idx"
ON "agent_external_codes"("companyId", "normalizedCode");
CREATE INDEX "agent_external_codes_agentId_codeSystem_verificationStatus_idx"
ON "agent_external_codes"("agentId", "codeSystem", "verificationStatus");

CREATE INDEX "agent_external_code_history_companyId_externalCodeId_createdAt_idx"
ON "agent_external_code_history"("companyId", "externalCodeId", "createdAt");
CREATE INDEX "agent_external_code_history_companyId_agentId_createdAt_idx"
ON "agent_external_code_history"("companyId", "agentId", "createdAt");
CREATE INDEX "agent_external_code_history_correlationId_idx"
ON "agent_external_code_history"("correlationId");

CREATE INDEX "agent_assignment_history_companyId_entityType_entityId_createdAt_idx"
ON "agent_assignment_history"("companyId", "entityType", "entityId", "createdAt");
CREATE INDEX "agent_assignment_history_companyId_previousAgentId_createdAt_idx"
ON "agent_assignment_history"("companyId", "previousAgentId", "createdAt");
CREATE INDEX "agent_assignment_history_companyId_newAgentId_createdAt_idx"
ON "agent_assignment_history"("companyId", "newAgentId", "createdAt");
CREATE INDEX "agent_assignment_history_correlationId_idx"
ON "agent_assignment_history"("correlationId");

CREATE INDEX "contacts_assignedAgentId_idx" ON "contacts"("assignedAgentId");
CREATE INDEX "contacts_assignedExternalCodeId_idx" ON "contacts"("assignedExternalCodeId");
CREATE INDEX "customers_primaryAgentExternalCodeId_idx" ON "customers"("primaryAgentExternalCodeId");
CREATE INDEX "quotations_agentExternalCodeId_idx" ON "quotations"("agentExternalCodeId");
CREATE INDEX "policies_agentExternalCodeId_idx" ON "policies"("agentExternalCodeId");
CREATE INDEX "claims_agentExternalCodeId_idx" ON "claims"("agentExternalCodeId");
CREATE INDEX "health_quotation_cases_agentExternalCodeId_idx" ON "health_quotation_cases"("agentExternalCodeId");
CREATE INDEX "motor_quotations_agentExternalCodeId_idx" ON "motor_quotations"("agentExternalCodeId");
CREATE INDEX "leads_agentExternalCodeId_idx" ON "leads"("agentExternalCodeId");

ALTER TABLE "agent_external_codes"
ADD CONSTRAINT "agent_external_codes_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agent_external_codes"
ADD CONSTRAINT "agent_external_codes_agentId_fkey"
FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agent_external_codes"
ADD CONSTRAINT "agent_external_codes_verifiedById_fkey"
FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agent_external_codes"
ADD CONSTRAINT "agent_external_codes_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agent_external_codes"
ADD CONSTRAINT "agent_external_codes_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "agent_external_code_history"
ADD CONSTRAINT "agent_external_code_history_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agent_external_code_history"
ADD CONSTRAINT "agent_external_code_history_externalCodeId_fkey"
FOREIGN KEY ("externalCodeId") REFERENCES "agent_external_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agent_external_code_history"
ADD CONSTRAINT "agent_external_code_history_agentId_fkey"
FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agent_external_code_history"
ADD CONSTRAINT "agent_external_code_history_changedById_fkey"
FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "agent_assignment_history"
ADD CONSTRAINT "agent_assignment_history_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agent_assignment_history"
ADD CONSTRAINT "agent_assignment_history_previousAgentId_fkey"
FOREIGN KEY ("previousAgentId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agent_assignment_history"
ADD CONSTRAINT "agent_assignment_history_newAgentId_fkey"
FOREIGN KEY ("newAgentId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agent_assignment_history"
ADD CONSTRAINT "agent_assignment_history_previousExternalCodeId_fkey"
FOREIGN KEY ("previousExternalCodeId") REFERENCES "agent_external_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agent_assignment_history"
ADD CONSTRAINT "agent_assignment_history_newExternalCodeId_fkey"
FOREIGN KEY ("newExternalCodeId") REFERENCES "agent_external_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agent_assignment_history"
ADD CONSTRAINT "agent_assignment_history_changedById_fkey"
FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "contacts"
ADD CONSTRAINT "contacts_assignedAgentId_fkey"
FOREIGN KEY ("assignedAgentId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contacts"
ADD CONSTRAINT "contacts_assignedExternalCodeId_fkey"
FOREIGN KEY ("assignedExternalCodeId") REFERENCES "agent_external_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "customers"
ADD CONSTRAINT "customers_primaryAgentExternalCodeId_fkey"
FOREIGN KEY ("primaryAgentExternalCodeId") REFERENCES "agent_external_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "quotations"
ADD CONSTRAINT "quotations_agentExternalCodeId_fkey"
FOREIGN KEY ("agentExternalCodeId") REFERENCES "agent_external_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "policies"
ADD CONSTRAINT "policies_agentExternalCodeId_fkey"
FOREIGN KEY ("agentExternalCodeId") REFERENCES "agent_external_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "claims"
ADD CONSTRAINT "claims_agentExternalCodeId_fkey"
FOREIGN KEY ("agentExternalCodeId") REFERENCES "agent_external_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "health_quotation_cases"
ADD CONSTRAINT "health_quotation_cases_agentExternalCodeId_fkey"
FOREIGN KEY ("agentExternalCodeId") REFERENCES "agent_external_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "motor_quotations"
ADD CONSTRAINT "motor_quotations_agentExternalCodeId_fkey"
FOREIGN KEY ("agentExternalCodeId") REFERENCES "agent_external_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "leads"
ADD CONSTRAINT "leads_agentExternalCodeId_fkey"
FOREIGN KEY ("agentExternalCodeId") REFERENCES "agent_external_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION prevent_agent_identity_history_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Agent identity history is append-only. UPDATE and DELETE operations are forbidden.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_agent_external_code_history_immutable
BEFORE UPDATE OR DELETE ON "agent_external_code_history"
FOR EACH ROW EXECUTE FUNCTION prevent_agent_identity_history_mutation();

CREATE TRIGGER trg_agent_assignment_history_immutable
BEFORE UPDATE OR DELETE ON "agent_assignment_history"
FOR EACH ROW EXECUTE FUNCTION prevent_agent_identity_history_mutation();
