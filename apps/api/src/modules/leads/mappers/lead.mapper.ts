import { LeadResponseDto } from '../dto/lead-response.dto';
import { LeadWithRelations } from '../repositories/lead.repository';

export class LeadMapper {
  static toResponse(lead: LeadWithRelations): LeadResponseDto {
    const response = new LeadResponseDto();
    response.id = lead.id;
    response.leadCode = lead.leadCode;
    response.title = lead.title;
    response.source = lead.source;
    response.status = lead.status;
    response.description = lead.description;
    response.contactId = lead.contactId;
    response.accountId = lead.accountId;
    response.assignedToId = lead.assignedToId;
    response.createdById = lead.createdById;
    response.updatedById = lead.updatedById;
    response.createdAt = lead.createdAt;
    response.updatedAt = lead.updatedAt;

    if (lead.contact) {
      response.firstName = lead.contact.firstName;
      response.lastName = lead.contact.lastName;
      response.email = lead.contact.email || undefined;
      response.phone = lead.contact.phone;
      response.contactName = `${lead.contact.firstName} ${lead.contact.lastName}`.trim();
    } else {
      const nameParts = (lead.title || '').split(' - ')[0].trim().split(' ');
      response.firstName = nameParts[0] || 'Prospect';
      response.lastName = nameParts.slice(1).join(' ') || '';
      response.contactName = lead.title;
    }

    if (lead.notes) {
      response.notes = lead.notes.map((n) => ({
        id: n.id,
        content: n.content,
        createdById: n.createdById,
        createdAt: n.createdAt,
      }));
    }

    if (lead.activities) {
      response.activities = lead.activities.map((a) => ({
        id: a.id,
        type: a.type,
        subject: a.subject,
        description: a.description,
        status: a.status,
        dueDate: a.dueDate,
        completedAt: a.completedAt,
        assignedToId: a.assignedToId,
        createdById: a.createdById,
        createdAt: a.createdAt,
      }));
    }

    return response;
  }

  static toResponseList(leads: LeadWithRelations[]): LeadResponseDto[] {
    return leads.map((l) => this.toResponse(l));
  }
}
