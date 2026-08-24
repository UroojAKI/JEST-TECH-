const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

const priorityIndexes = {
  'Lead': [
    '@@index([deletedAt])',
    '@@index([assignedToId])',
    '@@index([contactId])',
    '@@index([accountId])',
    '@@index([createdById])',
    '@@index([organizationId])',
    '@@index([branchId])',
    '@@index([status, assignedToId])'
  ],
  'Policy': [
    '@@index([deletedAt])',
    '@@index([assignedToId])',
    '@@index([contactId])',
    '@@index([accountId])',
    '@@index([createdById])',
    '@@index([organizationId])',
    '@@index([branchId])',
    '@@index([status, expiryDate])',
    '@@index([expiryDate])'
  ],
  'Claim': [
    '@@index([deletedAt])',
    '@@index([assignedToId])',
    '@@index([policyId])',
    '@@index([createdById])'
  ],
  'Task': [
    '@@index([deletedAt])',
    '@@index([assignedToId])'
  ],
  'Activity': [
    '@@index([deletedAt])',
    '@@index([assignedToId])'
  ],
  'Quotation': [
    '@@index([deletedAt])',
    '@@index([contactId])'
  ],
  'Proposal': [
    '@@index([deletedAt])',
    '@@index([contactId])'
  ],
  'Contact': [
    '@@index([deletedAt])',
    '@@index([accountId])',
    '@@index([createdById])'
  ],
  'Account': [
    '@@index([deletedAt])',
    '@@index([createdById])'
  ],
  'Endorsement': [
    '@@index([deletedAt])',
    '@@index([policyId])'
  ],
  'PolicyPayment': [
    '@@index([deletedAt])',
    '@@index([policyId])'
  ],
  'Commission': [
    '@@index([deletedAt])',
    '@@index([policyId])'
  ],
  'User': [
    '@@index([deletedAt])',
    '@@index([organizationId])',
    '@@index([branchId])'
  ],
  'AuditLog': [
    '@@index([deletedAt])',
    '@@index([createdAt])',
    '@@index([userId])'
  ],
  'Notification': [
    '@@index([deletedAt])',
    '@@index([createdAt])',
    '@@index([userId])'
  ],
  'RefreshToken': [
    '@@index([deletedAt])',
    '@@index([userId])'
  ]
};

const lines = schema.split('\n');
let currentModel = null;
let currentFields = new Set();
let outLines = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const modelMatch = line.match(/^model\s+(\w+)\s+\{/);
  
  if (modelMatch) {
    currentModel = modelMatch[1];
    currentFields = new Set();
    outLines.push(line);
    continue;
  }
  
  if (currentModel && line.match(/^\}/)) {
    let missingIndexes = [];
    const fieldsArray = Array.from(currentFields);
    
    if (priorityIndexes[currentModel]) {
       for (const idxStr of priorityIndexes[currentModel]) {
          const match = idxStr.match(/@@index\(\[(.+?)\]\)/);
          if (match) {
             const fields = match[1].split(',').map(s => s.trim());
             const allExist = fields.every(f => currentFields.has(f));
             
             // Check if already in the outLines block for this model
             let alreadyExists = false;
             for (let j = outLines.length - 1; j >= 0; j--) {
               if (outLines[j].includes('model ' + currentModel)) break;
               if (outLines[j].includes(idxStr)) {
                 alreadyExists = true;
                 break;
               }
             }
             if (allExist && !alreadyExists && !missingIndexes.includes(`  ${idxStr}`)) {
                 missingIndexes.push(`  ${idxStr}`);
             }
          }
       }
    }
    
    for (const field of fieldsArray) {
       if (field.endsWith('Id') || field === 'deletedAt') {
          const idxStr = `@@index([${field}])`;
          let alreadyExists = false;
          for (let j = outLines.length - 1; j >= 0; j--) {
            if (outLines[j].includes('model ' + currentModel)) break;
            if (outLines[j].includes(idxStr)) {
              alreadyExists = true;
              break;
            }
          }
          if (!alreadyExists && !missingIndexes.includes(`  ${idxStr}`)) {
              missingIndexes.push(`  ${idxStr}`);
          }
       }
    }
    
    if (missingIndexes.length > 0) {
       outLines.push(...missingIndexes);
    }
    outLines.push(line);
    currentModel = null;
    continue;
  }
  
  if (currentModel) {
    const fieldMatch = line.trim().match(/^([a-zA-Z0-9_]+)\s+/);
    if (fieldMatch && !line.trim().startsWith('//') && !line.trim().startsWith('@@')) {
       currentFields.add(fieldMatch[1]);
    }
    outLines.push(line);
  } else {
    outLines.push(line);
  }
}

fs.writeFileSync(schemaPath, outLines.join('\n'));
console.log('Schema updated successfully');
