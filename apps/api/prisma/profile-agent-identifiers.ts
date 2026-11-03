import { PrismaClient } from '@prisma/client';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

type SourceValue = {
  companyId: string;
  value: string;
  source: 'Contact.agentCode' | 'MotorQuotation.agentCodeSnapshot';
  count: number;
};

const args = process.argv.slice(2);
const outputFlag = args.indexOf('--out');
const outputPath = outputFlag >= 0 ? args[outputFlag + 1] : undefined;

if (args.includes('--help')) {
  process.stdout.write(
    'Read-only identifier profile. Usage: pnpm --filter api exec tsx prisma/profile-agent-identifiers.ts [--out report.json]\n',
  );
  process.exit(0);
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const [contactGroups, motorGroups] = await Promise.all([
      prisma.contact.groupBy({
        by: ['companyId', 'agentCode'],
        where: { agentCode: { not: null } },
        _count: { _all: true },
      }),
      prisma.motorQuotation.groupBy({
        by: ['companyId', 'agentCodeSnapshot'],
        where: { agentCodeSnapshot: { not: null } },
        _count: { _all: true },
      }),
    ]);

    const values: SourceValue[] = [
      ...contactGroups
        .filter((row) => row.agentCode?.trim())
        .map((row) => ({
          companyId: row.companyId,
          value: row.agentCode!.trim(),
          source: 'Contact.agentCode' as const,
          count: row._count._all,
        })),
      ...motorGroups
        .filter((row) => row.agentCodeSnapshot?.trim())
        .map((row) => ({
          companyId: row.companyId,
          value: row.agentCodeSnapshot!.trim(),
          source: 'MotorQuotation.agentCodeSnapshot' as const,
          count: row._count._all,
        })),
    ];

    const grouped = new Map<string, {
      companyId: string;
      rawValue: string;
      occurrenceCount: number;
      sources: Record<string, number>;
    }>();
    for (const item of values) {
      const key = JSON.stringify([item.companyId, item.value]);
      const group = grouped.get(key) || {
        companyId: item.companyId,
        rawValue: item.value,
        occurrenceCount: 0,
        sources: {},
      };
      group.occurrenceCount += item.count;
      group.sources[item.source] = item.count;
      grouped.set(key, group);
    }

    const rows = [];
    for (const group of grouped.values()) {
      const [agentCodes, employeeCodes, users] = await Promise.all([
        prisma.agent.findMany({
          where: {
            companyId: group.companyId,
            agentCode: { equals: group.rawValue, mode: 'insensitive' },
          },
          select: { id: true, agentCode: true, isActive: true, deletedAt: true },
        }),
        prisma.user.findMany({
          where: {
            companyId: group.companyId,
            employeeCode: { equals: group.rawValue, mode: 'insensitive' },
          },
          select: {
            id: true,
            employeeCode: true,
            agentProfile: { select: { id: true, agentCode: true, isActive: true, deletedAt: true } },
          },
        }),
        prisma.user.findMany({
          where: { id: group.rawValue, companyId: group.companyId },
          select: {
            id: true,
            agentProfile: { select: { id: true, agentCode: true, isActive: true, deletedAt: true } },
          },
        }),
      ]);

      const candidateProfiles = [
        ...agentCodes.map((agent) => ({ matchType: 'AGENT_CODE', ...agent })),
        ...employeeCodes.map((user) => ({
          matchType: user.agentProfile ? 'EMPLOYEE_CODE' : 'EMPLOYEE_CODE_WITHOUT_AGENT_PROFILE',
          ...(user.agentProfile || { id: null, agentCode: null, isActive: false, deletedAt: null }),
          sourceUserId: user.id,
        })),
        ...users.map((user) => ({
          matchType: user.agentProfile ? 'USER_ID' : 'USER_ID_WITHOUT_AGENT_PROFILE',
          ...(user.agentProfile || { id: null, agentCode: null, isActive: false, deletedAt: null }),
          sourceUserId: user.id,
        })),
      ];
      const candidateAgentIds = [...new Set(
        candidateProfiles.map((candidate) => candidate.id).filter(Boolean),
      )];
      const hasProfilelessUserMatch = candidateProfiles.some((candidate) => !candidate.id);

      rows.push({
        ...group,
        candidateProfiles,
        candidateAgentIds,
        profilelessUserMatch: hasProfilelessUserMatch,
        classification:
          candidateAgentIds.length > 1
            ? 'AMBIGUOUS_INTERNAL_MATCH'
            : candidateAgentIds.length === 1 && !hasProfilelessUserMatch
              ? 'UNIQUE_INTERNAL_CANDIDATE_REQUIRES_REVIEW'
              : candidateAgentIds.length === 0 && hasProfilelessUserMatch
                ? 'USER_WITHOUT_AGENT_PROFILE'
                : 'UNRESOLVED_REQUIRES_CLIENT_MAPPING',
        automaticMapping: false,
      });
    }

    const report = {
      generatedAt: new Date().toISOString(),
      mode: 'READ_ONLY_DRY_RUN',
      sourceTables: ['contacts.agentCode', 'motor_quotations.agentCodeSnapshot'],
      totalDistinctCompanyValues: rows.length,
      totalOccurrences: rows.reduce((sum, row) => sum + row.occurrenceCount, 0),
      classifications: rows.reduce<Record<string, number>>((counts, row) => {
        counts[row.classification] = (counts[row.classification] || 0) + 1;
        return counts;
      }, {}),
      rows,
      note: 'Candidate matches are informational only. This command never writes or backfills Agent mappings.',
    };

    const json = `${JSON.stringify(report, null, 2)}\n`;
    if (outputPath) {
      const path = resolve(outputPath);
      await writeFile(path, json, { encoding: 'utf8', flag: 'wx' });
      process.stdout.write(`Read-only report written to ${path}\n`);
    } else {
      process.stdout.write(json);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  process.stderr.write(`Agent identifier profiling failed: ${error.message}\n`);
  process.exitCode = 1;
});
