/**
 * generate-role-permission-matrix.ts
 * Wave 1 - Role Permission Matrix Generator
 *
 * Reads RoleType enum from schema.prisma, scans all controllers for
 * @Roles decorators, and produces a security matrix JSON.
 *
 * Usage:  pnpm tsx scripts/generate-role-permission-matrix.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const ROOT = path.resolve(__dirname, '..');
const API_SRC = path.join(ROOT, 'apps', 'api', 'src');
const PRISMA_SCHEMA = path.join(ROOT, 'apps', 'api', 'prisma', 'schema.prisma');
const OUT_DIR = path.join(ROOT, 'docs', 'security');
const OUT_FILE = path.join(OUT_DIR, 'role-permission-matrix.json');

// UTILS
function collectFiles(dir: string, predicate: (f: string) => boolean): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...collectFiles(full, predicate));
    else if (entry.isFile() && predicate(entry.name)) results.push(full);
  }
  return results;
}

function relPath(absPath: string): string {
  return absPath.replace(ROOT + path.sep, '').replace(/\\/g, '/');
}

function getGitSha(): string {
  try {
    return execSync('git rev-parse HEAD', { cwd: ROOT, stdio: ['pipe', 'pipe', 'pipe'] })
      .toString()
      .trim();
  } catch {
    return 'unknown';
  }
}

// READ ROLES FROM PRISMA SCHEMA
function extractRolesFromSchema(): string[] {
  if (!fs.existsSync(PRISMA_SCHEMA)) return [];
  const content = fs.readFileSync(PRISMA_SCHEMA, 'utf8');
  const m = /enum\s+RoleType\s*\{([^}]+)\}/.exec(content);
  if (!m) return [];
  return m[1]
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('//'));
}

// READ CONTROLLERS
const CONTROLLER_PREFIX_RE = /@Controller\(['"](.*?)['"]\)/;
const CONTROLLER_CLASS_RE = /export\s+class\s+(\w+)/;

interface MatrixEntry {
  controller: string;
  endpoint: string;
  allowedRoles: string[];
  agentAllowed: boolean;
  hasRolesGuard: boolean;
}

interface NoGuardEntry {
  endpoint: string;
  controller: string;
  file: string;
}

function buildMatrix(knownRoles: string[]): { matrix: MatrixEntry[]; noGuard: NoGuardEntry[] } {
  const controllerFiles = collectFiles(API_SRC, (f) => f.endsWith('.controller.ts'));
  const matrix: MatrixEntry[] = [];
  const noGuard: NoGuardEntry[] = [];

  for (const file of controllerFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const prefixMatch = CONTROLLER_PREFIX_RE.exec(content);
    const classMatch = CONTROLLER_CLASS_RE.exec(content);
    const prefix = prefixMatch ? prefixMatch[1] : '';
    const controllerName = classMatch ? classMatch[1] : path.basename(file, '.ts');
    const hasClassRolesGuard = /RolesGuard/.test(content);
    const lines = content.split(/\r?\n/);

    let pendingRoles: string[] = [];
    let hasRolesDecorator = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Collect @Roles decorator
      const rolesMatch = /@Roles\(([^)]+)\)/.exec(line);
      if (rolesMatch) {
        hasRolesDecorator = true;
        const inner = rolesMatch[1];
        const roles: string[] = [];
        let rv: RegExpExecArray | null;
        const re = /RoleType\.(\w+)|['"](\w+)['"]/g;
        while ((rv = re.exec(inner)) !== null) roles.push(rv[1] || rv[2]);
        pendingRoles = roles;
      }

      // HTTP verb decorator
      const verbMatch = /@(Get|Post|Put|Patch|Delete)\(([^)]*)\)/.exec(line);
      if (verbMatch) {
        const method = verbMatch[1].toUpperCase();
        const rawPath = verbMatch[2].replace(/['"` ]/g, '');
        const endpointPath = rawPath
          ? ('/' + prefix + '/' + rawPath).replace(/\/+/g, '/')
          : ('/' + prefix).replace(/\/+/g, '/') || '/';
        const endpoint = `${method} ${endpointPath}`;

        if (pendingRoles.length > 0) {
          matrix.push({
            controller: controllerName,
            endpoint,
            allowedRoles: pendingRoles,
            agentAllowed: pendingRoles.includes('AGENT'),
            hasRolesGuard: hasClassRolesGuard,
          });
        } else {
          noGuard.push({ endpoint, controller: controllerName, file: relPath(file) });
        }
        pendingRoles = [];
        hasRolesDecorator = false;
      }
    }
  }

  return { matrix, noGuard };
}

// MAIN
async function main() {
  console.log('=== JEST Policy CRM Role Permission Matrix Generator ===\n');
  fs.mkdirSync(OUT_DIR, { recursive: true });

  process.stdout.write('Reading roles from schema.prisma...');
  const roles = extractRolesFromSchema();
  console.log(` done (${roles.join(', ')})`);

  process.stdout.write('Scanning controllers...');
  const { matrix, noGuard } = buildMatrix(roles);
  console.log(` done (${matrix.length} role-guarded, ${noGuard.length} unguarded)\n`);

  const gitSha = getGitSha();

  // Build per-role summary
  const roleSummary: Record<string, number> = {};
  roles.forEach((r) => {
    roleSummary[r] = matrix.filter((e) => e.allowedRoles.includes(r)).length;
  });

  const output = {
    generatedAt: new Date().toISOString(),
    gitSha,
    roles,
    roleSummary,
    matrix,
    endpointsWithNoRoleGuard: noGuard,
    summary: {
      totalEndpoints: matrix.length + noGuard.length,
      roleGuarded: matrix.length,
      unguarded: noGuard.length,
      agentAccessibleEndpoints: matrix.filter((e) => e.agentAllowed).length,
      adminOnlyEndpoints: matrix.filter((e) => e.allowedRoles.length === 1 && e.allowedRoles[0] === 'ADMIN').length,
    },
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2) + '\n', 'utf8');

  console.log('=== Role Permission Matrix ===');
  console.log(`Git SHA:               ${gitSha.slice(0, 8)}`);
  console.log(`Roles:                 ${roles.join(', ')}`);
  console.log(`Total Endpoints:       ${output.summary.totalEndpoints}`);
  console.log(`Role-Guarded:          ${output.summary.roleGuarded}`);
  console.log(`Unguarded:             ${output.summary.unguarded}`);
  console.log(`Agent-Accessible:      ${output.summary.agentAccessibleEndpoints}`);
  console.log(`Admin-Only:            ${output.summary.adminOnlyEndpoints}`);
  console.log('');
  roles.forEach((r) => {
    console.log(`  ${r.padEnd(15)}: ${roleSummary[r]} endpoints`);
  });
  console.log(`\nOutput: ${OUT_FILE}`);
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
