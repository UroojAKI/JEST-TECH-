import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ClaimRepository } from '../../repositories/claim.repository';
import { ClaimMapper } from '../../mappers/claim.mapper';
import type { RequestUser } from '../../../auth/decorators/current-user.decorator';

@Injectable()
export class GetClaimsService {
  constructor(private readonly claimRepository: ClaimRepository) {}

  async executeOne(id: string, user: RequestUser) {
    const claim = await this.claimRepository.findById(id);
    if (!claim || claim.deletedAt) {
      throw new NotFoundException(`Claim with ID ${id} not found`);
    }

    // BOLA ownership verification
    if (user.role === 'SALES_AGENT' && claim.createdById !== user.id) {
      throw new ForbiddenException('You do not have permission to access this claim');
    }

    return ClaimMapper.toResponse(claim);
  }

  async executeAll(user: RequestUser) {
    const where = user.role === 'SALES_AGENT' ? { createdById: user.id } : {};
    const claims = await this.claimRepository.findAll(where);
    return ClaimMapper.toResponseList(claims);
  }
}
