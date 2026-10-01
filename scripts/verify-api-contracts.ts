/**
 * verify-api-contracts.ts
 * Wave 1 - API Contract Validator
 *
 * Reads frontend repository calls and backend controller routes,
 * cross-references them, and outputs mismatches and uncalled routes.
 *
 * Usage:  pnpm tsx scripts/verify-api-contracts.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');
const REPOS_DIR = path.join(ROOT, 'apps', 'web', 'src', 'repositories');
const API_SRC = path.join(ROOT, 'apps', 'api', 'src');
const OUT_FILE = path.join(ROOT, 'docs', 'audit', 'baseline', 'api-contract-report.json');

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

// FRONTEND CALLS
interface FrontendCall {
  method: string;
  path: string;
  rawPath: string;
  file: string;
  line: number;
}

// Normalize dynamic segments: /tasks/${id} -> /tasks/:id (stripping query string)
function normalizePathTemplate(p: string): string {
  const withoutQuery = p.split('?')[0];
  return withoutQuery
    .replace(/\$\{[^}]+\}/g, ':param')
    .replace(/:[a-zA-Z_]+/g, ':param')
    .replace(/\/+$/, '')
    || '/';
}

function extractFrontendCalls(): FrontendCall[] {
  const repoFiles = collectFiles(REPOS_DIR, (f) => f.endsWith('.ts') || f.endsWith('.tsx'));
  // Also scan any web src directories for apiClient calls
  const webSrcFiles = collectFiles(path.join(ROOT, 'apps', 'web', 'src'), (f) => f.endsWith('.ts') || f.endsWith('.tsx'));
  const allFiles = [...new Set([...repoFiles, ...webSrcFiles])];
  const calls: FrontendCall[] = [];

  for (const file of allFiles) {
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    lines.forEach((line, idx) => {
      const re = /apiClient\.(get|post|put|patch|delete)\(\s*[`'"](.*?)[`'"]/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(line)) !== null) {
        calls.push({
          method: m[1].toUpperCase(),
          path: normalizePathTemplate(m[2]),
          rawPath: m[2],
          file: relPath(file),
          line: idx + 1,
        });
      }
    });
  }
  return calls;
}

// BACKEND ROUTES
interface BackendRoute {
  method: string;
  path: string;
  controller: string;
  file: string;
  hasRolesGuard: boolean;
}

const CONTROLLER_PREFIX_RE = /@Controller\(['"](.*?)['"]\)/;
const CONTROLLER_CLASS_RE = /export\s+class\s+(\w+)/;

function extractBackendRoutes(): BackendRoute[] {
  const controllerFiles = collectFiles(API_SRC, (f) => f.endsWith('.controller.ts'));
  const routes: BackendRoute[] = [];

  for (const file of controllerFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const prefixMatch = CONTROLLER_PREFIX_RE.exec(content);
    const classMatch = CONTROLLER_CLASS_RE.exec(content);
    const prefix = prefixMatch ? prefixMatch[1] : '';
    const controllerName = classMatch ? classMatch[1] : path.basename(file, '.ts');
    const hasRolesGuard = /RolesGuard/.test(content);
    const lines = content.split(/\r?\n/);

    for (const line of lines) {
      const verbMatch = /@(Get|Post|Put|Patch|Delete)\(([^)]*)\)/.exec(line);
      if (verbMatch) {
        const method = verbMatch[1].toUpperCase();
        const rawPath = verbMatch[2].replace(/['"` ]/g, '');
        const endpointPath = rawPath
          ? ('/' + prefix + '/' + rawPath).replace(/\/+/g, '/')
          : ('/' + prefix).replace(/\/+/g, '/') || '/';
        // Normalize :id, :uuid patterns
        const normalized = normalizePathTemplate(endpointPath);
        routes.push({ method, path: normalized, controller: controllerName, file: relPath(file), hasRolesGuard });
      }
    }
  }
  return routes;
}

// PATH MATCHING
// Try exact match, then param-collapsed match
function pathsMatch(frontendPath: string, backendPath: string): boolean {
  const fe = normalizePathTemplate(frontendPath);
  const be = normalizePathTemplate(backendPath);
  if (fe === be) return true;

  // Segment-level match collapsing :param
  const feSegs = fe.split('/');
  const beSegs = be.split('/');
  if (feSegs.length !== beSegs.length) return false;
  return feSegs.every((seg, i) => seg === beSegs[i] || seg === ':param' || beSegs[i] === ':param');
}

// CLASSIFY uncalled routes
function classifyUncalled(route: BackendRoute): string {
  const p = route.path.toLowerCase();
  const c = route.controller.toLowerCase();
  if (p.includes('webhook') || c.includes('webhook')) return 'WEBHOOK';
  if (p.includes('health') || p.includes('metrics') || c.includes('health')) return 'INTERNAL';
  if (p.includes('cron') || p.includes('schedule') || c.includes('cron')) return 'CRON';
  if (p.includes('queue') && route.method === 'GET') return 'INTERNAL';
  return 'UNUSED';
}

// MAIN
async function main() {
  console.log('=== JEST Policy CRM API Contract Validator ===\n');

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });

  process.stdout.write('Extracting frontend API calls...');
  const frontendCalls = extractFrontendCalls();
  // Deduplicate
  const dedupedCalls = frontendCalls.filter((call, idx) =>
    frontendCalls.findIndex((c) => c.method === call.method && c.path === call.path && c.file === call.file && c.line === call.line) === idx,
  );
  console.log(` done (${dedupedCalls.length} unique calls)`);

  process.stdout.write('Extracting backend routes...');
  const backendRoutes = extractBackendRoutes();
  console.log(` done (${backendRoutes.length} routes)\n`);

  const mismatches: Array<{
    frontendCall: string;
    frontendFile: string;
    frontendLine: number;
    backendExists: boolean;
    methodMatch: boolean;
  }> = [];

  const matchedBackendPaths = new Set<string>();

  for (const call of dedupedCalls) {
    // Find backend route with matching path (any method)
    const pathMatches = backendRoutes.filter((br) => pathsMatch(call.path, br.path));
    const exactMatch = pathMatches.find((br) => br.method === call.method);

    if (exactMatch) {
      matchedBackendPaths.add(`${exactMatch.method}:${exactMatch.path}`);
    } else if (pathMatches.length > 0) {
      // Path exists but wrong method
      mismatches.push({
        frontendCall: `${call.method} ${call.rawPath}`,
        frontendFile: call.file,
        frontendLine: call.line,
        backendExists: true,
        methodMatch: false,
      });
      pathMatches.forEach((br) => matchedBackendPaths.add(`${br.method}:${br.path}`));
    } else {
      mismatches.push({
        frontendCall: `${call.method} ${call.rawPath}`,
        frontendFile: call.file,
        frontendLine: call.line,
        backendExists: false,
        methodMatch: false,
      });
    }
  }

  const uncalledBackendRoutes = backendRoutes
    .filter((br) => !matchedBackendPaths.has(`${br.method}:${br.path}`))
    .map((br) => ({
      method: br.method,
      path: br.path,
      controller: br.controller,
      file: br.file,
      classification: classifyUncalled(br),
    }));

  const matched = dedupedCalls.length - mismatches.filter((m) => !m.backendExists).length;

  const report = {
    generatedAt: new Date().toISOString(),
    mismatches,
    uncalledBackendRoutes,
    summary: {
      totalFrontendCalls: dedupedCalls.length,
      matched,
      unmatched: mismatches.length,
      uncalledBackend: uncalledBackendRoutes.length,
      uncalledByClassification: {
        WEBHOOK: uncalledBackendRoutes.filter((r) => r.classification === 'WEBHOOK').length,
        CRON: uncalledBackendRoutes.filter((r) => r.classification === 'CRON').length,
        INTERNAL: uncalledBackendRoutes.filter((r) => r.classification === 'INTERNAL').length,
        UNUSED: uncalledBackendRoutes.filter((r) => r.classification === 'UNUSED').length,
      },
    },
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(report, null, 2) + '\n', 'utf8');

  console.log('=== API Contract Report ===');
  console.log(`Total Frontend Calls:  ${report.summary.totalFrontendCalls}`);
  console.log(`Matched:               ${report.summary.matched}`);
  console.log(`Unmatched:             ${report.summary.unmatched}`);
  console.log(`Uncalled Backend:      ${report.summary.uncalledBackend}`);
  console.log(`  WEBHOOK:             ${report.summary.uncalledByClassification.WEBHOOK}`);
  console.log(`  CRON:                ${report.summary.uncalledByClassification.CRON}`);
  console.log(`  INTERNAL:            ${report.summary.uncalledByClassification.INTERNAL}`);
  console.log(`  UNUSED:              ${report.summary.uncalledByClassification.UNUSED}`);
  console.log(`\nReport: ${OUT_FILE}`);

  if (mismatches.length > 0) {
    console.log('\n--- Mismatches (sample) ---');
    mismatches.slice(0, 10).forEach((m) => {
      console.log(`  [${m.backendExists ? 'METHOD_MISMATCH' : 'MISSING'}] ${m.frontendCall}`);
      console.log(`    -> ${m.frontendFile}:${m.frontendLine}`);
    });
    if (mismatches.length > 10) console.log(`  ... and ${mismatches.length - 10} more`);
  }
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
