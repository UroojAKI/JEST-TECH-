#!/usr/bin/env node

/**
 * CI Quality Gate: Production Mock Data & Anti-Pattern AST/Regex Scanner
 * F-036 Architecture Guard
 *
 * Scans all production source files in apps/web and apps/api to ensure
 * no mock data, artificial delays, fake random generators, or forbidden storage
 * patterns exist in production code paths.
 */

const fs = require('fs');
const path = require('path');

const SCAN_DIRS = [
  path.resolve(__dirname, '../apps/web/src'),
  path.resolve(__dirname, '../apps/api/src'),
];

const IGNORE_PATTERNS = [
  /\.spec\.ts$/,
  /\.spec\.tsx$/,
  /\.test\.ts$/,
  /\.test\.tsx$/,
  /node_modules/,
  /\.next/,
  /dist/,
  /coverage/,
  /mocks/,
  /fixtures/,
];

const PROHIBITED_RULES = [
  {
    name: 'Artificial Async Delay with Randomness',
    regex: /setTimeout\s*\([^)]*Math\.random/,
    description: 'Artificial network latency simulation using setTimeout and Math.random() is forbidden in production code.',
  },
  {
    name: 'Hardcoded Mock Data Declarations',
    regex: /(?:const|let|var)\s+(?:MOCK_DATA|DEMO_DATA|MOCK_QUOTES|FAKE_LEADS)\s*=/i,
    description: 'Static mock or demo arrays must not be declared in production code paths.',
  },
  {
    name: 'Sensitive Entity LocalStorage Persistence',
    regex: /localStorage\.(?:setItem|getItem|removeItem)\s*\(['"](?:quotation|policy|lead|branch|financial|payment|claim|auth_token)/i,
    description: 'Sensitive tenant entities and auth tokens must not be persisted in unencrypted browser localStorage.',
  },
  {
    name: 'Stub PDF Generator in Production',
    regex: /\bgeneratePdfStub\s*\(/,
    description: 'Stub PDF generation must not be called in production code.',
  },
];

function scanDirectory(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (IGNORE_PATTERNS.some((pattern) => pattern.test(fullPath))) {
      continue;
    }

    if (entry.isDirectory()) {
      scanDirectory(fullPath, fileList);
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      fileList.push(fullPath);
    }
  }

  return fileList;
}

function run() {
  console.log('=================================================================');
  console.log('🛡️  CI Guard: Production Source & Mock Data Scanner (F-036)');
  console.log('=================================================================');

  const files = [];
  for (const dir of SCAN_DIRS) {
    scanDirectory(dir, files);
  }

  console.log(`Scanning ${files.length} production source files...`);

  let totalViolations = 0;

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip single line or block comments
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
        continue;
      }

      for (const rule of PROHIBITED_RULES) {
        if (rule.regex.test(line)) {
          console.error(`❌ [PROHIBITED PATTERN] ${rule.name}`);
          console.error(`   File: ${path.relative(process.cwd(), file)}:${i + 1}`);
          console.error(`   Line: ${trimmed}`);
          console.error(`   Reason: ${rule.description}\n`);
          totalViolations++;
        }
      }
    }
  }

  if (totalViolations > 0) {
    console.error(`🚨 FAILED: Detected ${totalViolations} prohibited mock/data-safety pattern violations.`);
    process.exit(1);
  }

  console.log('✅ PASSED: Zero prohibited mock data or unsafe persistence patterns detected.');
  console.log('=================================================================\n');
}

run();
