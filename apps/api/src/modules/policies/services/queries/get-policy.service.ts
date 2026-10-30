import { Injectable, NotFoundException } from '@nestjs/common';

import { PolicyRepository } from '../../repositories/policy.repository';
import { PolicyMapper } from '../../mappers/policy.mapper';
import { ActorContext } from '../../../../common/interfaces/actor-context.interface';
import { ResourceAuthorizationService } from '../../../../common/services/resource-authorization.service';
import { ScopeResolver } from '../../../../common/services/scope-resolver.service';
import { PaginationDto } from '../../../../common/pagination/pagination.dto';
import { PaginatedResponseDto } from '../../../../common/pagination/paginated-response.dto';
import { PrismaService } from '../../../../database/prisma.service';

@Injectable()
export class GetPolicyService {
  constructor(
    private readonly policyRepository: PolicyRepository,
    private readonly authzService: ResourceAuthorizationService,
    private readonly scopeResolver: ScopeResolver,
    private readonly prisma?: PrismaService,
  ) {}

  async executeOne(id: string, user: ActorContext) {
    const policy = await this.policyRepository.findDetail(id);
    if (!policy || policy.deletedAt) {
      throw new NotFoundException(`Policy with ID ${id} not found`);
    }

    // Authoritative Universal Resource Authorization check
    this.authzService.authorize(user, 'POLICY', 'READ', policy);

    const quoteId = policy.quotationId;
    const inspectionId = (policy.quotation as any)?.motorInspection?.id;

    let directDocs: any[] = [];
    if (this.prisma) {
      directDocs = await this.prisma.document.findMany({
        where: {
          deletedAt: null,
          OR: [
            { entityType: 'POLICY', entityId: policy.id },
            ...(quoteId ? [{ entityType: 'QUOTATION', entityId: quoteId }] : []),
            ...(inspectionId ? [{ entityType: 'INSPECTION', entityId: inspectionId }] : []),
          ],
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    return PolicyMapper.toResponse(policy, directDocs);
  }

  async executeAll(pagination: PaginationDto, user: ActorContext) {
    const scopedFilter = this.scopeResolver.resolveScopeFilter(user, 'POLICY');
    const result = await this.policyRepository.findPaginated(
      pagination,
      scopedFilter,
    );
    const page = pagination.page || result.meta?.page || 1;
    const limit = pagination.limit || result.meta?.limit || 25;
    const total = result.meta?.total ?? result.data?.length ?? 0;

    const policyIds = result.data.map((p) => p.id);
    const quoteIds = result.data.map((p) => p.quotationId).filter(Boolean);

    const directDocsMap = new Map<string, any[]>();
    if (this.prisma && (policyIds.length > 0 || quoteIds.length > 0)) {
      const directDocs = await this.prisma.document.findMany({
        where: {
          deletedAt: null,
          OR: [
            ...(policyIds.length > 0
              ? [{ entityType: 'POLICY', entityId: { in: policyIds } }]
              : []),
            ...(quoteIds.length > 0
              ? [{ entityType: 'QUOTATION', entityId: { in: quoteIds } }]
              : []),
          ],
        },
        orderBy: { createdAt: 'desc' },
      });

      // Map documents to policy id
      const quoteToPolicy = new Map<string, string>();
      for (const p of result.data) {
        if (p.quotationId) quoteToPolicy.set(p.quotationId, p.id);
      }

      for (const doc of directDocs) {
        const pId =
          doc.entityType === 'POLICY'
            ? doc.entityId
            : quoteToPolicy.get(doc.entityId || '');
        if (pId) {
          const list = directDocsMap.get(pId) || [];
          list.push(doc);
          directDocsMap.set(pId, list);
        }
      }
    }

    const mappedItems = PolicyMapper.toResponseList(
      result.data as any,
      directDocsMap,
    );
    return new PaginatedResponseDto(
      mappedItems,
      total,
      page,
      limit,
    );
  }
}
