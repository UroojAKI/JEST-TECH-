import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { VehicleDataService } from './vehicle-data.service';

export interface PreviousPolicyResponse {
  status: 'AVAILABLE' | 'NOT_AVAILABLE';
  provenance: 'PREVIOUS_POLICY' | 'DATABASE' | 'MANUAL';
  message: string;
  previousPolicyNumber?: string | null;
  insurerName?: string | null;
  policyType?: string | null;
  expiryDate?: Date | string | null;
  odExpiryDate?: Date | string | null;
  tpExpiryDate?: Date | string | null;
  hasClaims: boolean;
  claimsCount: number;
  ncbPercentage: number;
  previousOdPremium?: number | null;
  previousTpPremium?: number | null;
  vehicle?: {
    id: string;
    registrationNumber: string | null;
    category: string;
    makeModel?: string | null;
    manufactureYearMonth?: string | null;
    engineNumber?: string | null;
    chassisNumber?: string | null;
    fuelType?: string | null;
    rtoLocation?: string | null;
  } | null;
  customer?: {
    id: string;
    customerCode: string;
    name: string;
    mobile: string;
    email?: string | null;
  } | null;
}

@Injectable()
export class PreviousPolicyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vehicleDataService: VehicleDataService,
  ) {}

  /**
   * Fetches previous policy data for an identifier (registration number, policy number, or vehicle ID).
   * Never crashes or throws 404; gracefully returns status: NOT_AVAILABLE with manual entry defaults.
   */
  async fetchPreviousPolicy(
    identifier: string,
    actorCompanyId?: string,
  ): Promise<PreviousPolicyResponse> {
    if (!identifier || !identifier.trim()) {
      return {
        status: 'NOT_AVAILABLE',
        provenance: 'MANUAL',
        message: 'No identifier provided for previous policy lookup.',
        hasClaims: false,
        claimsCount: 0,
        ncbPercentage: 0,
      };
    }

    const cleanInput = identifier.trim();
    const normalizedReg =
      this.vehicleDataService.normalizeRegistrationNumber(
        cleanInput,
      ).normalized;

    // 1. Check Policy records by policyNumber, actualPolicyNumber, or vehicle registration
    const policy = await this.prisma.policy.findFirst({
      where: {
        OR: [
          { policyNumber: { equals: cleanInput, mode: 'insensitive' } },
          { actualPolicyNumber: { equals: cleanInput, mode: 'insensitive' } },
          {
            vehicle: {
              OR: [
                {
                  registrationNumber: {
                    equals: cleanInput,
                    mode: 'insensitive',
                  },
                },
                {
                  registrationNumber: {
                    equals: normalizedReg,
                    mode: 'insensitive',
                  },
                },
              ],
            },
          },
          { vehicleId: cleanInput },
        ],
      },
      include: {
        vehicle: true,
        customer: true,
        quotation: true,
        claims: {
          where: { deletedAt: null },
        },
      },
      orderBy: { expiryDate: 'desc' },
    });

    if (policy) {
      const claimsCount = policy.claims?.length || 0;
      const hasClaims = claimsCount > 0;
      // Standard NCB scale: 0 claims -> 20%, claims present -> 0%
      const ncbPercentage = hasClaims ? 0 : 20;

      const metadata = (policy.motorMetadata as Record<string, any>) || {};

      return {
        status: 'AVAILABLE',
        provenance: 'PREVIOUS_POLICY',
        message: 'Previous policy record located in system.',
        previousPolicyNumber: policy.actualPolicyNumber || policy.policyNumber,
        insurerName:
          policy.quotation?.insurerName ||
          policy.activeTpInsurer ||
          'Existing Insurer',
        policyType: policy.policyType || 'PACKAGE',
        expiryDate: policy.expiryDate,
        odExpiryDate: policy.odExpiryDate,
        tpExpiryDate: policy.tpExpiryDate,
        hasClaims,
        claimsCount,
        ncbPercentage,
        previousOdPremium: metadata.odPremium
          ? Number(metadata.odPremium)
          : null,
        previousTpPremium: metadata.tpPremium
          ? Number(metadata.tpPremium)
          : null,
        vehicle: policy.vehicle
          ? {
              id: policy.vehicle.id,
              registrationNumber: policy.vehicle.registrationNumber,
              category: policy.vehicle.category,
              makeModel: policy.vehicle.makeModel,
              manufactureYearMonth: policy.vehicle.manufactureYearMonth,
              engineNumber: policy.vehicle.engineNumber,
              chassisNumber: policy.vehicle.chassisNumber,
              fuelType: policy.vehicle.fuelType,
              rtoLocation: policy.vehicle.rtoLocation,
            }
          : null,
        // F-015: Only return customer PII if the policy belongs to the actor's company
        customer:
          policy.customer &&
          (!actorCompanyId || policy.companyId === actorCompanyId)
            ? {
                id: policy.customer.id,
                customerCode: policy.customer.customerCode,
                name: `${policy.customer.firstName} ${policy.customer.lastName || ''}`.trim(),
                mobile: policy.customer.mobile,
                email: policy.customer.email,
              }
            : null,
      };
    }

    // 2. Check if the Vehicle exists in registry without an active policy record
    const vehicle = await this.prisma.vehicle.findFirst({
      where: {
        OR: [
          { registrationNumber: { equals: cleanInput, mode: 'insensitive' } },
          {
            registrationNumber: { equals: normalizedReg, mode: 'insensitive' },
          },
          { id: cleanInput },
        ],
      },
      include: {
        customer: true,
      },
    });

    if (vehicle) {
      return {
        status: 'AVAILABLE',
        provenance: 'DATABASE',
        message:
          'Vehicle found on record without linked previous policy. Defaulting to 0% NCB.',
        previousPolicyNumber: null,
        insurerName: null,
        policyType: 'PACKAGE',
        hasClaims: false,
        claimsCount: 0,
        ncbPercentage: 0,
        vehicle: {
          id: vehicle.id,
          registrationNumber: vehicle.registrationNumber,
          category: vehicle.category,
          makeModel: vehicle.makeModel,
          manufactureYearMonth: vehicle.manufactureYearMonth,
          engineNumber: vehicle.engineNumber,
          chassisNumber: vehicle.chassisNumber,
          fuelType: vehicle.fuelType,
          rtoLocation: vehicle.rtoLocation,
        },
        // F-015: Only return customer PII if the vehicle's customer belongs to the actor's company
        customer:
          vehicle.customer &&
          (!actorCompanyId || vehicle.customer.companyId === actorCompanyId)
            ? {
                id: vehicle.customer.id,
                customerCode: vehicle.customer.customerCode,
                name: `${vehicle.customer.firstName} ${vehicle.customer.lastName || ''}`.trim(),
                mobile: vehicle.customer.mobile,
                email: vehicle.customer.email,
              }
            : null,
      };
    }

    // 3. Fallback: NOT_AVAILABLE
    return {
      status: 'NOT_AVAILABLE',
      provenance: 'MANUAL',
      message:
        'No previous policy or vehicle found for this identifier. Proceed with manual entry.',
      hasClaims: false,
      claimsCount: 0,
      ncbPercentage: 0,
      vehicle: null,
      customer: null,
    };
  }
}
