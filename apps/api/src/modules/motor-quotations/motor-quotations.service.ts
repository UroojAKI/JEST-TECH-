import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  RoleType,
  Prisma,
  MotorQuotationStatus,
  LeadStatus,
} from '@prisma/client';
import { CreateMotorQuotationDto } from './dto/create-motor-quotation.dto';
import { MotorQuotationQueryDto } from './dto/motor-quotation-query.dto';
import { LeadLifecycleService } from '../leads/services/lead-lifecycle.service';
import { getCategoryConfig } from '../motor/config/category-registry';
import { VehicleCategoryKey } from '../motor/config/types';
import type { RequestUser } from '../auth/decorators/current-user.decorator';

@Injectable()
export class MotorQuotationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly leadLifecycleService: LeadLifecycleService,
  ) {}

  private async generateQuotationNumber(): Promise<string> {
    try {
      const result = await this.prisma.$queryRaw<[{ nextval: bigint }]>`
        SELECT nextval('motor_quotation_number_seq')`;
      return `MQT-${result[0].nextval.toString().padStart(6, '0')}`;
    } catch {
      await this.prisma
        .$executeRaw`CREATE SEQUENCE IF NOT EXISTS motor_quotation_number_seq START 1;`;
      const retry = await this.prisma.$queryRaw<[{ nextval: bigint }]>`
        SELECT nextval('motor_quotation_number_seq')`;
      return `MQT-${retry[0].nextval.toString().padStart(6, '0')}`;
    }
  }

  async create(dto: CreateMotorQuotationDto, user: RequestUser) {
    // 1. Verify Lead and Vehicle
    const [lead, vehicle] = await Promise.all([
      this.prisma.lead.findUnique({
        where: { id: dto.leadId },
        include: { agent: true },
      }),
      this.prisma.vehicle.findUnique({
        where: { id: dto.vehicleId },
      }),
    ]);

    if (!lead || lead.deletedAt) {
      throw new NotFoundException(`Lead with ID ${dto.leadId} not found`);
    }
    if (!vehicle || vehicle.deletedAt) {
      throw new NotFoundException(`Vehicle with ID ${dto.vehicleId} not found`);
    }

    // 2. Resolve Agent and Snapshot
    let agentId = lead.agentId;
    let agentCodeSnapshot: string | null = lead.agent?.agentCode || null;

    if (user.role === RoleType.AGENT) {
      const agentProfile = await this.prisma.agent.findUnique({
        where: { userId: user.id },
      });
      if (agentProfile) {
        agentId = agentProfile.id;
        agentCodeSnapshot = agentProfile.agentCode;
      }
    }

    const customerId = lead.customerId || vehicle.customerId || null;
    const companyId =
      lead.companyId || user.companyId || (user as any).organizationId;
    if (!companyId) {
      throw new ForbiddenException('Tenant organizational context is required');
    }

    // 3. Generate sequential quotation number: MQT-XXXXXX
    const quotationNumber = await this.generateQuotationNumber();

    // 4. Create MotorQuotation
    const quotation = await this.prisma.motorQuotation.create({
      data: {
        companyId,
        quotationNumber,
        leadId: dto.leadId,
        vehicleId: dto.vehicleId,
        customerId,
        agentId,
        agentCodeSnapshot,
        insurerName: dto.insurerName,
        planName: dto.planName || null,
        policyType: dto.policyType,
        status: MotorQuotationStatus.DRAFT,
        idv: dto.idv !== undefined ? new Prisma.Decimal(dto.idv) : null,
        odPremium:
          dto.odPremium !== undefined
            ? new Prisma.Decimal(dto.odPremium)
            : null,
        tpPremium:
          dto.tpPremium !== undefined
            ? new Prisma.Decimal(dto.tpPremium)
            : null,
        addonPremium:
          dto.addonPremium !== undefined
            ? new Prisma.Decimal(dto.addonPremium)
            : null,
        ncbDiscount:
          dto.ncbDiscount !== undefined
            ? new Prisma.Decimal(dto.ncbDiscount)
            : null,
        otherDiscounts:
          dto.otherDiscounts !== undefined
            ? new Prisma.Decimal(dto.otherDiscounts)
            : null,
        netPremium:
          dto.netPremium !== undefined
            ? new Prisma.Decimal(dto.netPremium)
            : null,
        gstAmount:
          dto.gstAmount !== undefined
            ? new Prisma.Decimal(dto.gstAmount)
            : null,
        finalPremium: new Prisma.Decimal(dto.finalPremium),
        breakup: dto.breakup
          ? (dto.breakup as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        addonsSelected: dto.addonsSelected
          ? (dto.addonsSelected as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        createdById: user.id,
      },
      include: {
        lead: {
          select: { id: true, leadCode: true, title: true, status: true },
        },
        vehicle: {
          select: {
            id: true,
            registrationNumber: true,
            category: true,
            make: true,
            model: true,
            variant: true,
          },
        },
      },
    });

    return quotation;
  }

  async findAll(query: MotorQuotationQueryDto, user: RequestUser) {
    const {
      page = 1,
      limit = 25,
      vehicleId,
      leadId,
      customerId,
      status,
      insurerName,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;
    const skip = (page - 1) * limit;

    const companyId = user.companyId || (user as any).organizationId;
    if (!companyId) {
      throw new ForbiddenException('Tenant organizational context is required');
    }

    const where: Prisma.MotorQuotationWhereInput = {
      companyId,
      deletedAt: null,
    };

    if (user.role === RoleType.AGENT) {
      const agent = await this.prisma.agent.findUnique({
        where: { userId: user.id },
      });
      if (agent) {
        where.agentId = agent.id;
      } else {
        where.createdById = user.id;
      }
    }

    if (vehicleId) where.vehicleId = vehicleId;
    if (leadId) where.leadId = leadId;
    if (customerId) where.customerId = customerId;
    if (status) where.status = status;
    if (insurerName) {
      where.insurerName = { contains: insurerName, mode: 'insensitive' };
    }

    // 1. Query canonical Quotation where productType = 'MOTOR'
    const quotationWhere: Prisma.QuotationWhereInput = {
      companyId,
      productType: 'MOTOR',
      deletedAt: null,
    };
    if (vehicleId) quotationWhere.vehicleId = vehicleId;
    if (leadId) quotationWhere.leadId = leadId;
    if (customerId) quotationWhere.contactId = customerId;
    if (status) quotationWhere.status = status as any;

    const [canonicalQuotes, canonicalTotal] = await Promise.all([
      this.prisma.quotation.findMany({
        where: quotationWhere,
        skip,
        take: limit,
        orderBy: { [sortBy === 'quotationNumber' ? 'quotationCode' : sortBy]: sortOrder },
        include: {
          lead: {
            select: { id: true, leadCode: true, title: true, status: true },
          },
          vehicle: {
            select: {
              id: true,
              registrationNumber: true,
              category: true,
              make: true,
              model: true,
            },
          },
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
        },
      }),
      this.prisma.quotation.count({ where: quotationWhere }),
    ]);

    if (canonicalTotal > 0) {
      const mapped = canonicalQuotes.map((q) => {
        const snap = (q.calculationSnapshot as any)?.pricing || {};
        return {
          id: q.id,
          quotationNumber: q.quotationCode,
          leadId: q.leadId || '',
          vehicleId: q.vehicleId || '',
          customerId: q.contactId,
          agentId: q.agentId,
          agentCodeSnapshot: (q.motorMetadata as any)?.agentCodeSnapshot || null,
          insurerName: snap.insurerName || 'Authoritative Insurer',
          planName: (q.motorMetadata as any)?.planName || null,
          policyType: q.policyType || 'COMPREHENSIVE',
          status: q.status as any,
          idv: snap.idv ? Number(snap.idv) : null,
          odPremium: snap.odPremium ? Number(snap.odPremium) : null,
          tpPremium: snap.tpPremium ? Number(snap.tpPremium) : null,
          addonPremium: snap.addonPremium ? Number(snap.addonPremium) : null,
          ncbDiscount: snap.ncbDiscount ? Number(snap.ncbDiscount) : null,
          otherDiscounts: null,
          netPremium: snap.netPremium ? Number(snap.netPremium) : null,
          gstAmount: snap.gstAmount ? Number(snap.gstAmount) : null,
          finalPremium: Number(q.totalPremium || 0),
          breakup: snap.breakup || null,
          addonsSelected: (q.motorMetadata as any)?.addonsSelected || null,
          vehicle: q.vehicle
            ? {
                id: q.vehicle.id,
                registrationNumber: q.vehicle.registrationNumber,
                category: q.vehicle.category,
                make: q.vehicle.make,
                model: q.vehicle.model,
              }
            : undefined,
          lead: q.lead
            ? {
                id: q.lead.id,
                leadCode: q.lead.leadCode,
                title: q.lead.title,
                status: q.lead.status,
              }
            : undefined,
          customer: q.contact
            ? {
                id: q.contact.id,
                customerCode: q.contact.id.slice(0, 8),
                firstName: q.contact.firstName,
                lastName: q.contact.lastName,
                mobile: q.contact.phone || '',
              }
            : undefined,
          createdAt: q.createdAt.toISOString(),
        };
      });

      return {
        data: mapped,
        meta: {
          page,
          limit,
          total: canonicalTotal,
          totalPages: Math.ceil(canonicalTotal / limit),
        },
      };
    }

    // 2. Fallback to legacy MotorQuotation records
    const [quotations, total] = await Promise.all([
      this.prisma.motorQuotation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          lead: {
            select: { id: true, leadCode: true, title: true, status: true },
          },
          vehicle: {
            select: {
              id: true,
              registrationNumber: true,
              category: true,
              make: true,
              model: true,
            },
          },
          customer: {
            select: {
              id: true,
              customerCode: true,
              firstName: true,
              lastName: true,
              mobile: true,
            },
          },
        },
      }),
      this.prisma.motorQuotation.count({ where }),
    ]);

    return {
      data: quotations,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string, user: RequestUser) {
    const companyId = user.companyId || (user as any).organizationId;
    if (!companyId) {
      throw new ForbiddenException('Tenant organizational context is required');
    }

    // 1. Try canonical Quotation first
    const canonicalQuote = await this.prisma.quotation.findFirst({
      where: { id, companyId, productType: 'MOTOR', deletedAt: null },
      include: {
        lead: true,
        vehicle: true,
        contact: true,
        agent: true,
        policy: true,
        proposal: true,
      },
    });

    if (canonicalQuote) {
      if (user.role === RoleType.AGENT) {
        const agent = await this.prisma.agent.findUnique({
          where: { userId: user.id },
        });
        if (agent && canonicalQuote.agentId && canonicalQuote.agentId !== agent.id) {
          throw new ForbiddenException(
            'You are not authorized to view this quotation',
          );
        }
      }

      const snap = (canonicalQuote.calculationSnapshot as any)?.pricing || {};
      const categoryKey = (canonicalQuote.vehicle?.category ||
        'PRIVATE_CAR') as VehicleCategoryKey;
      const categoryConfig = getCategoryConfig(categoryKey);

      return {
        id: canonicalQuote.id,
        quotationNumber: canonicalQuote.quotationCode,
        leadId: canonicalQuote.leadId,
        vehicleId: canonicalQuote.vehicleId,
        customerId: canonicalQuote.contactId,
        agentId: canonicalQuote.agentId,
        companyId: canonicalQuote.companyId,
        insurerName: snap.insurerName || 'Authoritative Insurer',
        policyType: canonicalQuote.policyType,
        status: canonicalQuote.status,
        idv: snap.idv ? Number(snap.idv) : null,
        odPremium: snap.odPremium ? Number(snap.odPremium) : null,
        tpPremium: snap.tpPremium ? Number(snap.tpPremium) : null,
        finalPremium: Number(canonicalQuote.totalPremium || 0),
        breakup: snap.breakup || null,
        vehicle: canonicalQuote.vehicle,
        lead: canonicalQuote.lead,
        customer: canonicalQuote.contact,
        agent: canonicalQuote.agent,
        policy: canonicalQuote.policy,
        categoryConfig,
        createdAt: canonicalQuote.createdAt.toISOString(),
      };
    }

    // 2. Fallback to legacy MotorQuotation
    const quotation = await this.prisma.motorQuotation.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        lead: true,
        vehicle: true,
        customer: true,
        agent: true,
        policy: true,
        backOfficeTasks: true,
        inspections: true,
      },
    });

    if (!quotation) {
      throw new NotFoundException(`Motor Quotation ${id} not found`);
    }

    if (user.role === RoleType.AGENT) {
      const agent = await this.prisma.agent.findUnique({
        where: { userId: user.id },
      });
      if (agent && quotation.agentId && quotation.agentId !== agent.id) {
        throw new ForbiddenException(
          'You are not authorized to view this quotation',
        );
      }
    }

    const categoryKey = (quotation.vehicle?.category ||
      'PRIVATE_CAR') as VehicleCategoryKey;
    const categoryConfig = getCategoryConfig(categoryKey);

    return {
      ...quotation,
      categoryConfig,
    };
  }

  async compareQuotes(vehicleId: string, user: RequestUser) {
    const companyId = user.companyId || (user as any).organizationId;
    if (!companyId) {
      throw new ForbiddenException('Tenant organizational context is required');
    }

    const where: Prisma.MotorQuotationWhereInput = {
      vehicleId,
      companyId,
      deletedAt: null,
    };

    if (user.role === RoleType.AGENT) {
      const agent = await this.prisma.agent.findUnique({
        where: { userId: user.id },
      });
      if (agent) {
        where.agentId = agent.id;
      } else {
        where.createdById = user.id;
      }
    }

    const quotes = await this.prisma.motorQuotation.findMany({
      where,
      orderBy: { finalPremium: 'asc' },
      include: {
        lead: { select: { id: true, leadCode: true, status: true } },
        vehicle: {
          select: {
            id: true,
            registrationNumber: true,
            category: true,
            make: true,
            model: true,
          },
        },
      },
    });

    if (quotes.length === 0) {
      return {
        vehicleId,
        count: 0,
        bestPrice: null,
        comparison: [],
      };
    }

    const prices = quotes.map((q) => Number(q.finalPremium));
    const lowest = Math.min(...prices);
    const highest = Math.max(...prices);
    const average = (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(
      2,
    );

    return {
      vehicleId,
      count: quotes.length,
      bestPrice: lowest,
      highestPrice: highest,
      averagePrice: Number(average),
      comparison: quotes.map((q) => ({
        id: q.id,
        quotationNumber: q.quotationNumber,
        insurerName: q.insurerName,
        planName: q.planName,
        status: q.status,
        idv: q.idv ? Number(q.idv) : null,
        odPremium: q.odPremium ? Number(q.odPremium) : null,
        tpPremium: q.tpPremium ? Number(q.tpPremium) : null,
        addonPremium: q.addonPremium ? Number(q.addonPremium) : null,
        ncbDiscount: q.ncbDiscount ? Number(q.ncbDiscount) : null,
        netPremium: q.netPremium ? Number(q.netPremium) : null,
        gstAmount: q.gstAmount ? Number(q.gstAmount) : null,
        finalPremium: Number(q.finalPremium),
        isLowest: Number(q.finalPremium) === lowest,
        addonsSelected: q.addonsSelected,
      })),
    };
  }

  async acceptQuotation(id: string, user: RequestUser) {
    const quote = await this.prisma.motorQuotation.findFirst({
      where: { id, deletedAt: null },
      include: { lead: true },
    });

    if (!quote) {
      throw new NotFoundException(`Motor Quotation ${id} not found`);
    }

    if (quote.status === MotorQuotationStatus.ACCEPTED) {
      return { message: 'Quotation is already accepted', quote };
    }

    // Accept selected quote and reject all other quotes for the same vehicle in a transaction
    await this.prisma.$transaction(async (tx) => {
      // 1. Mark target quotation ACCEPTED
      await tx.motorQuotation.update({
        where: { id },
        data: { status: MotorQuotationStatus.ACCEPTED },
      });

      // 2. Mark other competing quotes for this vehicle as REJECTED
      await tx.motorQuotation.updateMany({
        where: {
          vehicleId: quote.vehicleId,
          companyId: quote.companyId,
          id: { not: id },
          status: {
            in: [MotorQuotationStatus.DRAFT, MotorQuotationStatus.SHARED],
          },
        },
        data: { status: MotorQuotationStatus.REJECTED },
      });
    });

    // 3. Move Lead forward to CUSTOMER_ACCEPTED stage if applicable
    if (
      quote.lead &&
      quote.leadId &&
      quote.lead.status !== LeadStatus.CUSTOMER_ACCEPTED &&
      quote.lead.status !== LeadStatus.CONVERTED
    ) {
      try {
        await this.leadLifecycleService.transition(
          quote.leadId,
          LeadStatus.CUSTOMER_ACCEPTED,
          user,
          `Customer accepted quotation ${quote.quotationNumber} from ${quote.insurerName}`,
        );
      } catch (err: any) {
        // Soft error tolerance if lead stage was already past or incompatible
      }
    }

    return {
      success: true,
      message: `Quotation ${quote.quotationNumber} from ${quote.insurerName} accepted successfully.`,
      quotationId: id,
      finalPremium: quote.finalPremium,
      nextStep: 'PAYMENT_AND_COMPLETION',
    };
  }
}
