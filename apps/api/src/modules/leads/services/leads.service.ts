import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, LeadStatus, LeadSource } from '@prisma/client';

import { LeadMapper } from '../mappers/lead.mapper';
import { LeadRepository } from '../repositories/lead.repository';
import { CreateLeadDto } from '../dto/create-lead.dto';
import { UpdateLeadDto } from '../dto/update-lead.dto';
import { CreateNoteDto } from '../dto/create-note.dto';
import { CreateActivityDto } from '../dto/create-activity.dto';

import { ContactsService } from '../../contacts/services/contacts.service';
import { AccountsService } from '../../accounts/services/accounts.service';
import { UsersService } from '../../users/services/users.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LeadConvertedEvent } from '../events/lead-converted.event';
import { ActorContext } from '../../../common/interfaces/actor-context.interface';
import { ResourceAuthorizationService } from '../../../common/services/resource-authorization.service';
import { ScopeResolver } from '../../../common/services/scope-resolver.service';
import { PrismaService } from '../../../database/prisma.service';
import { PaginationDto } from '../../../common/pagination/pagination.dto';
import { PaginatedResponseDto } from '../../../common/pagination/paginated-response.dto';

@Injectable()
export class LeadsService {
  constructor(
    private readonly leadRepository: LeadRepository,
    private readonly contactsService: ContactsService,
    private readonly accountsService: AccountsService,
    private readonly usersService: UsersService,
    private readonly eventEmitter: EventEmitter2,
    private readonly prisma: PrismaService,
    private readonly authzService: ResourceAuthorizationService,
    private readonly scopeResolver: ScopeResolver,
  ) {}

  async create(dto: CreateLeadDto, createdById: string) {
    let targetContactId = dto.contactId;

    if (targetContactId) {
      try {
        await this.contactsService.findById(targetContactId);
      } catch {
        targetContactId = undefined;
      }
    }

    if (!targetContactId) {
      let existingContact: any = null;
      if (dto.phone) {
        existingContact = await this.prisma.contact.findFirst({
          where: { phone: dto.phone, deletedAt: null },
        });
      }
      if (!existingContact && dto.email) {
        existingContact = await this.prisma.contact.findFirst({
          where: { email: dto.email, deletedAt: null },
        });
      }

      if (existingContact) {
        targetContactId = existingContact.id;
      } else {
        const createdContact = await this.contactsService.create(
          {
            firstName:
              dto.firstName ||
              (dto.title ? dto.title.split(' ')[0] : 'Prospect'),
            lastName: dto.lastName || '',
            email: dto.email || `prospect_${Date.now()}@jestpolicy.com`,
            phone:
              dto.phone ||
              `${Math.floor(1000000000 + Math.random() * 9000000000)}`,
            type: 'INDIVIDUAL',
          },
          createdById,
        );
        targetContactId = createdContact.id;
      }
    }

    // Validate Account exists if provided
    if (dto.accountId) {
      await this.accountsService.findById(dto.accountId);
    }

    // Validate Assigned User exists if provided
    if (dto.assignedToId) {
      const user = await this.usersService.findById(dto.assignedToId);
      if (!user) {
        throw new NotFoundException(
          `User with ID ${dto.assignedToId} not found`,
        );
      }
    }

    const leadCode = await this.leadRepository.generateLeadCode();
    const leadTitle =
      dto.title ||
      `${dto.firstName || 'Prospect'} ${dto.lastName || ''} - ${dto.productInterest || 'Comprehensive Lead'}`.trim();

    const validSources: Record<string, LeadSource> = {
      WALK_IN: LeadSource.WALK_IN,
      REFERRAL: LeadSource.REFERRAL,
      WEBSITE: LeadSource.DIGITAL,
      FACEBOOK: LeadSource.DIGITAL,
      GOOGLE: LeadSource.CAMPAIGN,
      WHATSAPP: LeadSource.DIGITAL,
      EXISTING_CUSTOMER: LeadSource.CROSS_SELL,
      DEALER: LeadSource.ADVISOR,
      COLD_CALL: LeadSource.OTHER,
      SOCIAL_MEDIA: LeadSource.DIGITAL,
      CAMPAIGN: LeadSource.CAMPAIGN,
      PARTNER: LeadSource.ADVISOR,
      OTHER: LeadSource.OTHER,
    };
    const mappedSource = dto.source
      ? validSources[String(dto.source).toUpperCase()] || LeadSource.OTHER
      : LeadSource.DIGITAL;

    const leadData: Prisma.LeadCreateInput = {
      leadCode,
      title: leadTitle,
      source: mappedSource,
      status: dto.status || LeadStatus.NEW,
      description:
        dto.description ||
        [
          dto.remarks ? `Remarks: ${dto.remarks}` : '',
          dto.city ? `City: ${dto.city}` : '',
          dto.productInterest ? `Interest: ${dto.productInterest}` : '',
          dto.source ? `Orig. Source: ${dto.source}` : '',
        ]
          .filter(Boolean)
          .join(' | ') ||
        undefined,
      contact: { connect: { id: targetContactId } },
      createdBy: { connect: { id: createdById } },
      updatedBy: { connect: { id: createdById } },
    };

    if (dto.accountId) {
      leadData.account = { connect: { id: dto.accountId } };
    }

    if (dto.assignedToId) {
      leadData.assignedTo = { connect: { id: dto.assignedToId } };
    }

    const lead = await this.leadRepository.create(leadData);
    return LeadMapper.toResponse(lead);
  }

  async findAll(user: ActorContext, pagination: PaginationDto) {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = pagination;
    const skip = (page - 1) * limit;

    const scopedFilter = this.scopeResolver.resolveScopeFilter(user, 'LEAD');

    const searchWhere: Prisma.LeadWhereInput = search
      ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const where: Prisma.LeadWhereInput = {
      ...scopedFilter,
      ...searchWhere,
    };

    const [leads, total] = await Promise.all([
      this.leadRepository.findAll(where, skip, limit, { [sortBy]: sortOrder }),
      this.leadRepository.count(where),
    ]);

    return new PaginatedResponseDto(
      LeadMapper.toResponseList(leads),
      total,
      page,
      limit,
    );
  }

  async findById(id: string, user: ActorContext) {
    const lead = await this.leadRepository.findById(id);
    if (!lead || lead.deletedAt) {
      throw new NotFoundException(`Lead with ID ${id} not found`);
    }

    // Authoritative Universal Resource Authorization check
    this.authzService.authorize(user, 'LEAD', 'READ', lead);

    return LeadMapper.toResponse(lead);
  }

  async update(id: string, dto: UpdateLeadDto, user: ActorContext) {
    const existing = await this.leadRepository.findById(id);
    if (!existing || existing.deletedAt) {
      throw new NotFoundException(`Lead with ID ${id} not found`);
    }

    // Authoritative Universal Resource Authorization check
    this.authzService.authorize(user, 'LEAD', 'UPDATE', existing);

    // State machine transition validation (Contract 02 §1)
    if (dto.status && dto.status !== existing.status) {
      const allowedTransitions: Record<string, string[]> = {
        NEW: ['CONTACTED', 'QUALIFIED', 'LOST', 'UNQUALIFIED'],
        CONTACTED: ['QUALIFIED', 'LOST', 'UNQUALIFIED'],
        QUALIFIED: ['CONVERTED', 'LOST', 'CONTACTED'],
        CONVERTED: [],
        LOST: ['NEW'],
        UNQUALIFIED: ['NEW'],
      };
      const allowed = allowedTransitions[existing.status] || [];
      if (!allowed.includes(dto.status)) {
        throw new BadRequestException(
          `Invalid state transition from ${existing.status} to ${dto.status}. Allowed transitions: ${allowed.join(', ') || 'none (terminal state)'}`,
        );
      }
    }

    // Validate Contact exists if provided
    if (dto.contactId && dto.contactId !== existing.contactId) {
      await this.contactsService.findById(dto.contactId);
    }

    // Validate Account exists if provided
    if (dto.accountId && dto.accountId !== existing.accountId) {
      await this.accountsService.findById(dto.accountId);
    }

    // Validate Lead Reassignment permission
    if (dto.assignedToId && dto.assignedToId !== existing.assignedToId) {
      this.authzService.authorize(user, 'LEAD', 'ASSIGN', existing);
      const targetUser = await this.usersService.findById(dto.assignedToId);
      if (!targetUser) {
        throw new NotFoundException(
          `User with ID ${dto.assignedToId} not found`,
        );
      }
    }

    const {
      contactId,
      accountId,
      assignedToId,
      city,
      remarks,
      source,
      ...restDto
    } = dto;
    const actorId = user.userId || (user as any).id;

    const leadData: Prisma.LeadUpdateInput = {
      ...restDto,
      updatedBy: { connect: { id: actorId } },
    };

    if (source !== undefined) {
      const validSources: Record<string, LeadSource> = {
        WALK_IN: LeadSource.WALK_IN,
        REFERRAL: LeadSource.REFERRAL,
        WEBSITE: LeadSource.DIGITAL,
        FACEBOOK: LeadSource.DIGITAL,
        GOOGLE: LeadSource.CAMPAIGN,
        WHATSAPP: LeadSource.DIGITAL,
        EXISTING_CUSTOMER: LeadSource.CROSS_SELL,
        DEALER: LeadSource.ADVISOR,
        COLD_CALL: LeadSource.OTHER,
        SOCIAL_MEDIA: LeadSource.DIGITAL,
        CAMPAIGN: LeadSource.CAMPAIGN,
        PARTNER: LeadSource.ADVISOR,
        OTHER: LeadSource.OTHER,
      };
      leadData.source =
        validSources[String(source).toUpperCase()] || LeadSource.OTHER;
    }

    if (remarks !== undefined || city !== undefined) {
      const extraInfo = [
        remarks ? `Remarks: ${remarks}` : '',
        city ? `City: ${city}` : '',
      ]
        .filter(Boolean)
        .join(' | ');
      if (extraInfo) {
        leadData.description = restDto.description
          ? `${restDto.description} | ${extraInfo}`
          : extraInfo;
      }
    }

    if (contactId) {
      leadData.contact = { connect: { id: contactId } };
    }

    if (accountId !== undefined) {
      if (accountId) {
        leadData.account = { connect: { id: accountId } };
      } else {
        leadData.account = { disconnect: true };
      }
    }

    if (assignedToId !== undefined) {
      if (assignedToId) {
        leadData.assignedTo = { connect: { id: assignedToId } };
      } else {
        leadData.assignedTo = { disconnect: true };
      }
    }

    const updated = await this.leadRepository.update(id, leadData, dto.version);
    return LeadMapper.toResponse(updated);
  }

  async remove(id: string, deletedById: string) {
    const existing = await this.leadRepository.findById(id);
    if (!existing || existing.deletedAt) {
      throw new NotFoundException(`Lead with ID ${id} not found`);
    }

    await this.leadRepository.softDelete(id, deletedById);
    return { message: `Lead ${id} has been deleted` };
  }

  async assign(id: string, assignedToId: string, updatedById: string) {
    const existing = await this.leadRepository.findById(id);
    if (!existing || existing.deletedAt) {
      throw new NotFoundException(`Lead with ID ${id} not found`);
    }

    const user = await this.usersService.findById(assignedToId);
    if (!user) {
      throw new NotFoundException(`User with ID ${assignedToId} not found`);
    }

    const updated = await this.leadRepository.update(id, {
      assignedTo: { connect: { id: assignedToId } },
      updatedBy: { connect: { id: updatedById } },
    });

    return LeadMapper.toResponse(updated);
  }

  async addNote(id: string, dto: CreateNoteDto, createdById: string) {
    const existing = await this.leadRepository.findById(id);
    if (!existing || existing.deletedAt) {
      throw new NotFoundException(`Lead with ID ${id} not found`);
    }

    await this.leadRepository.addNote(id, dto.content, createdById);

    const updatedLead = await this.leadRepository.findById(id);
    return LeadMapper.toResponse(updatedLead!);
  }

  async createActivity(
    id: string,
    dto: CreateActivityDto,
    createdById: string,
  ) {
    const existing = await this.leadRepository.findById(id);
    if (!existing || existing.deletedAt) {
      throw new NotFoundException(`Lead with ID ${id} not found`);
    }

    if (dto.assignedToId) {
      const user = await this.usersService.findById(dto.assignedToId);
      if (!user) {
        throw new NotFoundException(
          `User with ID ${dto.assignedToId} not found`,
        );
      }
    }

    const activityData: Prisma.ActivityCreateWithoutLeadInput = {
      type: dto.type,
      subject: dto.subject,
      description: dto.description,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      createdBy: { connect: { id: createdById } },
    };

    if (dto.assignedToId) {
      activityData.assignedTo = { connect: { id: dto.assignedToId } };
    }

    await this.leadRepository.createActivity(id, activityData);

    const updatedLead = await this.leadRepository.findById(id);
    return LeadMapper.toResponse(updatedLead!);
  }

  async convert(id: string, updatedById: string) {
    const existing = await this.leadRepository.findById(id);
    if (!existing || existing.deletedAt) {
      throw new NotFoundException(`Lead with ID ${id} not found`);
    }

    if (existing.status === LeadStatus.CONVERTED) {
      throw new BadRequestException('Lead is already converted');
    }

    if (
      existing.status === LeadStatus.LOST ||
      existing.status === LeadStatus.UNQUALIFIED
    ) {
      throw new BadRequestException(
        `Cannot convert a lead in ${existing.status} state. Only active leads can be converted.`,
      );
    }

    const updated = await this.leadRepository.update(id, {
      status: LeadStatus.CONVERTED,
      updatedBy: { connect: { id: updatedById } },
    });

    const responseDto = LeadMapper.toResponse(updated);

    this.eventEmitter.emit(
      'lead.converted',
      new LeadConvertedEvent(responseDto),
    );

    return {
      message: `Lead ${existing.leadCode} converted successfully to quotation.`,
      lead: responseDto,
      quotationStub: {
        contactId: existing.contactId,
        accountId: existing.accountId,
        assignedToId: existing.assignedToId,
        source: existing.source,
      },
    };
  }

  async getLeadContext(id: string, user: ActorContext) {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: {
        contact: {
          include: {
            vehicles: {
              where: { deletedAt: null },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        account: true,
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!lead || lead.deletedAt) {
      throw new NotFoundException(`Lead with ID ${id} not found`);
    }

    this.authzService.authorize(user, 'LEAD', 'READ', lead);

    const vehicle = lead.contact?.vehicles?.[0] || null;

    return {
      leadId: lead.id,
      leadCode: lead.leadCode,
      title: lead.title,
      status: lead.status,
      source: lead.source,
      description: lead.description,
      contact: lead.contact
        ? {
            id: lead.contact.id,
            contactCode: lead.contact.contactCode,
            firstName: lead.contact.firstName,
            middleName: lead.contact.middleName,
            lastName: lead.contact.lastName,
            fullName:
              `${lead.contact.firstName || ''} ${lead.contact.lastName || ''}`.trim(),
            email: lead.contact.email,
            phone: lead.contact.phone,
            panNumber: lead.contact.panNumber,
            gender: lead.contact.gender,
            dateOfBirth: lead.contact.dateOfBirth,
          }
        : null,
      account: lead.account
        ? {
            id: lead.account.id,
            accountCode: lead.account.accountCode,
            name: lead.account.name,
            gstNumber: lead.account.gstNumber,
            panNumber: lead.account.panNumber,
          }
        : null,
      vehicle: vehicle
        ? {
            id: vehicle.id,
            registrationNumber: vehicle.registrationNumber,
            category: vehicle.category,
            makeModel: vehicle.makeModel,
            fuelType: vehicle.fuelType,
            manufactureYearMonth: vehicle.manufactureYearMonth,
            dateOfRegistration: vehicle.dateOfRegistration,
            engineNumber: vehicle.engineNumber,
            chassisNumber: vehicle.chassisNumber,
            rtoLocation: vehicle.rtoLocation,
            categorySpecificData: vehicle.categorySpecificData,
          }
        : null,
      assignedTo: lead.assignedTo,
    };
  }

  /**
   * Consolidates duplicate leads by migrating all quotations, activities, and notes
   * to the target lead and marking the source lead as merged (LEAD-002).
   */
  async mergeLeads(
    targetLeadId: string,
    sourceLeadId: string,
    actorId: string,
  ) {
    if (targetLeadId === sourceLeadId) {
      throw new BadRequestException('Cannot merge a lead into itself.');
    }

    const [targetLead, sourceLead] = await Promise.all([
      this.leadRepository.findById(targetLeadId),
      this.leadRepository.findById(sourceLeadId),
    ]);

    if (!targetLead || targetLead.deletedAt) {
      throw new NotFoundException(`Target lead ${targetLeadId} not found`);
    }
    if (!sourceLead || sourceLead.deletedAt) {
      throw new NotFoundException(`Source lead ${sourceLeadId} not found`);
    }

    await this.prisma.$transaction(async (tx) => {
      // Re-link quotations from source to target
      await tx.quotation.updateMany({
        where: { leadId: sourceLeadId },
        data: { leadId: targetLeadId },
      });

      // Re-link activities from source to target
      await tx.activity.updateMany({
        where: { leadId: sourceLeadId },
        data: { leadId: targetLeadId },
      });

      // Re-link notes from source to target
      await tx.note.updateMany({
        where: { leadId: sourceLeadId },
        data: { leadId: targetLeadId },
      });

      // Mark source lead as merged / soft-deleted
      await tx.lead.update({
        where: { id: sourceLeadId },
        data: {
          status: LeadStatus.LOST,
          description: `${sourceLead.description || ''} [Merged into ${targetLead.leadCode}]`.trim(),
          deletedAt: new Date(),
        },
      });

      // Record history on target lead
      await tx.activity.create({
        data: {
          leadId: targetLeadId,
          type: 'TASK',
          subject: 'Lead Deduplication Merge',
          description: `Consolidated record by merging duplicate lead ${sourceLead.leadCode} (${sourceLead.title}) into this record.`,
          dueDate: new Date(),
          createdById: actorId,
        },
      });
    });

    const consolidated = await this.leadRepository.findById(targetLeadId);
    return LeadMapper.toResponse(consolidated!);
  }
}
