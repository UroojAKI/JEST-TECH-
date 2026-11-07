-- Agent.agentCode is retained as a nullable legacy field. New Agent profiles
-- use client-owned AgentExternalCode values as business identifiers.
ALTER TABLE "agents" ALTER COLUMN "agentCode" DROP NOT NULL;
