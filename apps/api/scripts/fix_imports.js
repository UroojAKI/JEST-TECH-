const fs = require('fs');
const files = [
  'apps/api/src/modules/policies/crons/renewal-scheduler.cron.ts',
  'apps/api/src/modules/policies/processors/renewal-reminder.processor.ts',
  'apps/api/src/modules/policies/services/renewal-engine.service.ts'
];
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/..\/..\/..\/..\/database\/prisma.service/g, '../../../database/prisma.service');
  fs.writeFileSync(file, content);
}
