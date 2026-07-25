import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
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
import type { RequestUser } from '../../auth/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class LeadsService {
  constructor(
    private readonly leadRepository: LeadRepository,
    private readonly contactsService: ContactsService,
    private readonly accountsService: AccountsService,
    private readonly usersService: UsersService,
    private readonly eventEmitter: EventEmitter2,
    private readonly prisma: PrismaService,
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
            firstName: dto.firstName || (dto.title ? dto.title.split(' ')[0] : 'Prospect'),
            lastName: dto.lastName || '',
            email: dto.email || `prospect_${Date.now()}@jestpolicy.com`,
            phone: dto.phone || `${Math.floor(1000000000 + Math.random() * 9000000000)}`,
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
    const leadTitle = dto.title || `${dto.firstName || 'Prospect'} ${dto.lastName || ''} - ${dto.productInterest || 'Comprehensive Lead'}`.trim();

    const leadData: Prisma.LeadCreateInput = {
      leadCode,
      title: leadTitle,
      source: dto.source || LeadSource.WEBSITE,
      status: dto.status || LeadStatus.NEW,
      description: dto.description || (dto.productInterest ? `Interest: ${dto.productInterest}` : undefined),
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

  async findAll(user: RequestUser) {
    const where: Prisma.LeadWhereInput =
      user.role === 'SALES_AGENT'
        ? { OR: [{ assignedToId: user.id }, { createdById: user.id }] }
        : {};
    const leads = await this.leadRepository.findAll(where);
    return LeadMapper.toResponseList(leads);
  }

  async findById(id: string, user: RequestUser) {
    const lead = await this.leadRepository.findById(id);
    if (!lead || lead.deletedAt) {
      throw new NotFoundException(`Lead with ID ${id} not found`);
    }

    // BOLA ownership verification
    if (
      user.role === 'SALES_AGENT' &&
      lead.assignedToId !== user.id &&
      lead.createdById !== user.id
    ) {
      throw new ForbiddenException(
        'You do not have permission to access this lead',
      );
    }

    return LeadMapper.toResponse(lead);
  }

  async update(id: string, dto: UpdateLeadDto, user: RequestUser) {
    const existing = await this.leadRepository.findById(id);
    if (!existing || existing.deletedAt) {
      throw new NotFoundException(`Lead with ID ${id} not found`);
    }

    // BOLA ownership verification
    if (
      user.role === 'SALES_AGENT' &&
      existing.assignedToId !== user.id &&
      existing.createdById !== user.id
    ) {
      throw new ForbiddenException(
        'You do not have permission to update this lead',
      );
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
      if (user.role === 'SALES_AGENT') {
        throw new ForbiddenException(
          'Sales agents are not authorized to reassign lead ownership. Lead reassignment requires Branch Manager or Admin role.',
        );
      }
      const targetUser = await this.usersService.findById(dto.assignedToId);
      if (!targetUser) {
        throw new NotFoundException(
          `User with ID ${dto.assignedToId} not found`,
        );
      }
    }

    const { contactId, accountId, assignedToId, ...restDto } = dto;

    const leadData: Prisma.LeadUpdateInput = {
      ...restDto,
      updatedBy: { connect: { id: user.id } },
    };

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
}
