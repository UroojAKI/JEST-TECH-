import { Injectable, NotFoundException } from '@nestjs/common';
import { ClaimRepository } from '../../repositories/claim.repository';
import { ClaimMapper } from '../../mappers/claim.mapper';

@Injectable()
export class GetClaimsService {
  constructor(private readonly claimRepository: ClaimRepository) {}

  async executeOne(id: string) {
    const claim = await this.claimRepository.findById(id);
    if (!claim || claim.deletedAt) {
      throw new NotFoundException(`Claim with ID ${id} not found`);
    }
    return ClaimMapper.toResponse(claim);
  }

  async executeAll() {
    const claims = await this.claimRepository.findAll();
    return ClaimMapper.toResponseList(claims);
  }
}
