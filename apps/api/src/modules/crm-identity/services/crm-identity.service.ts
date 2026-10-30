import {
  Injectable,
  ConflictException,
  BadRequestException,
  ForbiddenException,
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
   * - Strict Indian mobile format: exactly 10 digits starting with 6-9 (/^[6-9]\d{9}$/).
   *   Handles +91, 91, or leading 0 prefix.
   * - E.164 international format: + followed by 7-15 digits (/^\+[1-9]\d{6,14}$/).
   * Returns normalized string (10 digits for Indian numbers, +E.164 for international) or null for invalid.
   */
  normalizePhone(phone?: string | null): string | null {
    if (!phone) return null;
    const trimmed = phone.trim();
    if (!trimmed) return null;

    // Check if international E.164 (starts with '+')
    if (trimmed.startsWith('+')) {
      const digitsOnly = trimmed.slice(1).replace(/\D/g, '');
      // If it starts with +91 (India)
      if (digitsOnly.startsWith('91') && digitsOnly.length === 12) {
        const tenDigits = digitsOnly.slice(2);
        if (/^[6-9]\d{9}$/.test(tenDigits)) {
          return tenDigits;
        }
        return null;
      }
      // General E.164 check: + followed by 7 to 15 digits
      const e164 = `+${digitsOnly}`;
      if (/^\+[1-9]\d{6,14}$/.test(e164)) {
        return e164;
      }
      return null;
    }

    // Non-+ format: strip non-digits
    let digits = trimmed.replace(/\D/g, '');
    if (digits.startsWith('91') && digits.length === 12) {
      digits = digits.slice(2);
    } else if (digits.startsWith('0') && digits.length === 11) {
      digits = digits.slice(1);
    }

    // Strict 10-digit Indian mobile check
    if (/^[6-9]\d{9}$/.test(digits)) {
      return digits;
    }

    return null;
  }

  /**
   * Returns exact query match variants for normalized phone numbers to support
   * legacy records stored with +91, 0, or space prefixes without using substring queries.
   */
  getPhoneVariants(normPhone: string): string[] {
    if (/^[6-9]\d{9}$/.test(normPhone)) {
      return [
        normPhone,
        `+91${normPhone}`,
        `+91 ${normPhone}`,
        `91${normPhone}`,
        `0${normPhone}`,
      ];
    }
    if (normPhone.startsWith('+')) {
      return [normPhone, normPhone.slice(1)];
    }
    return [normPhone];
  }

  /**
   * Authoritative canonical identity resolution within the authenticated organization.
   * Enforces tenant isolation, exact matching, and never silently merges conflicting identities.
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

    // 1. Direct Contact ID Resolution (cross-tenant verification)
    if (params.contactId) {
      const contact = await (client.contact as any).findUnique({
        where: { id: params.contactId },
        include: { customer: true },
      });
      if (contact) {
        if (contact.companyId !== companyId) {
          throw new ForbiddenException('Cross-tenant contact access is strictly forbidden');
        }
        if (!contact.deletedAt) {
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
    }

    // 2. Direct Customer ID Resolution (cross-tenant verification)
    if (params.customerId) {
      const customer = await (client.customer as any).findUnique({
        where: { id: params.customerId },
        include: { contact: true },
      });
      if (customer) {
        if (customer.companyId !== companyId) {
          throw new ForbiddenException('Cross-tenant customer access is strictly forbidden');
        }
        if (!customer.deletedAt) {
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
    }

    if (!normPhone && !normEmail) {
      return {
        status: 'NEW',
        normalizedPhone: null,
        normalizedEmail: null,
      };
    }

    // 3. Search Contacts with exact matching
    const contactOrConditions: Prisma.ContactWhereInput[] = [];
    if (normPhone) {
      const phoneVariants = this.getPhoneVariants(normPhone);
      contactOrConditions.push({ phone: { in: phoneVariants } });
      contactOrConditions.push({ alternatePhone: { in: phoneVariants } });
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

    // Detect Cross-Person Identity Ambiguity on Contacts
    if (matchingContacts.length > 0) {
      if (normPhone && normEmail) {
        const phoneMatches = matchingContacts.filter(
          (c) =>
            (c.phone && this.normalizePhone(c.phone) === normPhone) ||
            (c.alternatePhone && this.normalizePhone(c.alternatePhone) === normPhone),
        );
        const emailMatches = matchingContacts.filter(
          (c) => c.email && this.normalizeEmail(c.email) === normEmail,
        );

        // Different contacts matched phone vs email
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

        // Contact matched phone, but has a different existing non-null email
        for (const p of phoneMatches) {
          const contactEmail = this.normalizeEmail(p.email);
          if (contactEmail && contactEmail !== normEmail) {
            return {
              status: 'AMBIGUOUS',
              conflictReason: `Conflicting identity: Contact with phone (${normPhone}) already exists with a different email (${contactEmail}).`,
              normalizedPhone: normPhone,
              normalizedEmail: normEmail,
            };
          }
        }

        // Contact matched email, but has a different existing non-null phone
        for (const e of emailMatches) {
          const contactPhone = this.normalizePhone(e.phone);
          if (contactPhone && contactPhone !== normPhone) {
            return {
              status: 'AMBIGUOUS',
              conflictReason: `Conflicting identity: Contact with email (${normEmail}) already exists with a different phone (${contactPhone}).`,
              normalizedPhone: normPhone,
              normalizedEmail: normEmail,
            };
          }
        }
      }

      // Check if multiple distinct contacts match the same criteria
      const uniqueContactIds = new Set(matchingContacts.map((c) => c.id));
      if (uniqueContactIds.size > 1) {
        return {
          status: 'AMBIGUOUS',
          conflictReason: `Ambiguous identity: Multiple distinct contacts match the provided criteria (${normPhone || ''} ${normEmail || ''}).`.trim(),
          normalizedPhone: normPhone,
          normalizedEmail: normEmail,
        };
      }

      const primaryContact = matchingContacts[0];
      const pMatch =
        (primaryContact.phone && this.normalizePhone(primaryContact.phone) === normPhone) ||
        (primaryContact.alternatePhone && this.normalizePhone(primaryContact.alternatePhone) === normPhone);
      const eMatch =
        primaryContact.email && this.normalizeEmail(primaryContact.email) === normEmail;

      let matchedBy: 'PHONE' | 'EMAIL' | 'BOTH' = 'PHONE';
      if (pMatch && eMatch) matchedBy = 'BOTH';
      else if (eMatch) matchedBy = 'EMAIL';

      let linkedCustomer = primaryContact.customer || null;
      if (!linkedCustomer) {
        const phoneVariants = normPhone ? this.getPhoneVariants(normPhone) : [];
        linkedCustomer = await client.customer.findFirst({
          where: {
            companyId,
            deletedAt: null,
            OR: [
              { contactId: primaryContact.id },
              ...(normPhone ? [{ mobile: { in: phoneVariants } }] : []),
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
      customerOrConditions.push({ mobile: { in: this.getPhoneVariants(normPhone) } });
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
      take: 10,
    });

    if (matchingCustomers.length > 0) {
      if (normPhone && normEmail) {
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

        // Customer matched phone, but has a different existing non-null email
        for (const p of phoneMatches) {
          const custEmail = this.normalizeEmail(p.email);
          if (custEmail && custEmail !== normEmail) {
            return {
              status: 'AMBIGUOUS',
              conflictReason: `Conflicting identity: Customer with phone (${normPhone}) already exists with a different email (${custEmail}).`,
              normalizedPhone: normPhone,
              normalizedEmail: normEmail,
            };
          }
        }

        // Customer matched email, but has a different existing non-null phone
        for (const e of emailMatches) {
          const custPhone = this.normalizePhone(e.mobile);
          if (custPhone && custPhone !== normPhone) {
            return {
              status: 'AMBIGUOUS',
              conflictReason: `Conflicting identity: Customer with email (${normEmail}) already exists with a different phone (${custPhone}).`,
              normalizedPhone: normPhone,
              normalizedEmail: normEmail,
            };
          }
        }
      }

      // Check if multiple distinct customers match the same criteria
      const uniqueCustomerIds = new Set(matchingCustomers.map((c) => c.id));
      if (uniqueCustomerIds.size > 1) {
        return {
          status: 'AMBIGUOUS',
          conflictReason: `Ambiguous identity: Multiple distinct customers match the provided criteria (${normPhone || ''} ${normEmail || ''}).`.trim(),
          normalizedPhone: normPhone,
          normalizedEmail: normEmail,
        };
      }

      const primaryCustomer = matchingCustomers[0];
      const pMatch =
        primaryCustomer.mobile && this.normalizePhone(primaryCustomer.mobile) === normPhone;
      const eMatch =
        primaryCustomer.email && this.normalizeEmail(primaryCustomer.email) === normEmail;

      let matchedBy: 'PHONE' | 'EMAIL' | 'BOTH' = 'PHONE';
      if (pMatch && eMatch) matchedBy = 'BOTH';
      else if (eMatch) matchedBy = 'EMAIL';

      return {
        status: 'MATCH',
        customer: primaryCustomer,
        contact: primaryCustomer.contact || null,
        matchedBy,
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
   * Generates a globally unique contactCode using PostgreSQL sequence with fallback.
   */
  async generateContactCode(client: any): Promise<string> {
    if (typeof client?.$queryRaw === 'function') {
      try {
        const result = await client.$queryRaw<[{ nextval: bigint }]>`
          SELECT nextval('contact_number_seq')`;
        if (result?.[0]?.nextval !== undefined) {
          return `CONT-${result[0].nextval.toString().padStart(6, '0')}`;
        }
      } catch {
        try {
          if (typeof client.$executeRaw === 'function') {
            await client.$executeRaw`CREATE SEQUENCE IF NOT EXISTS contact_number_seq START 1;`;
            const retry = await client.$queryRaw<[{ nextval: bigint }]>`
              SELECT nextval('contact_number_seq')`;
            if (retry?.[0]?.nextval !== undefined) {
              return `CONT-${retry[0].nextval.toString().padStart(6, '0')}`;
            }
          }
        } catch {
          // Fallback to high-entropy generation below
        }
      }
    }

    const count = (await client.contact?.count?.({ where: {} })) || 0;
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `CONT-${String(count + 1).padStart(6, '0')}-${rand}`;
  }

  /**
   * Generates a globally unique customerCode using PostgreSQL sequence with fallback.
   */
  async generateCustomerCode(client: any): Promise<string> {
    if (typeof client?.$queryRaw === 'function') {
      try {
        const result = await client.$queryRaw<[{ nextval: bigint }]>`
          SELECT nextval('customer_number_seq')`;
        if (result?.[0]?.nextval !== undefined) {
          return `CUST-${result[0].nextval.toString().padStart(6, '0')}`;
        }
      } catch {
        try {
          if (typeof client.$executeRaw === 'function') {
            await client.$executeRaw`CREATE SEQUENCE IF NOT EXISTS customer_number_seq START 1;`;
            const retry = await client.$queryRaw<[{ nextval: bigint }]>`
              SELECT nextval('customer_number_seq')`;
            if (retry?.[0]?.nextval !== undefined) {
              return `CUST-${retry[0].nextval.toString().padStart(6, '0')}`;
            }
          }
        } catch {
          // Fallback to high-entropy generation below
        }
      }
    }

    const count = (await client.customer?.count?.({ where: {} })) || 0;
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `CUST-${String(count + 1).padStart(6, '0')}-${rand}`;
  }

  /**
   * Atomically ensures linked Contact and optional Customer within a transaction.
   * If identity is ambiguous, throws ConflictException without partial mutation.
   * Uses sequence-based code generation and retries on P2002 collision.
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
      let retries = 3;
      while (retries > 0) {
        try {
          const contactCode = await this.generateContactCode(tx);
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
          break;
        } catch (err: any) {
          if (err?.code === 'P2002' && retries > 1) {
            retries--;
            continue;
          }
          throw err;
        }
      }
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
      let retries = 3;
      while (retries > 0) {
        try {
          const customerCode = await this.generateCustomerCode(tx);
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
          break;
        } catch (err: any) {
          if (err?.code === 'P2002' && retries > 1) {
            retries--;
            continue;
          }
          throw err;
        }
      }
    }

    return { contact, customer };
  }
}
