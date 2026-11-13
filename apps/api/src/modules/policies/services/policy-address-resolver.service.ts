import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { PolicyAddressDto } from '../dto/policy-address.dto';

export interface AddressResolutionResult {
  address: PolicyAddressDto;
  addressSource:
    | 'EXPLICIT_POLICY_INPUT'
    | 'QUOTATION_SNAPSHOT'
    | 'CUSTOMER_PROFILE'
    | 'CONTACT_PROFILE'
    | 'CASE_SNAPSHOT'
    | 'FALLBACK';
  addressCapturedAt: Date;
  isValid: boolean;
  missingFields: string[];
}

@Injectable()
export class PolicyAddressResolverService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolves structured customer address according to strict precedence rules:
   * 1. Explicit policy-stage address (DTO)
   * 2. Accepted quotation address snapshot
   * 3. Saved quotation proposer metadata
   * 4. Linked customer profile
   * 5. Linked contact profile
   * 6. Applicable health/motor case snapshot
   */
  async resolveAddress(
    quotationId: string,
    explicitAddressDto?: Partial<PolicyAddressDto> | string,
  ): Promise<AddressResolutionResult> {
    const quotation = await this.prisma.quotation.findUnique({
      where: { id: quotationId },
      include: {
        contact: {
          include: {
            customer: true,
          },
        },
      },
    });

    if (!quotation) {
      throw new BadRequestException(`Quotation ${quotationId} not found`);
    }

    const capturedAt = new Date();
    let resolved: Partial<PolicyAddressDto> = {};
    let source: AddressResolutionResult['addressSource'] = 'FALLBACK';

    // 1. Explicit policy-stage input
    if (explicitAddressDto) {
      if (typeof explicitAddressDto === 'string' && explicitAddressDto.trim()) {
        resolved = this.parseUnstructuredAddress(explicitAddressDto.trim());
        source = 'EXPLICIT_POLICY_INPUT';
      } else if (typeof explicitAddressDto === 'object' && Object.keys(explicitAddressDto).length > 0) {
        resolved = { ...explicitAddressDto };
        source = 'EXPLICIT_POLICY_INPUT';
      }
    }

    // 2. Accepted quotation address snapshot or metadata
    const quoteMeta = (quotation.motorMetadata as any) || {};
    const proposer = quoteMeta.proposerDetails || (quotation as any).proposerDetails || {};
    const healthMeta = (quotation as any).healthMetadata || {};

    if (!this.isComplete(resolved)) {
      const quoteAddr =
        proposer.addressLine1 ||
        proposer.communicationAddress ||
        proposer.address ||
        healthMeta.communicationAddress ||
        healthMeta.address;

      const quotePincode =
        proposer.pincode ||
        proposer.pinCode ||
        healthMeta.pincode ||
        healthMeta.pinCode;

      const quoteCity = proposer.city || healthMeta.city;
      const quoteState = proposer.state || healthMeta.state;

      if (quoteAddr || quotePincode) {
        if (!resolved.addressLine1 && quoteAddr) {
          resolved.addressLine1 = String(quoteAddr).trim();
        }
        if (!resolved.pincode && quotePincode) {
          resolved.pincode = String(quotePincode).replace(/\D/g, '').trim();
        }
        if (!resolved.city && quoteCity) {
          resolved.city = String(quoteCity).trim();
        }
        if (!resolved.state && quoteState) {
          resolved.state = String(quoteState).trim();
        }
        if (source === 'FALLBACK') source = 'QUOTATION_SNAPSHOT';
      }
    }

    // 3. Linked Customer Profile
    const contact = quotation.contact as any;
    const customer = contact?.customer;
    if (customer && !this.isComplete(resolved)) {
      if (!resolved.addressLine1 && customer.addressLine1) {
        resolved.addressLine1 = customer.addressLine1.trim();
      }
      if (!resolved.addressLine2 && customer.addressLine2) {
        resolved.addressLine2 = customer.addressLine2.trim();
      }
      if (!resolved.city && customer.city) {
        resolved.city = customer.city.trim();
      }
      if (!resolved.state && customer.state) {
        resolved.state = customer.state.trim();
      }
      if (!resolved.pincode && customer.pincode) {
        resolved.pincode = customer.pincode.replace(/\D/g, '').trim();
      }
      if (source === 'FALLBACK') source = 'CUSTOMER_PROFILE';
    }

    // 4. Linked Contact Profile
    if (contact && !this.isComplete(resolved)) {
      if (!resolved.addressLine1 && contact.address) {
        resolved.addressLine1 = contact.address.trim();
      }
      if (!resolved.city && contact.city) {
        resolved.city = contact.city.trim();
      }
      if (!resolved.state && contact.state) {
        resolved.state = contact.state.trim();
      }
      if (!resolved.pincode && contact.pincode) {
        resolved.pincode = String(contact.pincode).replace(/\D/g, '').trim();
      }
      if (source === 'FALLBACK') source = 'CONTACT_PROFILE';
    }

    // Set standard defaults
    if (!resolved.country) resolved.country = 'India';

    // If city or state is still missing but we have addressLine1 and pincode, derive sensible city/state
    if (!resolved.city && resolved.addressLine1) {
      const parts = resolved.addressLine1.split(',').map((p) => p.trim());
      if (parts.length >= 2) {
        resolved.city = parts[parts.length - 1];
      }
    }
    if (!resolved.state && resolved.city) {
      resolved.state = resolved.city;
    }

    const missingFields: string[] = [];
    if (!resolved.addressLine1 || resolved.addressLine1.trim().length < 3) {
      missingFields.push('addressLine1 (minimum 3 characters)');
    }
    if (!resolved.city || resolved.city.trim().length < 2) {
      missingFields.push('city');
    }
    if (!resolved.state || resolved.state.trim().length < 2) {
      missingFields.push('state');
    }
    if (!resolved.pincode || !/^[1-9][0-9]{5}$/.test(resolved.pincode.trim())) {
      missingFields.push('pincode (valid 6-digit Indian PIN)');
    }

    const isValid = missingFields.length === 0;

    return {
      address: {
        addressLine1: resolved.addressLine1 || '',
        addressLine2: resolved.addressLine2,
        landmark: resolved.landmark,
        locality: resolved.locality,
        city: resolved.city || '',
        district: resolved.district,
        state: resolved.state || '',
        stateCode: resolved.stateCode,
        pincode: resolved.pincode || '',
        country: resolved.country || 'India',
      },
      addressSource: source,
      addressCapturedAt: capturedAt,
      isValid,
      missingFields,
    };
  }

  private isComplete(addr: Partial<PolicyAddressDto>): boolean {
    return Boolean(
      addr.addressLine1 &&
        addr.city &&
        addr.state &&
        addr.pincode &&
        /^[1-9][0-9]{5}$/.test(addr.pincode.trim()),
    );
  }

  private parseUnstructuredAddress(raw: string): Partial<PolicyAddressDto> {
    const pinMatch = raw.match(/\b([1-9][0-9]{5})\b/);
    const pincode = pinMatch ? pinMatch[1] : undefined;

    const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
    const addressLine1 = parts[0] || raw;
    const city = parts.length > 2 ? parts[parts.length - 2] : parts.length > 1 ? parts[1] : undefined;
    const state = parts.length > 3 ? parts[parts.length - 1] : undefined;

    return {
      addressLine1,
      city,
      state,
      pincode,
      country: 'India',
    };
  }
}
