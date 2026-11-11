# Motor Historical Data Reconciliation — Read Only

## Objective

Determine why the deployed Sales quotation workspace and Policy Issuance workspace show different record counts, and identify historical records that are present in legacy storage but absent from canonical views.

This phase is strictly read-only. It must not import, update, delete, deduplicate, or backfill production records.

## What the current source code establishes

- Sales Motor quotations are fetched through the canonical `GET /quotations?productType=MOTOR` endpoint with pagination and tenant scoping.
- Back Office issuance queue membership is intentionally narrower: the quotation must have `backOfficeSubmittedAt IS NOT NULL`. It is not an archive of every Sales quotation or issued policy.
- The canonical Policy register reads `policies`; it does not automatically union legacy `motor_quotations`.
- The schema includes `motor_quotation_migrations`, mapping legacy `MotorQuotation` IDs to canonical `Quotation` IDs.
- The earlier migration service has a mutating mode and must NOT be used for this investigation. Do not run `MotorQuotationMigrationService.executeMigration(false)`, `deduplicateMotorPolicies(false)`, or any backfill command.

## Read-only script

File: `apps/api/prisma/scripts/reconcile-motor-policy-history.readonly.js`

Run from `apps/api` using a database account with SELECT-only permissions:

```bash
DATABASE_URL='<read-only PostgreSQL connection string>' \
  node prisma/scripts/reconcile-motor-policy-history.readonly.js \
  > motor-history-reconciliation.json
```

The script starts a PostgreSQL `READ ONLY` transaction, applies statement and lock timeouts, reads table/column metadata, and prints aggregate counts only. It does not output customer names, phone numbers, email addresses, registration plates, PAN, policy numbers, or other direct personal identifiers.

Expected report sections:
- Table existence and total / soft-deleted / active counts.
- Aggregate counts by company, product type and status.
- Legacy MotorQuotation-to-Quotation migration mapping coverage.
- Canonical Policy-to-Quotation linkage and broken-link counts.
- Legacy MotorQuotation-to-Policy linkage and missing-policy counts.

The script intentionally does not use the mutating migration service.

## Production access boundary

The GitHub connection provides repository access, not a connection to the deployed PostgreSQL database. No production database URL, credentials, VPN or bastion session were provided in this task. Therefore no live production query has been run and no real production counts are claimed.

Before running:
1. Provision a temporary read-only PostgreSQL role or use an approved read replica.
2. Confirm the connection points to the intended production database or a consistent read replica.
3. Capture the database identity in the output and preserve the report as an audit artifact.
4. Have the DBA verify the role cannot INSERT, UPDATE, DELETE, TRUNCATE, CREATE, ALTER, DROP or execute mutating stored procedures.

## Interpretation matrix

| Observation | Likely explanation | Next investigation |
|---|---|---|
| Legacy MotorQuotation count > migration map count | Legacy records were not mapped | Inspect unmapped IDs and reasons; do not auto-map |
| Mapping exists but canonical Quotation missing | Broken/incomplete migration | Verify FK/migration history and backups |
| Canonical quotation exists but not in Sales | Tenant scope, soft-delete, product/status filter, pagination or UI issue | Compare endpoint query and authenticated tenant |
| Sales quote exists but not in Back Office queue | No explicit selected-quote handoff or queue gate/status issue | Inspect `backOfficeSubmittedAt`, selected case quote and gate state |
| Policy exists but no linked Quotation | Historical policy imported without canonical quote link | Reconcile source identifiers and policy lineage |
| Policy register count lower than old baseline | Legacy data still in MotorQuotation or soft-deleted/out-of-scope | Compare by tenant/status/deletedAt and migration records |
| Counts differ by tenant | Tenant remapping or historical ownership differences | Review approved tenant mapping; never reassign by guess |

## Required evidence before any repair

- Read-only report from production/read replica.
- Per-tenant source-to-target counts.
- Unmapped legacy IDs and duplicate candidates, without exposing PII in the report.
- Soft-deleted counts and retention policy.
- Canonical quotation and policy linkage gaps.
- Backup verification and rollback plan.
- Explicit business approval for any future backfill.

Only after the reconciliation report is reviewed should a separate, dry-run-first migration plan be prepared. Never use a blanket import or deduplication routine to make dashboard counts match.
