import { Global, Module } from '@nestjs/common';
import { ResourceAuthorizationService } from './services/resource-authorization.service';
import { ScopeResolver } from './services/scope-resolver.service';
import { WorkspaceAccessGuard } from './guards/workspace-access.guard';

@Global()
@Module({
  providers: [
    ResourceAuthorizationService,
    ScopeResolver,
    WorkspaceAccessGuard,
  ],
  exports: [ResourceAuthorizationService, ScopeResolver, WorkspaceAccessGuard],
})
export class AuthorizationModule {}
