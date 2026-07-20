import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { EndorsementType, EndorsementStatus } from '@prisma/client';

@Injectable()
export class EndorsementService {
  constructor(private readonly prisma: PrismaService) {}

  private generateEndNumber(): string {
    return `END-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }

  async getEndorsements() {
    return this.prisma.endorsement.findMany({
      include: { policy: true, requestedBy: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getEndorsementDetails(id: string) {
    const end = await this.prisma.endorsement.findUnique({
      where: { id },
      include: {
        policy: true,
        documents: { include: { document: true } },
        histories: { include: { performedBy: { select: { firstName: true, lastName: true } } } },
      },
    });
    if (!end) {
      throw new NotFoundException('Endorsement not found');
    }
    return end;
  }

  async createEndorsement(policyId: string, type: EndorsementType, reason: string, userId: string) {
    const policy = await this.prisma.policy.findUnique({
      where: { id: policyId },
    });

    if (!policy) {
      throw new NotFoundException('Policy not found');
    }

    const endorsementNumber = this.generateEndNumber();

    const end = await this.prisma.endorsement.create({
      data: {
        endorsementNumber,
        policyId,
        type,
        status: EndorsementStatus.REQUESTED,
        requestedById: userId,
        reason,
      },
    });

    await this.prisma.endorsementHistory.create({
      data: {
        endorsementId: end.id,
        status: EndorsementStatus.REQUESTED,
        comments: `Endorsement requested: ${type}`,
        performedById: userId,
      },
    });

    return end;
  }

  async attachDocument(endorsementId: string, documentId: string) {
    return this.prisma.endorsementDocument.create({
      data: {
        endorsementId,
        documentId,
      },
    });
  }

  async approveEndorsement(id: string, comments: string, reviewerId: string) {
    const end = await this.prisma.endorsement.findUnique({
      where: { id },
      include: { policy: true },
    });

    if (!end) {
      throw new NotFoundException('Endorsement not found');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.endorsement.update({
        where: { id },
        data: {
          status: EndorsementStatus.APPROVED,
          approvedById: reviewerId,
        },
      });

      await tx.endorsementHistory.create({
        data: {
          endorsementId: id,
          status: EndorsementStatus.APPROVED,
          comments: comments || 'Endorsement approved',
          performedById: reviewerId,
        },
      });

      await tx.policyHistory.create({
        data: {
          policyId: end.policyId,
          status: 'ENDORSED',
          comments: `Schedule version archived due to endorsement ${end.endorsementNumber} (${end.type})`,
        },
      });

      const updated = await tx.endorsement.update({
        where: { id },
        data: { status: EndorsementStatus.COMPLETED },
      });

      await tx.endorsementHistory.create({
        data: {
          endorsementId: id,
          status: EndorsementStatus.COMPLETED,
          comments: 'Endorsement completed. Policy schedule regenerated.',
          performedById: reviewerId,
        },
      });

      return { endorsement: updated, status: 'COMPLETED' };
    });
  }
}
