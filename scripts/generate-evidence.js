#!/usr/bin/env node

console.error(
  'Production evidence generation is disabled: this script previously wrote synthetic staging metadata and PASS results.',
);
console.error(
  'Attach dated evidence from the real target environment and complete every mandatory release gate before issuing a new certificate.',
);
process.exitCode = 1;
