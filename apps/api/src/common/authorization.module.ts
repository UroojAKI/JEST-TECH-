import { Global, Module } from '@nestjs/common';
import { ResourceAuthorizationService } from './services/resource-authorization.service';
import { ScopeResolver } from './services/scope-resolver.service';
import { WorkspaceAccessGuard } from './guards/workspace-access.guard';
import { TenantAuthorizationService } from './tenancy/tenant-authorization.service';
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
    TenantAuthorizationService,
    ...POLICIES,
  ],
  exports: [
    ResourceAuthorizationService,
    ScopeResolver,
    WorkspaceAccessGuard,
    TenantAuthorizationService,
    ...POLICIES,
  ],
})
export class AuthorizationModule {}
