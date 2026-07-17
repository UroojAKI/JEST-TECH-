import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, LeadStatus } from '@prisma/client';

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

@Injectable()
export class LeadsService {
  constructor(
    private readonly leadRepository: LeadRepository,
    private readonly contactsService: ContactsService,
    private readonly accountsService: AccountsService,
    private readonly usersService: UsersService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(dto: CreateLeadDto, createdById: string) {
    // Validate Contact exists
    await this.contactsService.findById(dto.contactId);

    // Validate Account exists if provided
    if (dto.accountId) {
      await this.accountsService.findById(dto.accountId);
    }

    // Validate Assigned User exists if provided
    if (dto.assignedToId) {
      const user = await this.usersService.findById(dto.assignedToId);
      if (!user) {
        throw new NotFoundException(`User with ID ${dto.assignedToId} not found`);
      }
    }

    const leadCode = await this.leadRepository.generateLeadCode();

    const leadData: Prisma.LeadCreateInput = {
      leadCode,
      title: dto.title,
      source: dto.source,
      status: dto.status || LeadStatus.NEW,
      description: dto.description,
      contact: { connect: { id: dto.contactId } },
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

  async findAll() {
    const leads = await this.leadRepository.findAll();
    return LeadMapper.toResponseList(leads);
  }

  async findById(id: string) {
    const lead = await this.leadRepository.findById(id);
    if (!lead || lead.deletedAt) {
      throw new NotFoundException(`Lead with ID ${id} not found`);
    }
    return LeadMapper.toResponse(lead);
  }

  async update(id: string, dto: UpdateLeadDto, updatedById: string) {
    const existing = await this.leadRepository.findById(id);
    if (!existing || existing.deletedAt) {
      throw new NotFoundException(`Lead with ID ${id} not found`);
    }

    // Validate Contact exists if provided
    if (dto.contactId && dto.contactId !== existing.contactId) {
      await this.contactsService.findById(dto.contactId);
    }

    // Validate Account exists if provided
    if (dto.accountId && dto.accountId !== existing.accountId) {
      await this.accountsService.findById(dto.accountId);
    }

    // Validate Assigned User exists if provided
    if (dto.assignedToId && dto.assignedToId !== existing.assignedToId) {
      const user = await this.usersService.findById(dto.assignedToId);
      if (!user) {
        throw new NotFoundException(`User with ID ${dto.assignedToId} not found`);
      }
    }

    const { contactId, accountId, assignedToId, ...restDto } = dto;

    const leadData: Prisma.LeadUpdateInput = {
      ...restDto,
      updatedBy: { connect: { id: updatedById } },
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

    const updated = await this.leadRepository.update(id, leadData);
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

    // Fetch updated lead with notes to return
    const updatedLead = await this.leadRepository.findById(id);
    return LeadMapper.toResponse(updatedLead!);
  }

  async createActivity(id: string, dto: CreateActivityDto, createdById: string) {
    const existing = await this.leadRepository.findById(id);
    if (!existing || existing.deletedAt) {
      throw new NotFoundException(`Lead with ID ${id} not found`);
    }

    if (dto.assignedToId) {
      const user = await this.usersService.findById(dto.assignedToId);
      if (!user) {
        throw new NotFoundException(`User with ID ${dto.assignedToId} not found`);
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

    // Convert status
    const updated = await this.leadRepository.update(id, {
      status: LeadStatus.CONVERTED,
      updatedBy: { connect: { id: updatedById } },
    });

    const responseDto = LeadMapper.toResponse(updated);

    // Emit event asynchronously
    this.eventEmitter.emit('lead.converted', new LeadConvertedEvent(responseDto));

    return {
      message: `Lead ${existing.leadCode} converted successfully to quotation.`,
      lead: responseDto,
      // Stub quotation creation details for the frontend and next sprint hook
      quotationStub: {
        contactId: existing.contactId,
        accountId: existing.accountId,
        assignedToId: existing.assignedToId,
        source: existing.source,
      },
    };
  }
}
