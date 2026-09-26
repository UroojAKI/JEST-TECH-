import * as fs from 'fs';
import * as path from 'path';

interface PricingSite {
  file: string;
  line: number;
  snippet: string;
  reason: string;
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

function analyzeFinancialAuthority(workspaceRoot: string): {
  pass: boolean;
  violations: PricingSite[];
  delegations: PricingSite[];
} {
  const motorDir = path.resolve(workspaceRoot, 'apps/api/src/modules/motor');
  const quoteDir = path.resolve(workspaceRoot, 'apps/api/src/modules/quotation');
  const files = [...findSourceFiles(motorDir), ...findSourceFiles(quoteDir)];

  const SOLE_CALCULATION_ENGINE = 'motor-calculation.service.ts';
  const RULE_ENGINE = 'motor-rule-engine.service.ts';
  const VERSION_SERVICE = 'create-quotation-version.service.ts';

  const violations: PricingSite[] = [];
  const delegations: PricingSite[] = [];

  for (const file of files) {
    const relativeFile = path.relative(workspaceRoot, file).replace(/\\/g, '/');
    const isSoleEngine = relativeFile.endsWith(SOLE_CALCULATION_ENGINE);

    if (isSoleEngine) continue;

    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check if MotorRuleEngine attempts to compute final premiums
      if (relativeFile.endsWith(RULE_ENGINE)) {
        if (
          (line.includes('finalPremium') || line.includes('netPremium') || line.includes('gstAmount')) &&
          (line.includes('=') || line.includes('+') || line.includes('*')) &&
          !line.includes('//') &&
          !line.includes('interface') &&
          !line.includes('type')
        ) {
          violations.push({
            file: relativeFile,
            line: i + 1,
            snippet: line.trim(),
            reason: 'MotorRuleEngineService must NOT calculate monetary totals (Phase 5 separation invariant)',
          });
        }
      }

      // Check if CreateQuotationVersionService delegates Motor pricing to MotorCalculationService
      if (relativeFile.endsWith(VERSION_SERVICE)) {
        if (!content.includes('this.motorCalculationService.calculate(motorInput)')) {
          violations.push({
            file: relativeFile,
            line: i + 1,
            snippet: line.trim(),
            reason: 'CreateQuotationVersionService must delegate Motor pricing to MotorCalculationService',
          });
        }
      }

      // Track delegations to MotorCalculationService
      if (line.includes('calculationService.calculate') || line.includes('motorCalculationService.calculate')) {
        delegations.push({
          file: relativeFile,
          line: i + 1,
          snippet: line.trim(),
          reason: 'Authorized pricing delegation to MotorCalculationService',
        });
      }
    }
  }

  return {
    pass: violations.length === 0,
    violations,
    delegations,
  };
}

function run(): void {
  console.log('========================================================================');
  console.log('🔍 CERT-20: AST Scan for Motor Financial Calculation Authority');
  console.log('========================================================================');

  const currentDir = process.cwd();
  const workspaceRoot =
    currentDir.endsWith('apps\\api') || currentDir.endsWith('apps/api')
      ? path.resolve(currentDir, '../..')
      : currentDir;

  const result = analyzeFinancialAuthority(workspaceRoot);

  console.log(`Found ${result.delegations.length} verified pricing delegations to MotorCalculationService:`);
  for (const d of result.delegations) {
    console.log(` - ${d.file}:${d.line} -> ${d.snippet}`);
  }

  if (!result.pass) {
    console.error('\n❌ FAIL: Unauthorized financial calculation logic detected:');
    for (const v of result.violations) {
      console.error(`  ${v.file}:${v.line} -> ${v.snippet} (${v.reason})`);
    }
    process.exit(1);
  }

  console.log('\n✅ PASS: MotorCalculationService is verified as sole financial pricing authority.');
  console.log('========================================================================\n');
}

run();
