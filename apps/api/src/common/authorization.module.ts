import { Global, Module } from '@nestjs/common';
import { ResourceAuthorizationService } from './services/resource-authorization.service';
import { ScopeResolver } from './services/scope-resolver.service';
import { WorkspaceAccessGuard } from './guards/workspace-access.guard';
import {
  LeadPolicy,
  ContactPolicy,
  QuotationPolicy,
  PolicyPolicy,
  ClaimPolicy,
  DocumentPolicy,
  CommissionPolicy,
  UsersPolicy,
} from './policies';

const POLICIES = [
  LeadPolicy,
  ContactPolicy,
  QuotationPolicy,
  PolicyPolicy,
  ClaimPolicy,
  DocumentPolicy,
  CommissionPolicy,
  UsersPolicy,
];

@Global()
@Module({
  providers: [
    ResourceAuthorizationService,
    ScopeResolver,
    WorkspaceAccessGuard,
    ...POLICIES,
  ],
  exports: [
    ResourceAuthorizationService,
    ScopeResolver,
    WorkspaceAccessGuard,
    ...POLICIES,
  ],
})
export class AuthorizationModule {}
