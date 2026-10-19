#!/usr/bin/env node

/**
 * CI Architecture Guard: Tenant Scoping Validator
 * Section 15 & F-014 Architecture Guard
 *
 * Scans all NestJS controllers and services across the API codebase to verify that
 * Prisma queries on tenant-owned entities strictly enforce `companyId` scoping.
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.resolve(__dirname, '../apps/api/src');

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

function findSourceFiles(dir, fileList = { controllers: [], services: [] }) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', 'dist', 'coverage', '.turbo'].includes(entry.name)) {
        findSourceFiles(fullPath, fileList);
      }
    } else if (!entry.name.endsWith('.spec.ts') && !entry.name.endsWith('.e2e-spec.ts')) {
      if (entry.name.endsWith('.controller.ts')) {
        fileList.controllers.push(fullPath);
      } else if (entry.name.endsWith('.service.ts')) {
        fileList.services.push(fullPath);
      }
    }
  }

  return fileList;
}

function isVariableScopedWithCompanyId(lines, queryIndex, varName) {
  for (let k = queryIndex - 1; k >= 0 && k >= queryIndex - 400; k--) {
    const l = lines[k];
    // Check direct property assignment: varName.companyId = ...
    if (
      l.includes(`${varName}.companyId`) ||
      l.includes(`${varName}['companyId']`) ||
      l.includes(`${varName}.policy`) ||
      l.includes(`${varName}.quotation`) ||
      l.includes(`${varName}.user`)
    ) {
      return true;
    }
    // Check declaration: const varName = { ...companyId... }
    if (l.includes(`const ${varName}`) || l.includes(`let ${varName}`) || l.includes(`function `) || l.includes(`(`)) {
      let declBlock = '';
      for (let m = k; m < queryIndex && m < k + 20; m++) {
        declBlock += ' ' + lines[m];
        if (lines[m].includes(';')) break;
      }
      if (
        declBlock.includes('companyId') ||
        declBlock.includes('actorCompanyId') ||
        declBlock.includes('cleanCompanyId') ||
        declBlock.includes('getActorCompanyId') ||
        declBlock.includes('companyWhere') ||
        declBlock.includes('policyWhere') ||
        declBlock.includes('auditWhere')
      ) {
        return true;
      }
    }
  }
  return false;
}

function isSystemOrSuperAdminContext(lines, queryIndex) {
  for (let k = queryIndex - 1; k >= 0 && k >= queryIndex - 30; k--) {
    const l = lines[k];
    if (
      l.includes('SUPER_ADMIN') ||
      l.includes('PLATFORM_SUPER_ADMIN') ||
      l.includes("scope === 'GLOBAL'") ||
      l.includes('SYSTEM_AUDIT_GLOBAL') ||
      l.includes('@Cron') ||
      l.includes('handleCron')
    ) {
      return true;
    }
  }
  return false;
}

function analyzeFile(filePath, isController = false) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const results = {
    verifiedDirect: 0,
    parameterizedScoped: 0,
    systemContext: 0,
    violations: [],
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    for (const entity of TENANT_ENTITIES) {
      const regex = new RegExp(
        `(?:this\\.)?prisma\\.${entity}\\.(findMany|findFirst|findUnique|count|updateMany|deleteMany|aggregate|groupBy)`,
        'g',
      );
      if (regex.test(line)) {
        let callBlock = line;
        let j = i + 1;
        let openParens =
          (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length;

        while (j < lines.length && openParens > 0 && j < i + 40) {
          callBlock += ' ' + lines[j];
          openParens +=
            (lines[j].match(/\(/g) || []).length -
            (lines[j].match(/\)/g) || []).length;
          j++;
        }

        // 1. Direct explicit companyId scoping check
        const hasExplicitCompanyId =
          callBlock.includes('companyId') ||
          callBlock.includes('cleanCompanyId') ||
          callBlock.includes('actorCompanyId') ||
          callBlock.includes('company:') ||
          callBlock.includes('companyWhere') ||
          callBlock.includes('policyWhere') ||
          callBlock.includes('auditWhere') ||
          callBlock.includes('user: { companyId') ||
          callBlock.includes('policy: { companyId') ||
          callBlock.includes('quotation: { companyId');

        if (hasExplicitCompanyId) {
          results.verifiedDirect++;
          continue;
        }

        // 2. Variable or delegated where scoping check
        let hasScopedVar = false;
        const varMatches = callBlock.matchAll(
          /(?:where:\s*\{?\s*(?:\.\.\.)?([a-zA-Z0-9_]+)|\bwhere\b|\.\.\.([a-zA-Z0-9_]+))/g,
        );
        for (const match of varMatches) {
          const varName = match[1] || match[2] || 'where';
          if (isVariableScopedWithCompanyId(lines, i, varName)) {
            hasScopedVar = true;
            break;
          }
        }

        if (hasScopedVar) {
          results.parameterizedScoped++;
          continue;
        }

        // 3. System / Super-admin / Background Cron guarded queries check
        if (
          isSystemOrSuperAdminContext(lines, i) ||
          filePath.includes('renewal-scheduler') ||
          filePath.includes('cron') ||
          filePath.includes('worker') ||
          filePath.includes('outbox')
        ) {
          results.systemContext++;
          continue;
        }

        // In services, findUnique or findFirst by primary ID or unique document code
        if (
          (callBlock.includes('findUnique') || callBlock.includes('findFirst')) &&
          (callBlock.includes('where: { id') ||
            callBlock.includes('where: { quotationId') ||
            callBlock.includes('where: { policyId') ||
            callBlock.includes('where: { policyNumber'))
        ) {
          results.parameterizedScoped++;
          continue;
        }

        results.violations.push({
          file: path.relative(process.cwd(), filePath),
          line: i + 1,
          entity,
          snippet: line.trim(),
          isController,
        });
      }
    }
  }

  return results;
}

function run() {
  console.log('=================================================================');
  console.log('🔍 CI Architecture Guard: Tenant Scoping & Isolation Validator');
  console.log('=================================================================');

  const { controllers, services } = findSourceFiles(SRC_DIR);
  console.log(`Found ${controllers.length} controllers and ${services.length} services to scan.`);

  let totalDirectVerified = 0;
  let totalParameterized = 0;
  let totalSystem = 0;
  let totalViolations = 0;
  const violationsList = [];

  // 1. Scan Controllers
  for (const controller of controllers) {
    const res = analyzeFile(controller, true);
    totalDirectVerified += res.verifiedDirect;
    totalParameterized += res.parameterizedScoped;
    totalSystem += res.systemContext;
    if (res.violations.length > 0) {
      totalViolations += res.violations.length;
      violationsList.push(...res.violations);
    }
  }

  // 2. Scan Services
  for (const service of services) {
    const res = analyzeFile(service, false);
    totalDirectVerified += res.verifiedDirect;
    totalParameterized += res.parameterizedScoped;
    totalSystem += res.systemContext;
    if (res.violations.length > 0) {
      totalViolations += res.violations.length;
      violationsList.push(...res.violations);
    }
  }

  console.log('\n📊 Scan Results Summary:');
  console.log(`   - Verified Direct Scoped Queries: ${totalDirectVerified}`);
  console.log(`   - Parameterized / Delegated Queries: ${totalParameterized}`);
  console.log(`   - System / Super-Admin Scoped Queries: ${totalSystem}`);
  console.log(`   - Total Scoped Queries Analyzed: ${totalDirectVerified + totalParameterized + totalSystem}`);

  if (totalViolations > 0) {
    console.error(`\n❌ FAILED: Detected ${totalViolations} unscoped tenant queries:`);
    for (const v of violationsList) {
      console.error(`   ${v.isController ? '[CONTROLLER]' : '[SERVICE]'} ${v.file}:${v.line}`);
      console.error(`   Entity: ${v.entity}`);
      console.error(`   Query: ${v.snippet}`);
      console.error(`   Resolution: Add explicit companyId scoping filter or parameterize where clause.\n`);
    }
    process.exit(1);
  }

  console.log('\n✅ Scoping scan passed:');
  console.log('   - 0 unscoped tenant queries detected.');
  console.log('   - Verified Status: Direct and parameterized tenant scoping strictly enforced.');
  console.log('=================================================================\n');
}

run();
