-- Production hardening: PostgreSQL sequences for safe concurrent code generation
-- Replaces count() + 1 pattern which has race conditions under concurrent load

CREATE SEQUENCE IF NOT EXISTS policy_number_seq START 1 INCREMENT 1;
CREATE SEQUENCE IF NOT EXISTS claim_number_seq START 1 INCREMENT 1;
CREATE SEQUENCE IF NOT EXISTS quotation_number_seq START 1 INCREMENT 1;
CREATE SEQUENCE IF NOT EXISTS contact_number_seq START 1 INCREMENT 1;
CREATE SEQUENCE IF NOT EXISTS account_number_seq START 1 INCREMENT 1;
CREATE SEQUENCE IF NOT EXISTS lead_number_seq START 1 INCREMENT 1;
CREATE SEQUENCE IF NOT EXISTS endorsement_number_seq START 1 INCREMENT 1;
CREATE SEQUENCE IF NOT EXISTS proposal_number_seq START 1 INCREMENT 1;
