#!/usr/bin/env node
/**
 * JEST Policy CRM — Master Production Verification Suite
 * Executes all automated quality, security, unit, and architecture gates sequentially.
 *
 * Usage: node scripts/verify-all.js
 */

const { execSync } = require('child_process');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const CHECKS = [
  {
    name: 'API Static Typecheck (tsc --noEmit)',
    cmd: 'pnpm --filter api exec tsc --noEmit',
    cwd: ROOT,
  },
  {
    name: 'Web Static Typecheck (tsc --noEmit)',
    cmd: 'pnpm --filter web exec tsc --noEmit',
    cwd: ROOT,
  },
  {
    name: 'Architecture: Tenancy Scoping Guard',
    cmd: 'node scripts/check-tenant-scoping.js',
    cwd: ROOT,
  },
  {
    name: 'Architecture: Mock Data & Placeholder Scanner',
    cmd: 'node scripts/check-production-mock-data.js',
    cwd: ROOT,
  },
  {
    name: 'API Contract Cross-Reference Validator',
    cmd: 'pnpm run check:api-contracts',
    cwd: ROOT,
  },
  {
    name: 'Web Component Unit Suites (Vitest)',
    cmd: 'pnpm --filter web test',
    cwd: ROOT,
  },
  {
    name: 'API Certification & Security Suites (Jest in-band)',
    cmd: 'pnpm --filter api exec jest --config ./test/jest-cert.json --runInBand',
    cwd: ROOT,
  },
  {
    name: 'API Domain Unit Test Suites (Jest in-band)',
    cmd: 'pnpm --filter api exec jest --runInBand',
    cwd: ROOT,
  },
];

console.log('========================================================================');
console.log('🚀 JEST POLICY CRM — MASTER REPEATABLE VERIFICATION SUITE');
console.log('========================================================================\n');

let allPassed = true;
const results = [];

for (const check of CHECKS) {
  process.stdout.write(`⏳ Running: ${check.name}... `);
  const t0 = Date.now();
  try {
    const output = execSync(check.cmd, { cwd: check.cwd, stdio: 'pipe' });
    const duration = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`✅ PASS (${duration}s)`);
    results.push({ name: check.name, status: 'PASS', duration: `${duration}s` });
  } catch (err) {
    const duration = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`❌ FAIL (${duration}s)`);
    console.error(err.stdout ? err.stdout.toString() : err.message);
    results.push({ name: check.name, status: 'FAIL', duration: `${duration}s` });
    allPassed = false;
  }
}

console.log('\n========================================================================');
console.log('📊 VERIFICATION SUITE SUMMARY');
console.log('========================================================================');
results.forEach((r, idx) => {
  console.log(`${idx + 1}. [${r.status === 'PASS' ? '✅ PASS' : '❌ FAIL'}] ${r.name} (${r.duration})`);
});
console.log('========================================================================');
console.log(`Final Disposition: ${allPassed ? 'ALL VERIFICATIONS PASSED ✅' : 'FAILURES DETECTED ❌'}`);
console.log('========================================================================\n');

process.exit(allPassed ? 0 : 1);
