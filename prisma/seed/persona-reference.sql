-- ============================================================
-- JEST POLICY CRM — UAT PERSONA SEED
-- Version: 1.0.0 | Status: PERMANENT REGRESSION DATASET
-- DO NOT modify persona credentials in CI.
-- DO NOT delete this seed in production migration scripts.
-- ============================================================
--
-- Organization: JEST Demo Agency
-- 25 UAT personas across all roles + 1 org + 2 branches + 5 teams
--
-- NOTE: This is a SQL reference. The actual seed is in prisma/seed/personas.ts

-- ORGANIZATION
-- id: org-jest-demo
-- name: JEST Demo Agency

-- BRANCHES
-- id: branch-bangalore | name: Bangalore HQ
-- id: branch-mumbai    | name: Mumbai Branch

-- TEAMS
-- id: team-alpha | branch: bangalore | dept: Sales
-- id: team-beta  | branch: bangalore | dept: Sales
-- id: team-fin   | branch: bangalore | dept: Finance
-- id: team-ops   | branch: bangalore | dept: Operations
-- id: team-renew | branch: bangalore | dept: Renewals

-- ============================================================
-- PERSONAS
-- ============================================================
-- All passwords: TestPass@123! (dev/test only)
-- ============================================================

-- Management
-- MD-01           | md@jest-demo.com         | MD
-- Branch Mgr BLR  | mgr.blr@jest-demo.com    | BRANCH_MANAGER (Bangalore)
-- Branch Mgr MUM  | mgr.mum@jest-demo.com    | BRANCH_MANAGER (Mumbai)

-- Sales
-- Sales Manager A  | sm.a@jest-demo.com       | SALES_MANAGER (team-alpha)
-- Sales Manager B  | sm.b@jest-demo.com       | SALES_MANAGER (team-beta)
-- Agent A1         | agent.a1@jest-demo.com   | SALES_AGENT   (team-alpha)
-- Agent A2         | agent.a2@jest-demo.com   | SALES_AGENT   (team-alpha)
-- Agent B1         | agent.b1@jest-demo.com   | SALES_AGENT   (team-beta)
-- Agent B2         | agent.b2@jest-demo.com   | SALES_AGENT   (team-beta)
-- POSP-01          | posp.01@jest-demo.com    | POSP_AGENT    (team-alpha)

-- Finance
-- Finance Manager  | fin.mgr@jest-demo.com    | FINANCE_MANAGER
-- Finance Exec 1   | fin.e1@jest-demo.com     | FINANCE_EXECUTIVE
-- Finance Exec 2   | fin.e2@jest-demo.com     | FINANCE_EXECUTIVE

-- Back Office / Operations
-- Ops Manager      | ops.mgr@jest-demo.com    | OPERATIONS_MANAGER
-- Issuance Exec 1  | iss.e1@jest-demo.com     | ISSUANCE_EXECUTIVE
-- Issuance Exec 2  | iss.e2@jest-demo.com     | ISSUANCE_EXECUTIVE

-- Renewals
-- Renewal Manager  | ren.mgr@jest-demo.com    | RENEWAL_MANAGER
-- Renewal Exec 1   | ren.e1@jest-demo.com     | RENEWAL_EXECUTIVE
-- Renewal Exec 2   | ren.e2@jest-demo.com     | RENEWAL_EXECUTIVE

-- Claims
-- Claims Manager   | clm.mgr@jest-demo.com    | CLAIMS_MANAGER
-- Claims Exec 1    | clm.e1@jest-demo.com     | CLAIMS_EXECUTIVE
-- Claims Exec 2    | clm.e2@jest-demo.com     | CLAIMS_EXECUTIVE

-- Compliance
-- Compliance Off   | compliance@jest-demo.com | COMPLIANCE_OFFICER

-- Admin
-- System Admin     | admin@jest-demo.com      | SUPER_ADMIN
