import { Injectable, NotFoundException } from '@nestjs/common';
import { ClaimRepository } from '../../repositories/claim.repository';
import { ClaimMapper } from '../../mappers/claim.mapper';

@Injectable()
export class UploadClaimDocumentService {
  constructor(private readonly claimRepository: ClaimRepository) {}

  async execute(
    claimId: string,
    dto: { documentType: string; fileKey: string; fileName: string; fileSize: number },
    uploadedById: string,
  ) {
    const claim = await this.claimRepository.findById(claimId);
    if (!claim || claim.deletedAt) {
      throw new NotFoundException(`Claim with ID ${claimId} not found`);
    }

    await this.claimRepository.addDocument({
      claim: { connect: { id: claimId } },
      documentType: dto.documentType,
      fileKey: dto.fileKey,
      fileName: dto.fileName,
      fileSize: dto.fileSize,
      uploadedById,
    });

    await this.claimRepository.addHistoryEntry(
      claimId,
      claim.status,
      'DOCUMENT_UPLOAD',
      `Document "${dto.fileName}" of type ${dto.documentType} uploaded.`,
      uploadedById,
    );

    const updated = await this.claimRepository.findById(claimId);
    return ClaimMapper.toResponse(updated!);
  }
}
