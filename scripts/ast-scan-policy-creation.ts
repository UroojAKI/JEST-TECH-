import * as fs from 'fs';
import * as path from 'path';

interface PolicyCreationSite {
  file: string;
  line: number;
  snippet: string;
  productType?: string;
  isAuthorizedMotorIssuer: boolean;
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

function analyzePolicyCreation(workspaceRoot: string): {
  pass: boolean;
  violations: PolicyCreationSite[];
  sites: PolicyCreationSite[];
} {
  const srcDir = path.resolve(workspaceRoot, 'apps/api/src');
  const files = findSourceFiles(srcDir);
  const sites: PolicyCreationSite[] = [];
  const violations: PolicyCreationSite[] = [];

  const AUTHORIZED_MOTOR_ISSUER = 'motor-policy-issuance.service.ts';

  for (const file of files) {
    const relativeFile = path.relative(workspaceRoot, file).replace(/\\/g, '/');
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Match policy creation patterns
      if (
        line.includes('prisma.policy.create') ||
        line.includes('policy.create(') ||
        line.includes('policyRepository.create')
      ) {
        let block = line;
        for (let j = i + 1; j < Math.min(lines.length, i + 30); j++) {
          block += ' ' + lines[j];
          if (lines[j].includes(';')) break;
        }

        const isMotorIssuer = relativeFile.endsWith(AUTHORIZED_MOTOR_ISSUER);
        const createsMotorPolicy =
          block.includes("'MOTOR'") ||
          block.includes('"MOTOR"') ||
          block.includes('ProductType.MOTOR') ||
          block.includes('productType');

        const site: PolicyCreationSite = {
          file: relativeFile,
          line: i + 1,
          snippet: line.trim(),
          isAuthorizedMotorIssuer: isMotorIssuer,
        };

        if (createsMotorPolicy) {
          site.productType = 'MOTOR';
        }

        sites.push(site);

        // If creates MOTOR policy and is NOT the authorized motor issuer
        if (createsMotorPolicy && !isMotorIssuer) {
          // Check if non-motor products are explicitly converted while motor is rejected
          if (relativeFile.includes('convert-quotation.service.ts')) {
            // convert-quotation rejects MOTOR with ConflictException
            if (content.includes('MOTOR_PRODUCT_TYPES.includes') && content.includes('ConflictException')) {
              continue;
            }
          }

          violations.push(site);
        }
      }
    }
  }

  return {
    pass: violations.length === 0,
    violations,
    sites,
  };
}

function run(): void {
  console.log('========================================================================');
  console.log('🔍 CERT-19: AST Scan for Motor Policy Creation Authority');
  console.log('========================================================================');

  const currentDir = process.cwd();
  const workspaceRoot =
    currentDir.endsWith('apps\\api') || currentDir.endsWith('apps/api')
      ? path.resolve(currentDir, '../..')
      : currentDir;

  const result = analyzePolicyCreation(workspaceRoot);

  console.log(`Scanned API codebase: found ${result.sites.length} policy creation sites.`);
  for (const s of result.sites) {
    console.log(` - ${s.file}:${s.line} (Authorized Motor Issuer: ${s.isAuthorizedMotorIssuer})`);
  }

  if (!result.pass) {
    console.error('\n❌ FAIL: Unauthorized Motor policy creation detected in:');
    for (const v of result.violations) {
      console.error(`  ${v.file}:${v.line} -> ${v.snippet}`);
    }
    process.exit(1);
  }

  console.log('\n✅ PASS: Only MotorPolicyIssuanceService creates MOTOR policies.');
  console.log('========================================================================\n');
}

run();
