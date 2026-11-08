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
   * Retrieves the single authoritative insurer mapping for a POS partner.
   */
  async getMapping(posPartnerId: string, companyId: string) {
    const partner = await this.prisma.posPartner.findFirst({
      where: { id: posPartnerId, companyId, deletedAt: null },
    });
    if (!partner) {
      throw new NotFoundException(`POS Partner '${posPartnerId}' not found`);
    }

    const mapping = await this.prisma.posInsurerMapping.findUnique({
      where: { posPartnerId },
      include: {
        insurer: {
          select: { id: true, name: true, code: true, logoUrl: true, isActive: true },
        },
      },
    });

    if (!mapping) {
      throw new NotFoundException(`No insurer mapping found for POS Partner '${posPartnerId}'`);
    }

    return mapping;
  }

  /**
   * Creates or updates the single insurer mapping for a POS partner (DEC-03).
   * One POS partner can have only ONE insurer association. Creating a second mapping is rejected.
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
    const existing = await this.prisma.posInsurerMapping.findUnique({
      where: { posPartnerId },
    });
    if (existing) {
      throw new ConflictException({
        code: 'POS_PARTNER_ALREADY_MAPPED',
        message:
          'A POS partner can be mapped to exactly one insurer. To change insurer, perform an authorized remapping.',
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
        },
      },
    }).catch(() => null);

    return mapping;
  }

  /**
   * Explicit, authorized remapping of a POS partner to a new insurer.
   */
  async remapInsurer(posPartnerId: string, dto: PosInsurerMappingDto, user: RequestUser) {
    const companyId = user.companyId || (user as any).organizationId;

    const partner = await this.prisma.posPartner.findFirst({
      where: { id: posPartnerId, companyId, deletedAt: null },
    });
    if (!partner) {
      throw new NotFoundException(`POS Partner '${posPartnerId}' not found`);
    }

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

    const existing = await this.prisma.posInsurerMapping.findUnique({
      where: { posPartnerId },
      include: { insurer: true },
    });

    const previousInsurer = existing ? existing.insurer.name : 'None';

    const updatedMapping = await this.prisma.posInsurerMapping.upsert({
      where: { posPartnerId },
      create: {
        companyId,
        posPartnerId,
        insurerId: insurer.id,
        insurerPartnerCode: dto.insurerPartnerCode?.trim() || null,
        insurerPospId: dto.insurerPospId?.trim() || null,
        effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : new Date(),
        effectiveUntil: dto.effectiveUntil ? new Date(dto.effectiveUntil) : null,
        isActive: true,
      },
      update: {
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
        action: AuditAction.UPDATE,
        entity: 'POS_INSURER_MAPPING',
        entityType: 'PosInsurerMapping',
        entityId: updatedMapping.id,
        userId: user.id,
        performedById: user.id,
        module: 'POS_PARTNER',
        metadata: {
          companyId,
          event: 'POS_INSURER_REMAPPED',
          posPartnerId,
          posCode: partner.posCode,
          previousInsurer,
          newInsurerId: insurer.id,
          newInsurerName: insurer.name,
          reason: dto.reason || 'Authorized partner remapping',
        },
      },
    }).catch(() => null);

    return updatedMapping;
  }
}
