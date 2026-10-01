/**
 * generate-baseline-inventory.ts
 * Wave 1 - Authoritative Baseline Inventory Generator
 *
 * Scans the JEST Policy CRM monorepo and produces:
 *   docs/audit/baseline/routes.json
 *   docs/audit/baseline/api-routes.json
 *   docs/audit/baseline/models.json
 *   docs/audit/baseline/static-data-findings.json
 *   docs/audit/baseline/dead-code-findings.json
 *   docs/audit/baseline/tests.json
 *   docs/audit/baseline/roles.json
 *
 * Usage:  pnpm tsx scripts/generate-baseline-inventory.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// CONFIG
const ROOT = path.resolve(__dirname, '..');
const WEB_APP = path.join(ROOT, 'apps', 'web', 'src', 'app');
const API_SRC = path.join(ROOT, 'apps', 'api', 'src');
const PRISMA_SCHEMA = path.join(ROOT, 'apps', 'api', 'prisma', 'schema.prisma');
const OUT_DIR = path.join(ROOT, 'docs', 'audit', 'baseline');

// UTILS
function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath: string, data: unknown) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function collectFiles(dir: string, predicate: (f: string) => boolean): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(full, predicate));
    } else if (entry.isFile() && predicate(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

function relPath(absPath: string): string {
  return absPath.replace(ROOT + path.sep, '').replace(/\\/g, '/');
}

function readLines(filePath: string): string[] {
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
}

// 1. ROUTES
interface RouteEntry {
  route: string;
  pageFile: string;
  apiCalls: string[];
  status: 'WORKING' | 'PARTIAL' | 'STATIC' | 'UNIMPLEMENTED';
}

const MUTATE_METHODS = new Set(['post', 'put', 'patch', 'delete']);

function deriveRoute(pageFile: string): string {
  const rel = pageFile.replace(WEB_APP, '').replace(/\\/g, '/');
  return rel.replace(/\/page\.tsx$/, '') || '/';
}

function extractApiCallsFromFile(content: string): Array<{ method: string; path: string }> {
  const calls: Array<{ method: string; path: string }> = [];
  let m: RegExpExecArray | null;
  const apiRe = /apiClient\.(get|post|put|patch|delete)\(\s*[`'"](.*?)[`'"]/g;
  while ((m = apiRe.exec(content)) !== null) {
    calls.push({ method: m[1].toUpperCase(), path: m[2] });
  }
  const fetchRe = /fetch\(\s*[`'"](.*?)[`'"]/g;
  while ((m = fetchRe.exec(content)) !== null) {
    calls.push({ method: 'GET', path: m[1] });
  }
  return calls;
}

function classifyRoute(content: string, calls: Array<{ method: string; path: string }>): RouteEntry['status'] {
  if (calls.length === 0) return 'STATIC';
  const hasMutation = calls.some((c) => MUTATE_METHODS.has(c.method.toLowerCase()));
  const hasToast = /\btoast[\.(]/.test(content);
  if (hasToast && !hasMutation) return 'UNIMPLEMENTED';
  return 'WORKING';
}

function generateRoutes(): RouteEntry[] {
  const pageFiles = collectFiles(WEB_APP, (f) => f === 'page.tsx');
  const routes: RouteEntry[] = [];
  for (const pageFile of pageFiles) {
    const content = fs.readFileSync(pageFile, 'utf8');
    const calls = extractApiCallsFromFile(content);
    routes.push({
      route: deriveRoute(pageFile),
      pageFile: relPath(pageFile),
      apiCalls: calls.map((c) => `${c.method} ${c.path}`),
      status: classifyRoute(content, calls),
    });
  }
  return routes.sort((a, b) => a.route.localeCompare(b.route));
}

// 2. API-ROUTES
interface ApiRouteEntry {
  method: string;
  path: string;
  controller: string;
  file: string;
  hasRolesGuard: boolean;
  roles: string[];
  hasTenantScope: boolean;
}

const CONTROLLER_PREFIX_RE = /@Controller\(['"](.*?)['"]\)/;
const CONTROLLER_CLASS_RE = /export\s+class\s+(\w+)/;

function extractRolesFromLookback(lookback: string): string[] {
  const roles: string[] = [];
  const rolesMatch = /@Roles\(([^)]+)\)/.exec(lookback);
  if (!rolesMatch) return roles;
  const inner = rolesMatch[1];
  let rv: RegExpExecArray | null;
  const re = /RoleType\.(\w+)|['"](\w+)['"]/g;
  while ((rv = re.exec(inner)) !== null) {
    roles.push(rv[1] || rv[2]);
  }
  return roles;
}

function generateApiRoutes(): ApiRouteEntry[] {
  const controllerFiles = collectFiles(API_SRC, (f) => f.endsWith('.controller.ts'));
  const allRoutes: ApiRouteEntry[] = [];

  for (const file of controllerFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const prefixMatch = CONTROLLER_PREFIX_RE.exec(content);
    const classMatch = CONTROLLER_CLASS_RE.exec(content);
    const prefix = prefixMatch ? prefixMatch[1] : '';
    const controllerName = classMatch ? classMatch[1] : path.basename(file, '.ts');
    const hasRolesGuard = /RolesGuard/.test(content);
    const hasTenantScope = /companyId|TenantScope|tenantId/.test(content);

    const lines = readLines(file);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const verbMatch = /@(Get|Post|Put|Patch|Delete)\(([^)]*)\)/.exec(line);
      if (verbMatch) {
        const method = verbMatch[1].toUpperCase();
        const rawPath = verbMatch[2].replace(/['"` ]/g, '');
        const lookback = lines.slice(Math.max(0, i - 10), i + 1).join('\n');
        const roles = extractRolesFromLookback(lookback);
        const endpointPath = rawPath
          ? ('/' + prefix + '/' + rawPath).replace(/\/+/g, '/')
          : ('/' + prefix).replace(/\/+/g, '/') || '/';
        allRoutes.push({ method, path: endpointPath, controller: controllerName, file: relPath(file), hasRolesGuard, roles, hasTenantScope });
      }
    }
  }
  return allRoutes;
}

// 3. MODELS
interface ModelEntry {
  model: string;
  fields: string[];
  hasCompanyId: boolean;
  hasDeletedAt: boolean;
}

function generateModels(): ModelEntry[] {
  if (!fs.existsSync(PRISMA_SCHEMA)) { console.error('schema.prisma not found'); return []; }
  const lines = readLines(PRISMA_SCHEMA);
  const models: ModelEntry[] = [];
  let inModel = false;
  let currentModel = '';
  let currentFields: string[] = [];
  let depth = 0;

  for (const line of lines) {
    if (!inModel) {
      const m = /^model\s+(\w+)\s*\{/.exec(line);
      if (m) { inModel = true; currentModel = m[1]; currentFields = []; depth = 1; }
    } else {
      if (line.includes('{')) depth++;
      if (line.includes('}')) {
        depth--;
        if (depth <= 0) {
          models.push({ model: currentModel, fields: currentFields, hasCompanyId: currentFields.includes('companyId'), hasDeletedAt: currentFields.includes('deletedAt') });
          inModel = false; currentModel = ''; currentFields = []; depth = 0;
          continue;
        }
      }
      const fm = /^\s{1,4}(\w+)\s+/.exec(line);
      if (fm && !/^(@@|\/\/)/.test(line.trim())) {
        currentFields.push(fm[1]);
      }
    }
  }
  return models;
}

// 4. STATIC DATA FINDINGS
interface StaticDataFinding {
  file: string;
  line: number;
  type: string;
  value: string;
  classification: 'REAL_BUG' | 'REVIEW';
}

const STATIC_PATTERNS: Array<{ re: RegExp; type: string }> = [
  { re: /["'`](Rahul|Priya|Amit|Anita|Suresh|Sunita|Ravi|Geeta|Vijay|Pooja|Rajesh|Sneha|Mohit|Deepa|Arjun|Kavita)\s+\w+["'`]/, type: 'HARDCODED_CUSTOMER_NAME' },
  { re: /["'`](ICICI Lombard|Bajaj Allianz|New India|HDFC Ergo|Tata AIG|Reliance General|Star Health|National Insurance)["'`]/, type: 'HARDCODED_INSURER_NAME' },
  { re: /["'`](202[5-9]-\d{2}-\d{2})["'`]/, type: 'HARDCODED_DATE' },
  { re: /defaultValue=["'`]([A-Z][a-z]{3,}\s+[A-Z][a-z]{3,}|[A-Z]{3,}\d+)["'`]/, type: 'HARDCODED_DEFAULT_VALUE' },
  { re: /["'`](\+91[\s-]?\d{10}|\d{10})["'`]/, type: 'HARDCODED_PHONE_NUMBER' },
  { re: /["'`](test\.|demo\.|sample\.|fake\.)[a-z0-9]+@[a-z0-9.]+["'`]/i, type: 'HARDCODED_TEST_EMAIL' },
];

function generateStaticDataFindings(): StaticDataFinding[] {
  const files = collectFiles(path.join(ROOT, 'apps', 'web', 'src'), (f) => f.endsWith('.tsx') || f.endsWith('.ts'));
  const findings: StaticDataFinding[] = [];

  for (const file of files) {
    const lines = readLines(file);
    lines.forEach((line, idx) => {
      for (const { re, type } of STATIC_PATTERNS) {
        const m = re.exec(line);
        if (m) {
          findings.push({ file: relPath(file), line: idx + 1, type, value: m[1] || m[0], classification: 'REAL_BUG' });
          break;
        }
      }
    });

    // Fake success toasts (no await before toast.success/info)
    const content = fs.readFileSync(file, 'utf8');
    const toastRe = /toast\.(success|info)\s*\(/g;
    let tm: RegExpExecArray | null;
    while ((tm = toastRe.exec(content)) !== null) {
      const before = content.slice(Math.max(0, tm.index - 300), tm.index);
      if (!before.includes('await ') && !before.includes('.then(')) {
        const lineNum = content.slice(0, tm.index).split('\n').length;
        findings.push({ file: relPath(file), line: lineNum, type: 'FAKE_SUCCESS_TOAST', value: `toast.${tm[1]}(`, classification: 'REAL_BUG' });
      }
    }
  }
  return findings;
}

// 5. DEAD CODE FINDINGS
interface DeadCodeFinding {
  file: string;
  line: number;
  type: 'TODO' | 'FIXME' | 'HACK' | 'EMPTY_CATCH' | 'NOT_IMPLEMENTED' | 'CONSOLE_LOG';
  content: string;
}

const DEAD_PATTERNS: Array<{ re: RegExp; type: DeadCodeFinding['type'] }> = [
  { re: /\/\/\s*TODO:?\s+.+/i, type: 'TODO' },
  { re: /\/\/\s*FIXME:?\s+.+/i, type: 'FIXME' },
  { re: /\/\/\s*HACK:?\s+.+/i, type: 'HACK' },
  { re: /throw\s+new\s+Error\(['"`]Not implemented/i, type: 'NOT_IMPLEMENTED' },
  { re: /console\.log\s*\(/, type: 'CONSOLE_LOG' },
  { re: /catch\s*\(\s*[_e]\s*\)\s*\{\s*\}/, type: 'EMPTY_CATCH' },
];

function generateDeadCodeFindings(): DeadCodeFinding[] {
  const apiFiles = collectFiles(API_SRC, (f) => f.endsWith('.ts') && !f.endsWith('.spec.ts') && !f.endsWith('.test.ts'));
  const webFiles = collectFiles(path.join(ROOT, 'apps', 'web', 'src'), (f) => f.endsWith('.tsx') || f.endsWith('.ts'));
  const findings: DeadCodeFinding[] = [];

  for (const file of [...apiFiles, ...webFiles]) {
    if (file.endsWith('.spec.ts') || file.endsWith('.test.ts')) continue;
    const lines = readLines(file);
    lines.forEach((line, idx) => {
      for (const { re, type } of DEAD_PATTERNS) {
        if (re.test(line)) {
          findings.push({ file: relPath(file), line: idx + 1, type, content: line.trim() });
          break;
        }
      }
    });
  }
  return findings;
}

// 6. TESTS
interface TestEntry {
  file: string;
  testCount: number;
  describes: string[];
  module: string;
}

function extractModule(filePath: string): string {
  const m = /modules[\\/]([^\\\/]+)/.exec(filePath);
  if (m) return m[1];
  const m2 = /common[\\/]([^\\\/]+)/.exec(filePath);
  if (m2) return `common/${m2[1]}`;
  return 'root';
}

function generateTests(): TestEntry[] {
  const specFiles = collectFiles(API_SRC, (f) => f.endsWith('.spec.ts'));
  return specFiles.map((file) => {
    const content = fs.readFileSync(file, 'utf8');
    const describes: string[] = [];
    let dm: RegExpExecArray | null;
    const dRe = /describe\(\s*['"`](.*?)['"`]/g;
    while ((dm = dRe.exec(content)) !== null) describes.push(dm[1]);
    const itMatches = content.match(/\bit\s*\(\s*['"`]|test\s*\(\s*['"`]/g) || [];
    return { file: relPath(file), testCount: itMatches.length, describes, module: extractModule(file) };
  });
}

// 7. ROLES
interface RolesEntry {
  file: string;
  endpoint: string;
  roles: string[];
}

function generateRoles(): RolesEntry[] {
  const controllerFiles = collectFiles(API_SRC, (f) => f.endsWith('.controller.ts'));
  const entries: RolesEntry[] = [];

  for (const file of controllerFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const prefixMatch = CONTROLLER_PREFIX_RE.exec(content);
    const prefix = prefixMatch ? prefixMatch[1] : '';
    const lines = readLines(file);
    let pendingRoles: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const rolesMatch = /@Roles\(([^)]+)\)/.exec(line);
      if (rolesMatch) {
        const roles: string[] = [];
        let rv: RegExpExecArray | null;
        const re = /RoleType\.(\w+)|['"](\w+)['"]/g;
        while ((rv = re.exec(rolesMatch[1])) !== null) roles.push(rv[1] || rv[2]);
        pendingRoles = roles;
      }
      const verbMatch = /@(Get|Post|Put|Patch|Delete)\(([^)]*)\)/.exec(line);
      if (verbMatch) {
        const method = verbMatch[1].toUpperCase();
        const rawPath = verbMatch[2].replace(/['"` ]/g, '');
        const endpointPath = rawPath
          ? ('/' + prefix + '/' + rawPath).replace(/\/+/g, '/')
          : ('/' + prefix).replace(/\/+/g, '/') || '/';
        if (pendingRoles.length > 0) {
          entries.push({ file: relPath(file), endpoint: `${method} ${endpointPath}`, roles: pendingRoles });
        }
        pendingRoles = [];
      }
    }
  }
  return entries;
}

// MAIN
async function main() {
  console.log('=== JEST Policy CRM Baseline Inventory Generator ===\n');
  ensureDir(OUT_DIR);

  process.stdout.write('Scanning frontend routes...');
  const routes = generateRoutes();
  writeJson(path.join(OUT_DIR, 'routes.json'), routes);
  const rs = { WORKING: 0, PARTIAL: 0, STATIC: 0, UNIMPLEMENTED: 0 };
  routes.forEach((r) => rs[r.status]++);
  console.log(` done (${routes.length})`);

  process.stdout.write('Scanning API controllers...');
  const apiRoutes = generateApiRoutes();
  writeJson(path.join(OUT_DIR, 'api-routes.json'), apiRoutes);
  console.log(` done (${apiRoutes.length})`);

  process.stdout.write('Parsing Prisma schema...');
  const models = generateModels();
  writeJson(path.join(OUT_DIR, 'models.json'), models);
  console.log(` done (${models.length})`);

  process.stdout.write('Scanning for static/hardcoded data...');
  const staticFindings = generateStaticDataFindings();
  writeJson(path.join(OUT_DIR, 'static-data-findings.json'), staticFindings);
  console.log(` done (${staticFindings.length})`);

  process.stdout.write('Scanning for dead code...');
  const deadCode = generateDeadCodeFindings();
  writeJson(path.join(OUT_DIR, 'dead-code-findings.json'), deadCode);
  console.log(` done (${deadCode.length})`);

  process.stdout.write('Scanning test specs...');
  const tests = generateTests();
  writeJson(path.join(OUT_DIR, 'tests.json'), tests);
  console.log(` done (${tests.length})`);

  process.stdout.write('Building roles map...');
  const roles = generateRoles();
  writeJson(path.join(OUT_DIR, 'roles.json'), roles);
  console.log(` done (${roles.length})\n`);

  const totalTests = tests.reduce((s, t) => s + t.testCount, 0);

  console.log('=== JEST Policy CRM Baseline Inventory ===');
  console.log(`Frontend Routes:       ${routes.length}`);
  console.log(`  WORKING:             ${rs.WORKING}`);
  console.log(`  PARTIAL:             ${rs.PARTIAL}`);
  console.log(`  STATIC:              ${rs.STATIC}`);
  console.log(`  UNIMPLEMENTED:       ${rs.UNIMPLEMENTED}`);
  console.log(`Backend Endpoints:     ${apiRoutes.length}`);
  console.log(`Prisma Models:         ${models.length}`);
  console.log(`Static Data Findings:  ${staticFindings.length}`);
  console.log(`Dead Code Findings:    ${deadCode.length}`);
  console.log(`Test Files:            ${tests.length}`);
  console.log(`Test Cases:            ${totalTests}`);
  console.log(`Role-Guarded Routes:   ${roles.length}`);
  console.log(`\nOutput: ${OUT_DIR}`);
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
