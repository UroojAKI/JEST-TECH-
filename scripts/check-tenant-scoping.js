#!/usr/bin/env node

/**
 * CI Architecture Guard: Tenant Scoping Validator
 * Section 15 & F-014 Architecture Guard
 *
 * Scans all NestJS controllers across the API codebase to verify that
 * direct Prisma queries on tenant-owned entities strictly enforce `companyId` scoping.
 */

const fs = require('fs');
const path = require('path');

const CONTROLLERS_DIR = path.resolve(__dirname, '../apps/api/src');

const TENANT_ENTITIES = [
  'lead',
  'policy',
  'quotation',
  'motorQuotation',
  'claim',
  'contact',
  'customer',
  'task',
  'backOfficeTask',
  'motorInspection',
  'auditLog',
  'renewal',
  'policyPayment',
  'commission',
];

function findControllerFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', 'dist', 'coverage', '.turbo'].includes(entry.name)) {
        findControllerFiles(fullPath, files);
      }
    } else if (
      entry.name.endsWith('.controller.ts') &&
      !entry.name.endsWith('.spec.ts')
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

function isVariableScopedWithCompanyId(lines, queryIndex, varName) {
  for (let k = queryIndex - 1; k >= 0 && k >= queryIndex - 400; k--) {
    const l = lines[k];
    // Check direct property assignment: varName.companyId = ...
    if (
      l.includes(`${varName}.companyId`) ||
      l.includes(`${varName}['companyId']`)
    ) {
      return true;
    }
    // Check declaration: const varName = { ...companyId... }
    if (l.includes(`const ${varName}`) || l.includes(`let ${varName}`)) {
      let declBlock = '';
      for (let m = k; m < queryIndex && m < k + 20; m++) {
        declBlock += ' ' + lines[m];
        if (lines[m].includes(';')) break;
      }
      if (
        declBlock.includes('companyId') ||
        declBlock.includes('actorCompanyId') ||
        declBlock.includes('getActorCompanyId')
      ) {
        return true;
      }
    }
  }
  return false;
}

function analyzeController(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const violations = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    for (const entity of TENANT_ENTITIES) {
      const regex = new RegExp(
        `this\\.prisma\\.${entity}\\.(findMany|findFirst|count|updateMany|deleteMany)`,
        'g',
      );
      if (regex.test(line)) {
        let callBlock = line;
        let j = i + 1;
        let openParens =
          (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length;

        while (j < lines.length && openParens > 0 && j < i + 35) {
          callBlock += ' ' + lines[j];
          openParens +=
            (lines[j].match(/\(/g) || []).length -
            (lines[j].match(/\)/g) || []).length;
          j++;
        }

        let hasCompanyId =
          callBlock.includes('companyId') ||
          callBlock.includes('actorCompanyId') ||
          callBlock.includes('company:') ||
          callBlock.includes('user: { companyId');

        // Check if query delegates to a scoped where object variable or shorthand
        if (!hasCompanyId) {
          const varMatches = callBlock.matchAll(
            /(?:where:\s*\{?\s*(?:\.\.\.)?([a-zA-Z0-9_]+)|\bwhere\b)/g,
          );
          for (const match of varMatches) {
            const varName = match[1] || 'where';
            if (isVariableScopedWithCompanyId(lines, i, varName)) {
              hasCompanyId = true;
              break;
            }
          }
        }

        if (!hasCompanyId) {
          violations.push({
            file: path.relative(process.cwd(), filePath),
            line: i + 1,
            entity,
            snippet: line.trim(),
          });
        }
      }
    }
  }

  return violations;
}

function run() {
  console.log('=================================================================');
  console.log('🔍 CI Architecture Guard: Tenant Scoping & Isolation Validator');
  console.log('=================================================================');

  const controllers = findControllerFiles(CONTROLLERS_DIR);
  console.log(`Found ${controllers.length} controller files to scan.`);

  let totalViolations = 0;

  for (const controller of controllers) {
    const violations = analyzeController(controller);
    if (violations.length > 0) {
      for (const v of violations) {
        console.error(`❌ [TENANT LEAK VIOLATION] ${v.file}:${v.line}`);
        console.error(`   Entity: ${v.entity}`);
        console.error(`   Direct query missing companyId filter: ${v.snippet}`);
        console.error(
          `   Resolution: Pass actor companyId to scoped service or add companyId to where clause.\n`,
        );
        totalViolations++;
      }
    }
  }

  if (totalViolations > 0) {
    console.error(
      `🚨 FAILED: Detected ${totalViolations} unscoped tenant queries in controllers.`,
    );
    process.exit(1);
  }

  console.log('✅ PASSED: All controllers strictly enforce fail-closed tenant scoping.');
  console.log('=================================================================\n');
}

run();
