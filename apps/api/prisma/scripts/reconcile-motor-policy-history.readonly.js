#!/usr/bin/env node
'use strict';

/**
 * READ-ONLY production/staging reconciliation for Motor historical records.
 *
 * This script opens a PostgreSQL READ ONLY transaction and executes SELECTs only.
 * It never creates, updates, deletes, migrates, or backfills records.
 *
 * Run from apps/api:
 *   DATABASE_URL='<read-only database URL>' node prisma/scripts/reconcile-motor-policy-history.readonly.js
 */

const { PrismaClient } = require('@prisma/client');

const TABLES = [
  'policies',
  'quotations',
  'motor_quotations',
  'motor_quotation_migrations',
  'motor_quotation_cases',
  'motor_previous_policies',
];

const quoteIdentifier = (value) => '"' + String(value).replace(/"/g, '""') + "'";
const asNumber = (value) => Number(value || 0);

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required. Use a read-only database account.');
  }

  const prisma = new PrismaClient({
    log: [{ emit: 'event', level: 'error' }],
  });

  try {
    const report = await prisma.$transaction(async (tx) => {
      // Must be the first statement in the transaction. PostgreSQL enforces read-only.
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '20000'");
      await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '3000'");

      const dbInfoRows = await tx.$queryRawUnsafe(
        'SELECT current_database() AS database_name, current_user AS database_user, now() AS inspected_at',
      );
      const tableRows = await tx.$queryRawUnsafe(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name = ANY($1::text[])",
        TABLES,
      );
      const present = new Set(tableRows.map((row) => row.table_name));
      const result = {
        database: dbInfoRows[0]?.database_name,
        databaseUser: dbInfoRows[0]?.database_user,
        inspectedAt: dbInfoRows[0]?.inspected_at,
        transactionMode: 'READ ONLY',
        tables: {},
        reconciliation: {},
        warnings: [],
      };

      for (const table of TABLES) {
        if (!present.has(table)) {
          result.tables[table] = { present: false };
          continue;
        }

        const columnRows = await tx.$queryRawUnsafe(
          "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1",
          table,
        );
        const columns = new Set(columnRows.map((row) => row.column_name));
        const hasDeletedAt = columns.has('deletedAt');
        const countExpressions = ['COUNT(*)::bigint AS total'];
        if (hasDeletedAt) {
          countExpressions.push(
            'COUNT(*) FILTER (WHERE "deletedAt" IS NULL)::bigint AS active',
            'COUNT(*) FILTER (WHERE "deletedAt" IS NOT NULL)::bigint AS soft_deleted',
          );
        }

        const countRows = await tx.$queryRawUnsafe(
          'SELECT ' + countExpressions.join(', ') + ' FROM ' + quoteIdentifier(table),
        );

        const entry = {
          present: true,
          columns: Array.from(columns).sort(),
          counts: {
            total: asNumber(countRows[0]?.total),
            ...(hasDeletedAt
              ? {
                  active: asNumber(countRows[0]?.active),
                  softDeleted: asNumber(countRows[0]?.soft_deleted),
                }
              : {}),
          },
        };

        const groupColumns = ['companyId', 'productType', 'status'].filter((c) => columns.has(c));
        if (groupColumns.length) {
          const select = groupColumns.map(quoteIdentifier).join(', ');
          const grouped = await tx.$queryRawUnsafe(
            'SELECT ' + select + ', COUNT(*)::bigint AS records FROM ' +
              quoteIdentifier(table) + ' GROUP BY ' + select +
              ' ORDER BY records DESC LIMIT 100',
          );
          entry.groupedCounts = grouped.map((row) => {
            const safe = {};
            for (const key of groupColumns) safe[key] = row[key] ?? null;
            safe.records = asNumber(row.records);
            return safe;
          });
        }
        result.tables[table] = entry;
      }

      if (
        present.has('motor_quotations') &&
        present.has('motor_quotation_migrations') &&
        present.has('quotations')
      ) {
        const mapping = await tx.$queryRawUnsafe(`
          SELECT
            COUNT(*)::bigint AS mapping_rows,
            COUNT(*) FILTER (WHERE legacy.id IS NOT NULL)::bigint AS mappings_with_legacy_row,
            COUNT(*) FILTER (WHERE canonical.id IS NOT NULL)::bigint AS mappings_with_canonical_row,
            COUNT(*) FILTER (WHERE legacy.id IS NOT NULL AND canonical.id IS NULL)::bigint AS mappings_missing_canonical_row
          FROM motor_quotation_migrations map
          LEFT JOIN motor_quotations legacy ON legacy.id = map."oldMotorQuotationId"
          LEFT JOIN quotations canonical ON canonical.id = map."newQuotationId"
        `);
        const coverage = await tx.$queryRawUnsafe(`
          SELECT
            COUNT(*)::bigint AS legacy_total,
            COUNT(*) FILTER (WHERE map.id IS NOT NULL)::bigint AS legacy_with_mapping,
            COUNT(*) FILTER (WHERE map.id IS NULL)::bigint AS legacy_without_mapping
          FROM motor_quotations legacy
          LEFT JOIN motor_quotation_migrations map
            ON map."oldMotorQuotationId" = legacy.id
        `);
        result.reconciliation.legacyMigrationMap = {
          ...Object.fromEntries(Object.entries(mapping[0] || {}).map(([k, v]) => [k, asNumber(v)])),
          ...Object.fromEntries(Object.entries(coverage[0] || {}).map(([k, v]) => [k, asNumber(v)])),
        };
      } else {
        result.warnings.push('Legacy-to-canonical migration mapping could not be fully checked because one or more expected tables are absent.');
      }

      if (present.has('policies') && present.has('quotations')) {
        const policyLinks = await tx.$queryRawUnsafe(`
          SELECT
            COUNT(*)::bigint AS total_policies,
            COUNT(*) FILTER (WHERE p."quotationId" IS NULL)::bigint AS policies_without_quotation_link,
            COUNT(*) FILTER (WHERE p."quotationId" IS NOT NULL AND q.id IS NULL)::bigint AS policies_with_broken_quotation_link,
            COUNT(*) FILTER (WHERE q.id IS NOT NULL AND q."productType" = 'MOTOR')::bigint AS policies_linked_to_motor_quotation
          FROM policies p
          LEFT JOIN quotations q ON q.id = p."quotationId"
        `);
        result.reconciliation.canonicalPolicyLineage =
          Object.fromEntries(Object.entries(policyLinks[0] || {}).map(([k, v]) => [k, asNumber(v)]));
      }

      if (present.has('motor_quotations') && present.has('policies')) {
        const legacyPolicyLinks = await tx.$queryRawUnsafe(`
          SELECT
            COUNT(*)::bigint AS legacy_quotes_with_policy_id,
            COUNT(*) FILTER (WHERE p.id IS NOT NULL)::bigint AS legacy_quotes_linking_existing_policy,
            COUNT(*) FILTER (WHERE legacy."policyId" IS NOT NULL AND p.id IS NULL)::bigint AS legacy_quotes_with_missing_policy
          FROM motor_quotations legacy
          LEFT JOIN policies p ON p.id = legacy."policyId"
        `);
        result.reconciliation.legacyPolicyLineage =
          Object.fromEntries(Object.entries(legacyPolicyLinks[0] || {}).map(([k, v]) => [k, asNumber(v)]));
      }

      return result;
    }, { maxWait: 5000, timeout: 30000 });

    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  process.stderr.write('[READ-ONLY RECONCILIATION FAILED] ' + (error?.stack || error) + '\n');
  process.exitCode = 1;
});
