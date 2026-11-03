ALTER TABLE "health_quotation_cases"
ADD COLUMN "agentId" TEXT;

CREATE INDEX "health_quotation_cases_companyId_agentId_idx"
ON "health_quotation_cases"("companyId", "agentId");

ALTER TABLE "health_quotation_cases"
ADD CONSTRAINT "health_quotation_cases_agentId_fkey"
FOREIGN KEY ("agentId") REFERENCES "agents"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill from the linked lead first, then the linked customer's current
-- primary agent, then the creator's Agent profile. Every match stays in-company.
UPDATE "health_quotation_cases" AS health_case
SET "agentId" = COALESCE(
  (
    SELECT lead."agentId"
    FROM "leads" AS lead
    JOIN "agents" AS lead_agent
      ON lead_agent."id" = lead."agentId"
     AND lead_agent."companyId" = health_case."companyId"
    WHERE lead."id" = health_case."leadId"
      AND lead."companyId" = health_case."companyId"
      AND lead."deletedAt" IS NULL
  ),
  (
    SELECT customer_agent."id"
    FROM "customers" AS customer
    JOIN "agents" AS customer_agent
      ON customer_agent."id" = customer."primaryAgentId"
     AND customer_agent."companyId" = health_case."companyId"
    WHERE customer."contactId" = health_case."contactId"
      AND customer."companyId" = health_case."companyId"
      AND customer."deletedAt" IS NULL
  ),
  (
    SELECT agent."id"
    FROM "agents" AS agent
    WHERE agent."userId" = health_case."createdById"
      AND agent."companyId" = health_case."companyId"
      AND agent."deletedAt" IS NULL
    LIMIT 1
  )
)
WHERE health_case."agentId" IS NULL;
