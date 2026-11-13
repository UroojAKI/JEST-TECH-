import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { PosInsurerMappingDto } from '../dto/pos-insurer-mapping.dto';
import type { RequestUser } from '../../auth/decorators/current-user.decorator';

@Injectable()
export class PosInsurerMappingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves all insurer-specific mappings for an Agent POS partner.
   */
  async getMapping(posPartnerId: string, companyId: string) {
    const partner = await this.prisma.posPartner.findFirst({
      where: { id: posPartnerId, companyId, deletedAt: null },
    });
    if (!partner) {
      throw new NotFoundException(`POS Partner '${posPartnerId}' not found`);
    }

    const mappings = await this.prisma.posInsurerMapping.findMany({
      where: { posPartnerId, companyId },
      include: {
        insurer: {
          select: { id: true, name: true, code: true, logoUrl: true, isActive: true },
        },
      },
    });

    if (!mappings.length) {
      throw new NotFoundException(`No insurer mappings found for POS Partner '${posPartnerId}'`);
    }

    return mappings;
  }

  /**
   * Adds an insurer-specific mapping to an Agent POS partner. Duplicate mappings for the same insurer are rejected.
   */
  async createMapping(posPartnerId: string, dto: PosInsurerMappingDto, user: RequestUser) {
    const companyId = user.companyId || (user as any).organizationId;

    const partner = await this.prisma.posPartner.findFirst({
      where: { id: posPartnerId, companyId, deletedAt: null },
    });
    if (!partner) {
      throw new NotFoundException(`POS Partner '${posPartnerId}' not found`);
    }

    // Check if an insurer mapping already exists
    const existing = await this.prisma.posInsurerMapping.findFirst({
      where: { posPartnerId, insurerId: dto.insurerId, companyId },
    });
    if (existing) {
      throw new ConflictException({
        code: 'POS_PARTNER_ALREADY_MAPPED',
        message:
          'This Agent POS is already mapped to the selected insurer.',
      });
    }

    // Verify insurer exists and is active
    const insurer = await this.prisma.insurer.findUnique({
      where: { id: dto.insurerId },
    });
    if (!insurer) {
      throw new NotFoundException(`Insurer with ID '${dto.insurerId}' not found`);
    }
    if (!insurer.isActive) {
      throw new BadRequestException({
        code: 'POS_INSURER_INACTIVE',
        message: `Insurer '${insurer.name}' is inactive and cannot be mapped to a POS partner`,
      });
    }

    const mapping = await this.prisma.posInsurerMapping.create({
      data: {
        companyId,
        posPartnerId,
        insurerId: insurer.id,
        insurerPartnerCode: dto.insurerPartnerCode?.trim() || null,
        insurerPospId: dto.insurerPospId?.trim() || null,
        effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : new Date(),
        effectiveUntil: dto.effectiveUntil ? new Date(dto.effectiveUntil) : null,
        isActive: true,
      },
      include: { insurer: true },
    });

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        action: AuditAction.CREATE,
        entity: 'POS_INSURER_MAPPING',
        entityType: 'PosInsurerMapping',
        entityId: mapping.id,
        userId: user.id,
        performedById: user.id,
        module: 'POS_PARTNER',
        metadata: {
          companyId,
          event: 'POS_INSURER_MAPPED',
          posPartnerId,
          posCode: partner.posCode,
          insurerId: insurer.id,
          insurerName: insurer.name,
          reason: dto.reason || 'Agent POS insurer registration',
          insurerPartnerCode: mapping.insurerPartnerCode,
          insurerPospId: mapping.insurerPospId,
        },
      },
    }).catch(() => null);

    return mapping;
  }

  /**
   * Explicit, authorized remapping of a POS partner to a new insurer.
   */
  async remapInsurer(posPartnerId: string, dto: PosInsurerMappingDto, user: RequestUser) {
    // Backward-compatible endpoint: add a new insurer-specific mapping instead of replacing
    // the partner's other insurer registrations.
    return this.createMapping(posPartnerId, dto, user);
  }
}
