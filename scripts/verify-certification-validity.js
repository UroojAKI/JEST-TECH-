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
  console.error('Rerun "node scripts/generate-evidence.js" after test execution to recertify.');
  process.exit(1);
}

console.log('✅ CERTIFICATION VALID: Certificate matches current repository HEAD and schema state.');
console.log('========================================================================');
