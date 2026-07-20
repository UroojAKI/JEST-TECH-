import { Injectable, NotFoundException } from '@nestjs/common';
import { ClaimStatus } from '@prisma/client';
import { ClaimRepository } from '../../repositories/claim.repository';
import { ClaimStateMachine } from '../../domain/claim-state-machine';
import { AssignSurveyorDto } from '../../dto/assign-surveyor.dto';
import { ClaimMapper } from '../../mappers/claim.mapper';

@Injectable()
export class AssignSurveyorService {
  constructor(private readonly claimRepository: ClaimRepository) {}

  async execute(claimId: string, dto: AssignSurveyorDto, updatedById: string) {
    const claim = await this.claimRepository.findById(claimId);
    if (!claim || claim.deletedAt) {
      throw new NotFoundException(`Claim with ID ${claimId} not found`);
    }

    // Validate state transition using ClaimStateMachine
    ClaimStateMachine.validateTransition(
      claim.status,
      ClaimStatus.SURVEYOR_ASSIGNED,
    );

    // Update claim
    const updated = await this.claimRepository.update(claimId, {
      status: ClaimStatus.SURVEYOR_ASSIGNED,
      surveyorName: dto.surveyorName,
      surveyorDetails: dto.surveyorDetails,
      updatedBy: { connect: { id: updatedById } },
    });

    // Record history entry
    await this.claimRepository.addHistoryEntry(
      claimId,
      ClaimStatus.SURVEYOR_ASSIGNED,
      'ASSIGN_SURVEYOR',
      `Surveyor "${dto.surveyorName}" assigned. Details: ${dto.surveyorDetails}`,
      updatedById,
    );

    const finalClaim = await this.claimRepository.findById(claimId);
    return ClaimMapper.toResponse(finalClaim!);
  }
}
