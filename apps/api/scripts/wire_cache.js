const fs = require('fs');

function wire(file) {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('RedisCacheService')) return; // Already wired
  
  content = content.replace(
    "import { PrismaService } from '../../../../database/prisma.service';",
    "import { PrismaService } from '../../../../database/prisma.service';\nimport { CACHE_PROVIDER_TOKEN } from '../../../platform/cache/cache.provider';\nimport { RedisCacheService } from '../../../platform/cache/redis-cache.service';\nimport { Inject } from '@nestjs/common';"
  );
  
  content = content.replace(
    "private readonly prisma: PrismaService,",
    "private readonly prisma: PrismaService,\n    @Inject(CACHE_PROVIDER_TOKEN) private readonly cache: RedisCacheService,"
  );

  // For issue policy
  if (file.includes('issue-policy')) {
     content = content.replace(
       "return policy;",
       "const cacheContactId = dto.contactId || (quotation ? quotation.contactId : null);\n    if (cacheContactId) { await this.cache.clear(`customer360:${cacheContactId}`); }\n    return policy;"
     );
  }
  
  // For report claim
  if (file.includes('report-claim')) {
     content = content.replace(
       "return claim;",
       "const cacheContactId = policy ? policy.contactId : null;\n    if (cacheContactId) { await this.cache.clear(`customer360:${cacheContactId}`); }\n    return claim;"
     );
  }

  fs.writeFileSync(file, content);
}

wire('apps/api/src/modules/policies/services/commands/issue-policy.service.ts');
wire('apps/api/src/modules/claims/services/commands/report-claim.service.ts');
