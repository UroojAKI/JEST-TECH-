import { LeadSource, LeadStatus, ActivityType, ActivityStatus } from '@prisma/client';

export class LeadNoteResponseDto {
  id: string;
  content: string;
  createdById: string | null;
  createdAt: Date;
}

export class LeadActivityResponseDto {
  id: string;
  type: ActivityType;
  subject: string;
  description: string | null;
  status: ActivityStatus;
  dueDate: Date | null;
  completedAt: Date | null;
  assignedToId: string | null;
  createdById: string | null;
  createdAt: Date;
}

export class LeadResponseDto {
  id: string;
  leadCode: string;
  title: string;
  source: LeadSource;
  status: LeadStatus;
  description: string | null;
  contactId: string;
  accountId: string | null;
  assignedToId: string | null;
  createdById: string | null;
  updatedById: string | null;
  createdAt: Date;
  updatedAt: Date;

  notes?: LeadNoteResponseDto[];
  activities?: LeadActivityResponseDto[];
}
