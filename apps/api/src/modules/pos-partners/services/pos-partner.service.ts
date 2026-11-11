import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  PosPartnerStatus,
  PosPartnerType,
  PosVerificationStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { PosPartnerRepository } from '../repositories/pos-partner.repository';
import { CreatePosPartnerDto } from '../dto/create-pos-partner.dto';
import { UpdatePosPartnerDto } from '../dto/update-pos-partner.dto';
import { PosPartnerQueryDto } from '../dto/pos-partner-query.dto';
import { UpdatePosStatusDto } from '../dto/pos-status-update.dto';
import type { RequestUser } from '../../auth/decorators/current-user.decorator';
import ExcelJS from 'exceljs';

@Injectable()
export class PosPartnerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: PosPartnerRepository,
  ) {}

  /**
   * Registers a new POS Partner (DEC-01 to DEC-04).
   * - Validates partner type (INDIVIDUAL | CORPORATE)
   * - Enforces unique POS Code per agency tenant
   * - Optionally associates with multiple insurers through insurer-specific mappings
   * - Automatically activates the master record (status: ACTIVE)
   * - Records audit history
   */
  async register(dto: CreatePosPartnerDto, user: RequestUser) {
    const companyId = user.companyId || (user as any).organizationId;

    // 1. Resolve & validate POS Code
    let posCode = dto.posCode?.trim().toUpperCase();
    if (!posCode) {
      const yearMonth = new Date().toISOString().slice(0, 7).replace('-', '');
      const count = await this.prisma.posPartner.count({
        where: { companyId },
      });
      posCode = `POS-${yearMonth}-${String(count + 1).padStart(4, '0')}`;
    }

    const existingCode = await this.repository.findByCode(posCode, companyId);
    if (existingCode) {
      throw new ConflictException({
        code: 'POS_CODE_EXISTS',
        message: `POS Partner with code '${posCode}' already exists in your company`,
      });
    }

    // Insurer mapping is optional. If supplied, it must reference an active Insurer Master record.
    const insurer = dto.insurerId
      ? await this.prisma.insurer.findFirst({ where: { id: dto.insurerId, isActive: true } })
      : null;
    if (dto.insurerId && !insurer) {
      throw new NotFoundException(`Active insurer with ID '${dto.insurerId}' not found`);
    }
    if (dto.initialAgreement && !insurer) {
      throw new BadRequestException('Select an insurer before creating an insurer-specific commission agreement.');
    }
    if (dto.initialAgreement?.insurerId && dto.initialAgreement.insurerId !== insurer?.id) {
      throw new BadRequestException({
        code: 'POS_AGREEMENT_INSURER_MISMATCH',
        message: 'Commission agreement insurer must match the selected insurer mapping.',
      });
    }

    // 3. Transactional registration of PosPartner + PosInsurerMapping + Optional PosCommissionAgreement
    const partner = await this.prisma.$transaction(async (tx) => {
      const rawMobile = dto.mobile || dto.phone || '';
      const created = await tx.posPartner.create({
        data: {
          companyId,
          posCode,
          partnerType: dto.partnerType,
          name: dto.name.trim(),
          displayName: dto.displayName?.trim() || dto.name.trim(),
          mobile: rawMobile.trim(),
          email: dto.email?.trim().toLowerCase() || null,
          registrationNumber: dto.registrationNumber?.trim() || null,
          panNumberEncrypted: dto.panNumber?.trim().toUpperCase() || null,
          status: PosPartnerStatus.ACTIVE, // Automatic activation (DEC-04)
          verificationStatus: PosVerificationStatus.PENDING,
          effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : new Date(),
          effectiveUntil: dto.effectiveUntil ? new Date(dto.effectiveUntil) : null,
          address: dto.address ? (dto.address as any) : undefined,
          createdById: user.id,
          ...(insurer ? {
            insurerMappings: {
              create: {
                companyId,
                insurerId: insurer!.id,
                insurerPartnerCode: dto.insurerPartnerCode?.trim() || null,
                insurerPospId: dto.insurerPospId?.trim() || null,
                effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : new Date(),
                effectiveUntil: dto.effectiveUntil ? new Date(dto.effectiveUntil) : null,
                isActive: true,
              },
            },
          } : {}),
        },
        include: {
          insurerMappings: {
            include: { insurer: true },
          },
        },
      });

      if (dto.initialAgreement) {
        const agreement = await tx.posCommissionAgreement.create({
          data: {
            companyId,
            posPartnerId: created.id,
            insurerId: insurer!.id,
            productType: dto.initialAgreement.productType.toUpperCase(),
            insuranceProductId: dto.initialAgreement.insuranceProductId || null,
            commissionType: dto.initialAgreement.commissionType,
            commissionRate:
              dto.initialAgreement.commissionRate !== undefined
                ? new Prisma.Decimal(dto.initialAgreement.commissionRate)
                : null,
            fixedAmount:
              dto.initialAgreement.fixedAmount !== undefined
                ? new Prisma.Decimal(dto.initialAgreement.fixedAmount)
                : null,
            effectiveFrom: dto.initialAgreement.effectiveFrom
              ? new Date(dto.initialAgreement.effectiveFrom)
              : new Date(),
            effectiveUntil: dto.initialAgreement.effectiveUntil
              ? new Date(dto.initialAgreement.effectiveUntil)
              : null,
            approvalStatus: 'APPROVED',
            approvedById: user.id,
          },
          include: { insurer: true },
        });
        (created as any).commissionAgreements = [agreement];
      }

      return created;
    });

    // 4. Record Audit Event
    await this.prisma.auditLog.create({
      data: {
        action: AuditAction.CREATE,
        entity: 'POS_PARTNER',
        entityType: 'PosPartner',
        entityId: partner.id,
        userId: user.id,
        performedById: user.id,
        module: 'POS_PARTNER',
        metadata: {
          companyId,
          event: 'POS_PARTNER_CREATED',
          posCode: partner.posCode,
          partnerType: partner.partnerType,
          name: partner.name,
          insurerId: insurer?.id || null,
          insurerName: insurer?.name || null,
        },
      },
    }).catch(() => null);

    if (dto.initialAgreement && (partner as any).commissionAgreements?.[0]) {
      const agreement = (partner as any).commissionAgreements[0];
      await this.prisma.auditLog.create({
        data: {
          action: AuditAction.CREATE,
          entity: 'POS_COMMISSION_AGREEMENT',
          entityType: 'PosCommissionAgreement',
          entityId: agreement.id,
          userId: user.id,
          performedById: user.id,
          module: 'POS_PARTNER',
          metadata: {
            companyId,
            event: 'POS_COMMISSION_AGREEMENT_CREATED',
            posPartnerId: partner.id,
            productType: dto.initialAgreement.productType,
            commissionType: dto.initialAgreement.commissionType,
            commissionRate: dto.initialAgreement.commissionRate,
            fixedAmount: dto.initialAgreement.fixedAmount,
          },
        },
      }).catch(() => null);
    }

    return partner;
  }

  async findAll(user: RequestUser, query: PosPartnerQueryDto) {
    const companyId = user.companyId || (user as any).organizationId;
    return this.repository.findMany(companyId, query);
  }

  async findOne(id: string, user: RequestUser) {
    const companyId = user.companyId || (user as any).organizationId;
    const partner = await this.repository.findById(id, companyId);
    if (!partner) {
      throw new NotFoundException(`POS Partner with ID '${id}' not found`);
    }
    return partner;
  }

  async update(id: string, dto: UpdatePosPartnerDto, user: RequestUser) {
    const companyId = user.companyId || (user as any).organizationId;
    const existing = await this.repository.findById(id, companyId);
    if (!existing) {
      throw new NotFoundException(`POS Partner with ID '${id}' not found`);
    }

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.displayName !== undefined) data.displayName = dto.displayName?.trim() || null;
    if (dto.mobile !== undefined) data.mobile = dto.mobile.trim();
    if (dto.email !== undefined) data.email = dto.email?.trim().toLowerCase() || null;
    if (dto.registrationNumber !== undefined) data.registrationNumber = dto.registrationNumber?.trim() || null;
    if (dto.panNumber !== undefined) data.panNumberEncrypted = dto.panNumber?.trim().toUpperCase() || null;
    if (dto.address !== undefined) data.address = dto.address as any;
    if (dto.effectiveFrom !== undefined) data.effectiveFrom = dto.effectiveFrom ? new Date(dto.effectiveFrom) : null;
    if (dto.effectiveUntil !== undefined) data.effectiveUntil = dto.effectiveUntil ? new Date(dto.effectiveUntil) : null;
    data.updatedById = user.id;

    const updated = await this.repository.update(id, data);

    await this.prisma.auditLog.create({
      data: {
        action: AuditAction.UPDATE,
        entity: 'POS_PARTNER',
        entityType: 'PosPartner',
        entityId: id,
        userId: user.id,
        performedById: user.id,
        module: 'POS_PARTNER',
        metadata: {
          companyId,
          event: 'POS_PARTNER_UPDATED',
          posCode: updated.posCode,
          updatedFields: Object.keys(data),
        },
      },
    }).catch(() => null);

    return updated;
  }

  async updateStatus(id: string, dto: UpdatePosStatusDto, user: RequestUser) {
    const companyId = user.companyId || (user as any).organizationId;
    const existing = await this.repository.findById(id, companyId);
    if (!existing) {
      throw new NotFoundException(`POS Partner with ID '${id}' not found`);
    }

    const data: any = { updatedById: user.id };
    let eventName = 'POS_PARTNER_UPDATED';

    if (dto.status) {
      data.status = dto.status;
      if (dto.status === PosPartnerStatus.SUSPENDED) {
        eventName = 'POS_PARTNER_SUSPENDED';
      } else if (dto.status === PosPartnerStatus.ACTIVE) {
        eventName = 'POS_PARTNER_REACTIVATED';
      }
    }

    if (dto.verificationStatus) {
      data.verificationStatus = dto.verificationStatus;
    }

    const updated = await this.repository.update(id, data);

    await this.prisma.auditLog.create({
      data: {
        action: AuditAction.UPDATE,
        entity: 'POS_PARTNER',
        entityType: 'PosPartner',
        entityId: id,
        userId: user.id,
        performedById: user.id,
        module: 'POS_PARTNER',
        metadata: {
          companyId,
          event: eventName,
          posCode: updated.posCode,
          oldStatus: existing.status,
          newStatus: updated.status,
          oldVerificationStatus: existing.verificationStatus,
          newVerificationStatus: updated.verificationStatus,
          reason: dto.reason || 'Status updated by administrator',
        },
      },
    }).catch(() => null);

    return updated;
  }

  async getKpis(user: RequestUser) {
    const companyId = user.companyId || (user as any).organizationId;
    return this.repository.countKpis(companyId);
  }

  async getHistory(id: string, user: RequestUser) {
    const companyId = user.companyId || (user as any).organizationId;
    const partner = await this.repository.findById(id, companyId);
    if (!partner) {
      throw new NotFoundException(`POS Partner with ID '${id}' not found`);
    }

    return this.prisma.auditLog.findMany({
      where: {
        entityType: { in: ['PosPartner', 'PosInsurerMapping', 'PosCommissionAgreement', 'PosPartnerDocument'] },
        OR: [
          { entityId: id },
          {
            metadata: {
              path: ['posPartnerId'],
              equals: id,
            },
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /**
   * Export Agent POS master, issued-policy attribution and audit events for this tenant.
   * Policy snapshots preserve the insurer-side identifiers used when each policy was issued.
   */
  async exportExcel(user: RequestUser): Promise<Buffer> {
    const companyId = user.companyId || (user as any).organizationId;
    if (!companyId) throw new BadRequestException('Company context is required for Agent POS export.');

    const partners = await this.prisma.posPartner.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { posCode: 'asc' },
      include: {
        insurerMappings: {
          include: { insurer: { select: { id: true, name: true, code: true } } },
          orderBy: { createdAt: 'asc' },
        },
        policies: {
          where: { companyId, deletedAt: null },
          orderBy: { createdAt: 'desc' },
          include: { contact: { select: { firstName: true, lastName: true, email: true, phone: true } } },
        },
      },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'JEST Policy CRM';
    workbook.created = new Date();

    const master = workbook.addWorksheet('Agent POS Master');
    master.columns = [
      { header: 'Agent POS Code', key: 'posCode', width: 20 },
      { header: 'Agent POS Name', key: 'name', width: 28 },
      { header: 'Partner Type', key: 'partnerType', width: 16 },
      { header: 'Contact', key: 'mobile', width: 18 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Verification', key: 'verificationStatus', width: 16 },
      { header: 'Insurer', key: 'insurer', width: 30 },
      { header: 'Insurer Code', key: 'insurerCode', width: 16 },
      { header: 'Partner Code at Insurer', key: 'insurerPartnerCode', width: 24 },
      { header: 'Insurer POS ID', key: 'insurerPospId', width: 22 },
      { header: 'Mapping Status', key: 'mappingStatus', width: 16 },
      { header: 'Mapping Effective From', key: 'effectiveFrom', width: 22 },
      { header: 'Mapping Effective Until', key: 'effectiveUntil', width: 22 },
    ];

    const policiesSheet = workbook.addWorksheet('Policy Attribution');
    policiesSheet.columns = [
      { header: 'Agent POS Code', key: 'posCode', width: 20 },
      { header: 'Agent POS Name', key: 'posName', width: 28 },
      { header: 'Partner Code at Insurer', key: 'partnerCode', width: 24 },
      { header: 'Insurer POS ID', key: 'insurerPospId', width: 22 },
      { header: 'Insurer', key: 'insurer', width: 30 },
      { header: 'Insurer Code', key: 'insurerCode', width: 16 },
      { header: 'Policy ID', key: 'policyId', width: 38 },
      { header: 'Policy Number', key: 'policyNumber', width: 24 },
      { header: 'Actual Policy Number', key: 'actualPolicyNumber', width: 24 },
      { header: 'Policy Status', key: 'status', width: 18 },
      { header: 'Product', key: 'product', width: 16 },
      { header: 'Customer', key: 'customer', width: 28 },
      { header: 'Customer Contact', key: 'customerContact', width: 18 },
      { header: 'Customer Email', key: 'customerEmail', width: 30 },
      { header: 'Premium', key: 'premium', width: 16 },
      { header: 'Effective Date', key: 'effectiveDate', width: 18 },
      { header: 'Expiry Date', key: 'expiryDate', width: 18 },
      { header: 'Issued At', key: 'issueDate', width: 20 },
      { header: 'Created At', key: 'createdAt', width: 20 },
    ];

    const activity = workbook.addWorksheet('POS Activity');
    activity.columns = [
      { header: 'Agent POS Code', key: 'posCode', width: 20 },
      { header: 'Agent POS Name', key: 'posName', width: 28 },
      { header: 'Policy Number', key: 'policyNumber', width: 24 },
      { header: 'Entity Type', key: 'entityType', width: 24 },
      { header: 'Action', key: 'action', width: 18 },
      { header: 'Module', key: 'module', width: 18 },
      { header: 'Actor User ID', key: 'actor', width: 38 },
      { header: 'Occurred At', key: 'createdAt', width: 22 },
      { header: 'Details', key: 'details', width: 60 },
    ];

    const partnerById = new Map<string, any>();
    const mappingById = new Map<string, any>();
    const policyById = new Map<string, any>();
    const entityIds: string[] = [];
    for (const partner of partners) {
      partnerById.set(partner.id, partner);
      entityIds.push(partner.id);
      for (const policy of partner.policies) {
        policyById.set(policy.id, { ...policy, partner });
        entityIds.push(policy.id);
      }

      const mappings = partner.insurerMappings || [];
      for (const mapping of mappings.length ? mappings : [null]) {
        if (mapping) {
          mappingById.set(mapping.id, partner);
          entityIds.push(mapping.id);
        }
        master.addRow({
          posCode: partner.posCode, name: partner.name, partnerType: partner.partnerType,
          mobile: partner.mobile, email: partner.email, status: partner.status,
          verificationStatus: partner.verificationStatus, insurer: mapping?.insurer?.name,
          insurerCode: mapping?.insurer?.code, insurerPartnerCode: mapping?.insurerPartnerCode,
          insurerPospId: mapping?.insurerPospId,
          mappingStatus: mapping ? (mapping.isActive ? 'ACTIVE' : 'INACTIVE') : 'NOT MAPPED',
          effectiveFrom: mapping?.effectiveFrom, effectiveUntil: mapping?.effectiveUntil,
        });
      }

      for (const policy of partner.policies) {
        policiesSheet.addRow({
          posCode: partner.posCode, posName: partner.name,
          partnerCode: policy.insurerPartnerCodeSnapshot, insurerPospId: policy.insurerPospIdSnapshot,
          insurer: policy.insurerNameSnapshot, insurerCode: policy.insurerCodeSnapshot,
          policyId: policy.id, policyNumber: policy.policyNumber,
          actualPolicyNumber: policy.actualPolicyNumber, status: policy.status,
          product: policy.policyType || '', customer: [policy.contact?.firstName, policy.contact?.lastName].filter(Boolean).join(' '),
          customerContact: policy.contact?.phone, customerEmail: policy.contact?.email,
          premium: Number(policy.premiumAmount || 0), effectiveDate: policy.effectiveDate,
          expiryDate: policy.expiryDate, issueDate: policy.issueDate, createdAt: policy.createdAt,
        });
      }
    }

    const auditRows = entityIds.length
      ? await this.prisma.auditLog.findMany({
          where: { entityId: { in: entityIds } },
          orderBy: { createdAt: 'desc' },
          take: 10000,
        })
      : [];
    for (const event of auditRows) {
      const policy = policyById.get(event.entityId);
      const partner = partnerById.get(event.entityId) || policy?.partner || mappingById.get(event.entityId);
      if (!partner) continue;
      activity.addRow({
        posCode: partner.posCode, posName: partner.name, policyNumber: policy?.policyNumber || '',
        entityType: event.entityType || event.entity, action: event.action, module: event.module,
        actor: event.performedById || event.userId, createdAt: event.createdAt,
        details: JSON.stringify(event.metadata || {}),
      });
    }

    for (const sheet of [master, policiesSheet, activity]) {
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF14532D' } };
      sheet.views = [{ state: 'frozen', ySplit: 1 }];
      sheet.autoFilter = { from: 'A1', to: { row: 1, column: sheet.columnCount } };
    }
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  /**
   * Ensures an approved Internal / House POS partner exists for direct agency business (DEC-02).
   */
  async ensureHousePosPartner(companyId: string, createdById: string, targetInsurerId?: string) {
    const houseCode = 'POS-HOUSE-DIRECT';
    let house = await this.repository.findByCode(houseCode, companyId);
    if (!house) {
      // Find first active insurer if target not specified
      let insurerId = targetInsurerId;
      if (!insurerId) {
        const firstInsurer = await this.prisma.insurer.findFirst({
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
        });
        insurerId = firstInsurer?.id;
      }

      if (!insurerId) return null;

      house = await this.prisma.posPartner.create({
        data: {
          companyId,
          posCode: houseCode,
          partnerType: PosPartnerType.CORPORATE,
          name: 'Direct Agency House POS',
          displayName: 'House POS (Direct Sales)',
          mobile: '9800000000',
          email: 'direct@agency.internal',
          status: PosPartnerStatus.ACTIVE,
          verificationStatus: PosVerificationStatus.VERIFIED,
          createdById,
          insurerMappings: {
            create: {
              companyId,
              insurerId,
              isActive: true,
            },
          },
        },
        include: { insurerMappings: { include: { insurer: true } } },
      });
    }
    return house;
  }
}
