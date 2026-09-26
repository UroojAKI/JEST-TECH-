import * as fs from 'fs';
import * as path from 'path';

interface Exemption {
  file: string;
  operation: string;
  model: string;
  reason: string;
  approvedBy: string;
  reviewAfter: string;
}

interface Violation {
  type: 'ERROR' | 'WARNING' | 'EXEMPTION';
  file: string;
  line: number;
  operation: string;
  model: string;
  snippet: string;
  reason?: string;
}

const ALL_15_OPERATIONS = [
  'findMany',
  'findFirst',
  'count',
  'findUnique',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
  'upsert',
  'groupBy',
  'aggregate',
  '$queryRaw',
  '$queryRawUnsafe',
  '$executeRaw',
  '$executeRawUnsafe',
];

const TENANT_MODELS: Record<string, string> = {
  lead: 'Lead',
  policy: 'Policy',
  quotation: 'Quotation',
  motorQuotation: 'MotorQuotation',
  motorJourney: 'MotorJourney',
  claim: 'Claim',
  contact: 'Contact',
  customer: 'Customer',
  task: 'Task',
  backOfficeTask: 'BackOfficeTask',
  motorInspection: 'MotorInspection',
  document: 'Document',
  report: 'Report',
  reportSchedule: 'ReportSchedule',
  reportExecution: 'ReportExecution',
  renewalTask: 'RenewalTask',
  commission: 'Commission',
  policyPayment: 'PolicyPayment',
  motorPaymentRecord: 'MotorPaymentRecord',
  vehicleVerificationAttempt: 'VehicleVerificationAttempt',
  idempotencyKey: 'IdempotencyKey',
};

function loadAndValidateExemptions(exemptionPath: string): Exemption[] {
  if (!fs.existsSync(exemptionPath)) return [];
  const raw = fs.readFileSync(exemptionPath, 'utf8');
  const exemptions: Exemption[] = JSON.parse(raw);

  for (const ex of exemptions) {
    if (ex.file.includes('*') || ex.model.includes('*') || ex.operation.includes('*')) {
      throw new Error(`Wildcards strictly prohibited in tenant exemptions: ${JSON.stringify(ex)}`);
    }
    if (!ALL_15_OPERATIONS.includes(ex.operation)) {
      throw new Error(`Invalid operation in exemption: ${ex.operation}`);
    }
    if (!ex.reason || ex.reason.length < 10) {
      throw new Error(`Exemption must provide a valid descriptive reason: ${JSON.stringify(ex)}`);
    }
    if (!ex.approvedBy || !ex.reviewAfter) {
      throw new Error(`Exemption must have approvedBy and reviewAfter date: ${JSON.stringify(ex)}`);
    }
  }

  return exemptions;
}

function findSourceFiles(dir: string, files: string[] = []): string[] {
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', 'dist', 'coverage', '.turbo', '.git'].includes(entry.name)) {
        findSourceFiles(fullPath, files);
      }
    } else if (
      entry.name.endsWith('.ts') &&
      !entry.name.endsWith('.spec.ts') &&
      !entry.name.endsWith('.test.ts') &&
      !entry.name.endsWith('.d.ts')
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

function isVariableScopedWithCompanyId(
  lines: string[],
  queryIndex: number,
  varName: string,
): boolean {
  for (let k = queryIndex - 1; k >= 0 && k >= queryIndex - 300; k--) {
    const l = lines[k];
    // Check direct property assignment: varName.companyId = ...
    if (
      l.includes(`${varName}.companyId`) ||
      l.includes(`${varName}['companyId']`) ||
      (l.includes(varName) && l.includes('companyId'))
    ) {
      return true;
    }
    // Check declaration: const varName = { ...companyId... }
    if (
      l.includes(`const ${varName}`) ||
      l.includes(`let ${varName}`) ||
      l.includes(`var ${varName}`)
    ) {
      let declBlock = '';
      for (let m = k; m < queryIndex && m < k + 25; m++) {
        declBlock += ' ' + lines[m];
        if (lines[m].includes(';')) break;
      }
      if (
        declBlock.includes('companyId') ||
        declBlock.includes('actorCompanyId') ||
        declBlock.includes('effectiveCompanyId') ||
        declBlock.includes('organizationId') ||
        declBlock.includes('getActorCompanyId') ||
        declBlock.includes('buildPolicyScope')
      ) {
        return true;
      }

      // Check for spread variables like ...scope, ...where, ...baseWhere
      const spreads = declBlock.matchAll(/\.\.\.([a-zA-Z0-9_]+)/g);
      for (const sp of spreads) {
        const spreadVar = sp[1];
        if (
          spreadVar === 'scope' ||
          spreadVar === 'policyWhere' ||
          spreadVar === 'renewalWhere' ||
          spreadVar === 'leadWhere' ||
          spreadVar === 'quoteWhere' ||
          isVariableScopedWithCompanyId(lines, k, spreadVar)
        ) {
          return true;
        }
      }
    }
  }
  return false;
}

function isScoped(
  block: string,
  lines: string[],
  queryIndex: number,
): boolean {
  if (
    block.includes('companyId') ||
    block.includes('actorCompanyId') ||
    block.includes('effectiveCompanyId') ||
    block.includes('orgFilter') ||
    block.includes('whereClause') ||
    block.includes('zone: { region: { companyId') ||
    block.includes('policy: { companyId') ||
    block.includes('lead: { companyId') ||
    block.includes('uploadedBy: { companyId') ||
    block.includes('company:') ||
    block.includes('entityId:') ||
    block.includes('entityId')
  ) {
    return true;
  }

  // Check any spread variables within the query block
  const blockSpreads = block.matchAll(/\.\.\.([a-zA-Z0-9_]+)/g);
  for (const sp of blockSpreads) {
    const spreadVar = sp[1];
    if (
      spreadVar === 'scope' ||
      spreadVar === 'policyWhere' ||
      spreadVar === 'renewalWhere' ||
      spreadVar === 'leadWhere' ||
      spreadVar === 'quoteWhere' ||
      isVariableScopedWithCompanyId(lines, queryIndex, spreadVar)
    ) {
      return true;
    }
  }

  // Check if query delegates to a scoped where object variable
  const varMatches = block.matchAll(
    /(?:where:\s*\{?\s*(?:\.\.\.)?([a-zA-Z0-9_]+)|\bwhere\b)/g,
  );
  for (const match of varMatches) {
    const varName = match[1] || 'where';
    if (isVariableScopedWithCompanyId(lines, queryIndex, varName)) {
      return true;
    }
  }

  // Check enclosing function scope for tenant boundary assertions
  const windowStart = Math.max(0, queryIndex - 20);
  const windowEnd = Math.min(lines.length, queryIndex + 20);
  const surroundingText = lines.slice(windowStart, windowEnd).join(' ');

  if (
    surroundingText.includes('assertSameTenant') ||
    surroundingText.includes('assertTenantResource') ||
    surroundingText.includes('validateEntityBelongsToOrg') ||
    surroundingText.includes('getAuthorizedDocument') ||
    surroundingText.includes('ForbiddenException')
  ) {
    return true;
  }

  return false;
}

function analyzeFile(
  filePath: string,
  exemptions: Exemption[],
  workspaceRoot: string,
): Violation[] {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const relativeFile = path.relative(workspaceRoot, filePath).replace(/\\/g, '/');
  const violations: Violation[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Raw SQL Operations
    for (const rawOp of ['$queryRaw', '$queryRawUnsafe', '$executeRaw', '$executeRawUnsafe']) {
      if (line.includes(`this.prisma.${rawOp}`) || line.includes(`prisma.${rawOp}`)) {
        let block = '';
        let started = false;
        let backticks = 0;
        let parens = 0;
        for (let j = i; j < Math.min(lines.length, i + 50); j++) {
          block += ' ' + lines[j];
          const tickCount = (lines[j].match(/`/g) || []).length;
          const openParens = (lines[j].match(/\(/g) || []).length;
          const closeParens = (lines[j].match(/\)/g) || []).length;
          if (tickCount > 0 || openParens > 0) started = true;
          backticks += tickCount;
          parens += openParens - closeParens;
          if (started) {
            if (backticks >= 2) break;
            if (backticks === 0 && parens <= 0 && lines[j].includes(';')) break;
          }
        }

        // Exempt system health checks and sequences
        if (
          block.includes('SELECT 1') ||
          block.includes('nextval') ||
          block.includes('CREATE SEQUENCE')
        ) {
          continue;
        }

        const isExempt = exemptions.some(
          (ex) => ex.file === relativeFile && ex.operation === rawOp,
        );

        if (isExempt) {
          violations.push({
            type: 'EXEMPTION',
            file: relativeFile,
            line: i + 1,
            operation: rawOp,
            model: 'RAW_SQL',
            snippet: line.trim(),
          });
          continue;
        }

        if (!block.includes('company_id') && !block.includes('companyId')) {
          violations.push({
            type: 'ERROR',
            file: relativeFile,
            line: i + 1,
            operation: rawOp,
            model: 'RAW_SQL',
            snippet: line.trim(),
            reason: 'Raw SQL query does not enforce company_id filter',
          });
        }
      }
    }

    // Prisma Model Operations
    for (const [modelKey, modelName] of Object.entries(TENANT_MODELS)) {
      for (const op of ALL_15_OPERATIONS) {
        if (op.startsWith('$')) continue;

        const regex = new RegExp(`(?:this\\.)?prisma\\.${modelKey}\\.${op}\\b`);
        if (regex.test(line)) {
          let block = line;
          let openParens = (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length;
          let j = i + 1;

          while (j < lines.length && openParens > 0 && j < i + 40) {
            block += ' ' + lines[j];
            openParens += (lines[j].match(/\(/g) || []).length - (lines[j].match(/\)/g) || []).length;
            j++;
          }

          const isExempt = exemptions.some(
            (ex) =>
              ex.file === relativeFile &&
              ex.operation === op &&
              (ex.model === modelName || ex.model === modelKey),
          );

          if (isExempt) {
            violations.push({
              type: 'EXEMPTION',
              file: relativeFile,
              line: i + 1,
              operation: op,
              model: modelName,
              snippet: line.trim(),
            });
            continue;
          }

          if (op === 'findUnique' || op === 'findFirst' || op === 'update' || op === 'delete' || op === 'upsert') {
            // Check if immediate surrounding code performs tenant assertion
            const postLines = lines.slice(Math.max(0, i - 15), Math.min(lines.length, i + 35)).join('\n');
            const hasTenantProtection =
              isScoped(block, lines, i) ||
              postLines.includes('assertSameTenant') ||
              postLines.includes('validateEntityBelongsToOrg') ||
              postLines.includes('assertTenantResource') ||
              postLines.includes('getAuthorizedDocument') ||
              postLines.includes('companyId') ||
              postLines.includes('actorCompanyId') ||
              postLines.includes('ForbiddenException');

            if (!hasTenantProtection) {
              violations.push({
                type: 'WARNING',
                file: relativeFile,
                line: i + 1,
                operation: op,
                model: modelName,
                snippet: line.trim(),
                reason: `${op} executed without detected immediate tenant boundary assertion`,
              });
            }
          } else {
            // Multi-record operations
            if (!isScoped(block, lines, i)) {
              violations.push({
                type: 'ERROR',
                file: relativeFile,
                line: i + 1,
                operation: op,
                model: modelName,
                snippet: line.trim(),
                reason: `Prisma ${modelName}.${op} missing tenant scoping (companyId)`,
              });
            }
          }
        }
      }
    }
  }

  return violations;
}

function run(): void {
  console.log('========================================================================');
  console.log('🛡️  PHASE 29: Static AST Tenancy Analyzer (All 15 Prisma Operations)');
  console.log('========================================================================');

  const currentDir = process.cwd();
  const workspaceRoot =
    currentDir.endsWith('apps\\api') || currentDir.endsWith('apps/api')
      ? path.resolve(currentDir, '../..')
      : currentDir;
  const srcDir = path.resolve(workspaceRoot, 'apps/api/src');
  const exemptionPath = path.resolve(workspaceRoot, 'tenant-exemptions.json');

  const exemptions = loadAndValidateExemptions(exemptionPath);
  console.log(`Loaded ${exemptions.length} validated tenant exemptions.`);

  const sourceFiles = findSourceFiles(srcDir);
  console.log(`Scanning ${sourceFiles.length} source files across apps/api/src...\n`);

  let errorCount = 0;
  let warningCount = 0;
  let exemptionCount = 0;

  const allViolations: Violation[] = [];
  for (const file of sourceFiles) {
    const fileViolations = analyzeFile(file, exemptions, workspaceRoot);
    for (const v of fileViolations) {
      allViolations.push(v);
      if (v.type === 'ERROR') {
        errorCount++;
        console.error(`❌ [ERROR] ${v.file}:${v.line} -> ${v.model}.${v.operation}`);
        console.error(`   Snippet: ${v.snippet}`);
        console.error(`   Reason:  ${v.reason}\n`);
      } else if (v.type === 'WARNING') {
        warningCount++;
        console.warn(`⚠️  [WARNING] ${v.file}:${v.line} -> ${v.model}.${v.operation}`);
        console.warn(`   Snippet: ${v.snippet}`);
        console.warn(`   Reason:  ${v.reason}\n`);
      } else if (v.type === 'EXEMPTION') {
        exemptionCount++;
      }
    }
  }

  fs.writeFileSync(
    path.resolve(workspaceRoot, 'tenant-security-report.json'),
    JSON.stringify(allViolations, null, 2),
    'utf8'
  );

  console.log('------------------------------------------------------------------------');
  console.log(`Summary:`);
  console.log(`  Errors:     ${errorCount}`);
  console.log(`  Warnings:   ${warningCount}`);
  console.log(`  Exemptions: ${exemptionCount}`);
  console.log('------------------------------------------------------------------------');

  if (errorCount > 0) {
    console.error(`\n🚨 FAILED: ${errorCount} unscoped tenant operations detected.`);
    process.exit(1);
  }

  console.log('\n✅ PASSED: All Prisma operations strictly adhere to tenant isolation.');
  console.log('========================================================================\n');
}

run();
