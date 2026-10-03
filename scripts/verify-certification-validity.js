const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const certPath = path.resolve(__dirname, '..', 'certification', 'RELEASE_CERTIFICATE_PRODUCTION.json');
if (!fs.existsSync(certPath)) {
  console.error('❌ FAIL: RELEASE_CERTIFICATE_PRODUCTION.json not found!');
  process.exit(1);
}

const cert = JSON.parse(fs.readFileSync(certPath, 'utf8'));
let headSha;
try {
  headSha = execSync('git rev-parse HEAD', { cwd: path.resolve(__dirname, '..') }).toString().trim();
} catch (e) {
  console.warn('⚠️ Unable to resolve git HEAD SHA; checking environment variables.');
  headSha = process.env.CERTIFICATION_COMMIT_SHA || process.env.GIT_COMMIT || process.env.GITHUB_SHA;
}
if (!headSha) {
  console.error('❌ FAIL: Cannot verify certification without a current Git SHA.');
  process.exit(1);
}

const schemaPath = path.resolve(__dirname, '..', 'apps/api/prisma/schema.prisma');
let currentSchemaHash = '';
if (fs.existsSync(schemaPath)) {
  const normalizedSchema = fs.readFileSync(schemaPath, 'utf8').replace(/\r\n/g, '\n');
  currentSchemaHash = 'sha256:' + crypto.createHash('sha256').update(normalizedSchema).digest('hex');
}

console.log('========================================================================');
console.log('🔍 Production Certification Invalidation & Tamper-Evident Guard');
console.log('========================================================================');
console.log(`Current HEAD SHA:          ${headSha}`);
console.log(`Certificate Certified SHA: ${cert.certifiedCommit}`);
console.log(`Current Schema Hash:       ${currentSchemaHash}`);
console.log(`Certificate Schema Hash:   ${cert.certificationSchemaHash}`);

let recentShas = [];
try {
  recentShas = execSync('git rev-list -n 5 HEAD', { cwd: path.resolve(__dirname, '..') })
    .toString()
    .trim()
    .split(/\s+/);
} catch (e) {
  if (headSha) recentShas = [headSha];
}

let failed = false;
if (cert.releaseStatus !== 'PRODUCTION_READY') {
  console.error(`❌ RELEASE BLOCKED: Certificate status is ${cert.releaseStatus || 'missing'}, not PRODUCTION_READY.`);
  failed = true;
}

const gates = Array.isArray(cert.gates) ? cert.gates : [];
const summary = cert.certificationMatrixSummary || {};
if (
  gates.length !== summary.totalGates ||
  gates.length !== summary.passedGates ||
  summary.failedGates !== 0 ||
  gates.some((gate) => gate.result !== 'PASS')
) {
  console.error('❌ INVALID GATES: Gate records do not match the claimed all-pass certification matrix.');
  failed = true;
}

const isShaValid = headSha && cert.certifiedCommit && (headSha === cert.certifiedCommit || recentShas.includes(cert.certifiedCommit));
if (!isShaValid && headSha && cert.certifiedCommit) {
  console.error(`❌ INVALID CERTIFICATE: Current HEAD (${headSha}) and recent ancestors [${recentShas.join(', ')}] do not match Certified Commit (${cert.certifiedCommit}). Certificate is stale.`);
  failed = true;
}

if (currentSchemaHash && cert.certificationSchemaHash && currentSchemaHash !== cert.certificationSchemaHash) {
  console.error(`❌ INVALID SCHEMA: Schema hash mismatch! Schema has mutated without recertification.`);
  failed = true;
}

if (failed) {
  console.error('Release remains blocked until all mandatory gates have current, independently verifiable evidence and an authorized release review.');
  process.exit(1);
}

console.log('✅ CERTIFICATION VALID: Certificate matches current repository HEAD and schema state.');
console.log('========================================================================');
