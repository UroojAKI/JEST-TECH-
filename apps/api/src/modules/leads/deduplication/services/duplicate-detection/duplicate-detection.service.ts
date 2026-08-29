import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../database/prisma.service';

export interface DuplicateMatch {
  entityType: 'CONTACT' | 'ACCOUNT' | 'VEHICLE' | 'LEAD';
  field:
    | 'phone'
    | 'email'
    | 'panNumber'
    | 'registrationNumber'
    | 'aadhaarNumber'
    | 'gstNumber';
  value: string;
  id: string;
  name?: string;
  details?: Record<string, any>;
}

export interface DuplicateCheckResult {
  hasDuplicate: boolean;
  matches: DuplicateMatch[];
  existingContactId?: string;
  existingLeadId?: string;
  message?: string;
  suggestedAction: 'PROCEED' | 'MERGE_OR_REUSE' | 'REJECT';
}

@Injectable()
export class DuplicateDetectionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Comprehensive cross-entity deduplication check across Contacts, Leads, Accounts, and Vehicles.
   */
  async checkDuplicates(data: {
    phone?: string;
    email?: string;
    panNumber?: string;
    aadhaarNumber?: string;
    gstNumber?: string;
    registrationNumber?: string;
  }): Promise<DuplicateCheckResult> {
    const matches: DuplicateMatch[] = [];

    // 1. Check Phone (Contact & Lead)
    if (data.phone) {
      const normalizedPhone = data.phone.trim();
      const existingContact = await this.prisma.contact.findFirst({
        where: { phone: normalizedPhone, deletedAt: null },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          contactCode: true,
        },
      });
      if (existingContact) {
        matches.push({
          entityType: 'CONTACT',
          field: 'phone',
          value: normalizedPhone,
          id: existingContact.id,
          name: `${existingContact.firstName} ${existingContact.lastName}`.trim(),
          details: { contactCode: existingContact.contactCode },
        });
      }

      const existingLead = await this.prisma.lead.findFirst({
        where: { contact: { phone: normalizedPhone }, deletedAt: null },
        select: { id: true, leadCode: true, title: true, status: true },
      });
      if (existingLead) {
        matches.push({
          entityType: 'LEAD',
          field: 'phone',
          value: normalizedPhone,
          id: existingLead.id,
          name: existingLead.title,
          details: {
            leadCode: existingLead.leadCode,
            status: existingLead.status,
          },
        });
      }
    }

    // 2. Check Email (Contact & Lead)
    if (data.email) {
      const normalizedEmail = data.email.trim().toLowerCase();
      const existingContact = await this.prisma.contact.findFirst({
        where: {
          email: { equals: normalizedEmail, mode: 'insensitive' },
          deletedAt: null,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          contactCode: true,
        },
      });
      if (existingContact) {
        matches.push({
          entityType: 'CONTACT',
          field: 'email',
          value: normalizedEmail,
          id: existingContact.id,
          name: `${existingContact.firstName} ${existingContact.lastName}`.trim(),
          details: { contactCode: existingContact.contactCode },
        });
      }

      const existingLead = await this.prisma.lead.findFirst({
        where: {
          contact: { email: { equals: normalizedEmail, mode: 'insensitive' } },
          deletedAt: null,
        },
        select: { id: true, leadCode: true, title: true, status: true },
      });
      if (existingLead) {
        matches.push({
          entityType: 'LEAD',
          field: 'email',
          value: normalizedEmail,
          id: existingLead.id,
          name: existingLead.title,
          details: {
            leadCode: existingLead.leadCode,
            status: existingLead.status,
          },
        });
      }
    }

    // 3. Check PAN (Contact & Account)
    if (data.panNumber) {
      const normalizedPan = data.panNumber.trim().toUpperCase();
      const existingContact = await this.prisma.contact.findFirst({
        where: { panNumber: normalizedPan, deletedAt: null },
        select: { id: true, firstName: true, lastName: true, panNumber: true },
      });
      if (existingContact) {
        matches.push({
          entityType: 'CONTACT',
          field: 'panNumber',
          value: normalizedPan,
          id: existingContact.id,
          name: `${existingContact.firstName} ${existingContact.lastName}`.trim(),
        });
      }

      const existingAccount = await this.prisma.account.findFirst({
        where: { panNumber: normalizedPan, deletedAt: null },
        select: { id: true, name: true, accountCode: true },
      });
      if (existingAccount) {
        matches.push({
          entityType: 'ACCOUNT',
          field: 'panNumber',
          value: normalizedPan,
          id: existingAccount.id,
          name: existingAccount.name,
          details: { accountCode: existingAccount.accountCode },
        });
      }
    }

    // 4. Check Vehicle Registration Number
    if (data.registrationNumber) {
      const normalizedReg = data.registrationNumber
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '');
      const existingVehicle = await this.prisma.vehicle.findFirst({
        where: {
          registrationNumber: { equals: normalizedReg, mode: 'insensitive' },
          deletedAt: null,
        },
        select: {
          id: true,
          registrationNumber: true,
          makeModel: true,
          contactId: true,
        },
      });
      if (existingVehicle) {
        matches.push({
          entityType: 'VEHICLE',
          field: 'registrationNumber',
          value: normalizedReg,
          id: existingVehicle.id,
          name: existingVehicle.makeModel || normalizedReg,
          details: { contactId: existingVehicle.contactId },
        });
      }
    }

    const hasDuplicate = matches.length > 0;
    const contactMatch = matches.find((m) => m.entityType === 'CONTACT');
    const leadMatch = matches.find((m) => m.entityType === 'LEAD');

    return {
      hasDuplicate,
      matches,
      existingContactId: contactMatch?.id,
      existingLeadId: leadMatch?.id,
      message: hasDuplicate
        ? `Found ${matches.length} matching existing record(s). Suggested to link or reuse rather than creating duplicate identity.`
        : 'No duplicate records found.',
      suggestedAction: hasDuplicate ? 'MERGE_OR_REUSE' : 'PROCEED',
    };
  }

  /**
   * Backward-compatible simple method returning first matching lead ID if found.
   */
  async detectDuplicates(leadData: {
    email?: string;
    phone?: string;
    panNumber?: string;
    aadhaarNumber?: string;
    gstNumber?: string;
    registrationNumber?: string;
  }): Promise<string | null> {
    const result = await this.checkDuplicates(leadData);
    return result.existingLeadId || result.existingContactId || null;
  }
}
