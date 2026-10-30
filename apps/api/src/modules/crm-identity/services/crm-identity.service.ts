import {
  Injectable,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma } from '@prisma/client';
import {
  IdentityMatch,
  ResolveIdentityParams,
  EnsureIdentityParams,
} from '../interfaces/identity-resolution.interface';

@Injectable()
export class CrmIdentityService {
  private readonly logger = new Logger(CrmIdentityService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Normalizes an email address (trims and converts to lowercase).
   */
  normalizeEmail(email?: string | null): string | null {
    if (!email) return null;
    const trimmed = email.trim().toLowerCase();
    return trimmed.length > 0 ? trimmed : null;
  }

  /**
   * Normalizes a phone number for Indian & international formats.
   * Strips country code +91 or leading 0, removes non-digits, and captures the 10-digit mobile sequence.
   */
  normalizePhone(phone?: string | null): string | null {
    if (!phone) return null;
    let digits = phone.replace(/\D/g, '');
    if (digits.startsWith('91') && digits.length === 12) {
      digits = digits.slice(2);
    } else if (digits.startsWith('0') && digits.length === 11) {
      digits = digits.slice(1);
    }
    return digits.length >= 10 ? digits.slice(-10) : (digits.length > 0 ? digits : null);
  }

  /**
   * Authoritative canonical identity resolution within the authenticated organization.
   * Never silently merges two conflicting identities.
   */
  async resolveIdentity(
    params: ResolveIdentityParams,
    tx?: Prisma.TransactionClient,
  ): Promise<IdentityMatch> {
    const client = tx || this.prisma;
    const { companyId } = params;

    if (!companyId) {
      throw new BadRequestException('Company ID is required for identity resolution');
    }

    const normPhone = this.normalizePhone(params.phone);
    const normEmail = this.normalizeEmail(params.email);

    // 1. Direct Contact ID Resolution
    if (params.contactId) {
      const contact = await client.contact.findFirst({
        where: { id: params.contactId, companyId, deletedAt: null },
        include: { customer: true },
      });
      if (contact) {
        return {
          status: 'MATCH',
          contact,
          customer: contact.customer || null,
          matchedBy: 'CONTACT_ID',
          normalizedPhone: normPhone,
          normalizedEmail: normEmail,
        };
      }
    }

    // 2. Direct Customer ID Resolution
    if (params.customerId) {
      const customer = await client.customer.findFirst({
        where: { id: params.customerId, companyId, deletedAt: null },
        include: { contact: true },
      });
      if (customer) {
        return {
          status: 'MATCH',
          customer,
          contact: customer.contact || null,
          matchedBy: 'CUSTOMER_ID',
          normalizedPhone: normPhone,
          normalizedEmail: normEmail,
        };
      }
    }

    if (!normPhone && !normEmail) {
      return {
        status: 'NEW',
        normalizedPhone: null,
        normalizedEmail: null,
      };
    }

    // 3. Search Contacts
    const contactOrConditions: Prisma.ContactWhereInput[] = [];
    if (normPhone) {
      contactOrConditions.push({ phone: { contains: normPhone } });
      contactOrConditions.push({ alternatePhone: { contains: normPhone } });
    }
    if (normEmail) {
      contactOrConditions.push({
        email: { equals: normEmail, mode: 'insensitive' as const },
      });
    }

    const matchingContacts = await client.contact.findMany({
      where: {
        companyId,
        deletedAt: null,
        OR: contactOrConditions,
      },
      include: { customer: true },
      take: 10,
    });

    // Detect Cross-Person Identity Ambiguity
    if (normPhone && normEmail && matchingContacts.length > 1) {
      const phoneMatches = matchingContacts.filter(
        (c) =>
          (c.phone && this.normalizePhone(c.phone) === normPhone) ||
          (c.alternatePhone && this.normalizePhone(c.alternatePhone) === normPhone),
      );
      const emailMatches = matchingContacts.filter(
        (c) => c.email && this.normalizeEmail(c.email) === normEmail,
      );

      const differentPeople = phoneMatches.some((p) =>
        emailMatches.some((e) => e.id !== p.id),
      );

      if (differentPeople) {
        return {
          status: 'AMBIGUOUS',
          conflictReason: `Conflicting identity: Phone (${normPhone}) and Email (${normEmail}) belong to different existing contacts.`,
          normalizedPhone: normPhone,
          normalizedEmail: normEmail,
        };
      }
    }

    if (matchingContacts.length > 0) {
      const primaryContact = matchingContacts[0];
      let matchedBy: 'PHONE' | 'EMAIL' | 'BOTH' = 'PHONE';
      const pMatch =
        primaryContact.phone && this.normalizePhone(primaryContact.phone) === normPhone;
      const eMatch =
        primaryContact.email && this.normalizeEmail(primaryContact.email) === normEmail;
      if (pMatch && eMatch) matchedBy = 'BOTH';
      else if (eMatch) matchedBy = 'EMAIL';

      let linkedCustomer = primaryContact.customer || null;
      if (!linkedCustomer) {
        linkedCustomer = await client.customer.findFirst({
          where: {
            companyId,
            deletedAt: null,
            OR: [
              { contactId: primaryContact.id },
              ...(normPhone ? [{ mobile: { contains: normPhone } }] : []),
              ...(normEmail
                ? [{ email: { equals: normEmail, mode: 'insensitive' as const } }]
                : []),
            ],
          },
        });
      }

      return {
        status: 'MATCH',
        contact: primaryContact,
        customer: linkedCustomer,
        matchedBy,
        normalizedPhone: normPhone,
        normalizedEmail: normEmail,
      };
    }

    // 4. Search Customers if contact was not found directly
    const customerOrConditions: Prisma.CustomerWhereInput[] = [];
    if (normPhone) {
      customerOrConditions.push({ mobile: { contains: normPhone } });
    }
    if (normEmail) {
      customerOrConditions.push({
        email: { equals: normEmail, mode: 'insensitive' as const },
      });
    }

    const matchingCustomers = await client.customer.findMany({
      where: {
        companyId,
        deletedAt: null,
        OR: customerOrConditions,
      },
      include: { contact: true },
      take: 5,
    });

    if (normPhone && normEmail && matchingCustomers.length > 1) {
      const phoneMatches = matchingCustomers.filter(
        (c) => c.mobile && this.normalizePhone(c.mobile) === normPhone,
      );
      const emailMatches = matchingCustomers.filter(
        (c) => c.email && this.normalizeEmail(c.email) === normEmail,
      );
      const differentCustomers = phoneMatches.some((p) =>
        emailMatches.some((e) => e.id !== p.id),
      );
      if (differentCustomers) {
        return {
          status: 'AMBIGUOUS',
          conflictReason: `Conflicting identity: Phone (${normPhone}) and Email (${normEmail}) belong to different existing customers.`,
          normalizedPhone: normPhone,
          normalizedEmail: normEmail,
        };
      }
    }

    if (matchingCustomers.length > 0) {
      const primaryCustomer = matchingCustomers[0];
      return {
        status: 'MATCH',
        customer: primaryCustomer,
        contact: primaryCustomer.contact || null,
        matchedBy: primaryCustomer.mobile && this.normalizePhone(primaryCustomer.mobile) === normPhone
          ? 'PHONE'
          : 'EMAIL',
        normalizedPhone: normPhone,
        normalizedEmail: normEmail,
      };
    }

    return {
      status: 'NEW',
      normalizedPhone: normPhone,
      normalizedEmail: normEmail,
    };
  }

  /**
   * Atomically ensures linked Contact and optional Customer within a transaction.
   * If identity is ambiguous, throws ConflictException without partial mutation.
   */
  async ensureLinkedContactAndCustomer(
    tx: Prisma.TransactionClient,
    params: EnsureIdentityParams,
  ): Promise<{ contact: any; customer: any }> {
    const match = await this.resolveIdentity(params, tx);

    if (match.status === 'AMBIGUOUS') {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: match.conflictReason || 'Ambiguous identity match across multiple existing records.',
      });
    }

    let contact = match.contact;
    let customer = match.customer;

    const normPhone = match.normalizedPhone || this.normalizePhone(params.phone);
    const normEmail = match.normalizedEmail || this.normalizeEmail(params.email);

    // 1. Ensure Contact exists
    if (!contact) {
      const count = await tx.contact.count({ where: { companyId: params.companyId } });
      let nextNum = count + 1;
      let contactCode = `CONT-${String(nextNum).padStart(6, '0')}`;
      while (await tx.contact.findFirst({ where: { companyId: params.companyId, contactCode } })) {
        nextNum++;
        contactCode = `CONT-${String(nextNum).padStart(6, '0')}`;
      }

      contact = await tx.contact.create({
        data: {
          contactCode,
          companyId: params.companyId,
          firstName: params.firstName.trim(),
          lastName: (params.lastName || '').trim(),
          phone: normPhone,
          email: normEmail,
          panNumber: params.panNumber ? params.panNumber.trim().toUpperCase() : null,
          aadhaarNumber: params.aadhaarNumber || null,
          type: 'INDIVIDUAL',
          status: 'ACTIVE',
          createdById: params.createdById || null,
          updatedById: params.createdById || null,
        },
      });
    }

    // 2. Ensure Customer exists if requested or already matched
    if (customer) {
      if (customer.contactId !== contact.id) {
        customer = await tx.customer.update({
          where: { id: customer.id },
          data: { contactId: contact.id },
        });
      }
    } else if (params.createCustomerIfMissing) {
      const count = await tx.customer.count({ where: { companyId: params.companyId } });
      let nextNum = count + 1;
      let customerCode = `CUST-${String(nextNum).padStart(6, '0')}`;
      while (await tx.customer.findFirst({ where: { companyId: params.companyId, customerCode } })) {
        nextNum++;
        customerCode = `CUST-${String(nextNum).padStart(6, '0')}`;
      }

      customer = await tx.customer.create({
        data: {
          companyId: params.companyId,
          customerCode,
          firstName: params.firstName.trim(),
          lastName: (params.lastName || '').trim() || null,
          mobile: normPhone || params.phone || '',
          email: normEmail,
          panNumber: params.panNumber ? params.panNumber.trim().toUpperCase() : null,
          aadhaarNumber: params.aadhaarNumber || null,
          addressLine1: params.addressLine1 || null,
          addressLine2: params.addressLine2 || null,
          city: params.city || null,
          state: params.state || null,
          pincode: params.pincode || null,
          isVip: params.isVip || false,
          primaryAgentId: params.primaryAgentId || null,
          contactId: contact.id,
          createdById: params.createdById || null,
        },
      });
    }

    return { contact, customer };
  }
}
