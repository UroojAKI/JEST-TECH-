import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { VehicleCategory, VehicleStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

export interface NormalizedRegistrationResult {
  raw: string;
  normalized: string;
  isValid: boolean;
  isNewVehicle: boolean;
  stateCode?: string;
  rtoCode?: string;
  seriesType: 'STANDARD' | 'BH_SERIES' | 'UNREGISTERED' | 'INVALID';
  errorMessage?: string;
}

export interface VehicleSpecValidationResult {
  isValid: boolean;
  category: VehicleCategory;
  missingFields: string[];
  errors: string[];
  sanitizedSpecs: Record<string, any>;
}

export interface UpsertVehicleDto {
  contactId: string;
  category: VehicleCategory;
  registrationNumber?: string;
  makeModel?: string;
  manufactureYearMonth?: string;
  dateOfRegistration?: string | Date;
  engineNumber?: string;
  chassisNumber?: string;
  fuelType?: string;
  rtoLocation?: string;
  categorySpecificData?: Record<string, any>;
}

const INDIAN_STATE_NAMES: Record<string, string> = {
  AN: 'Andaman & Nicobar',
  AP: 'Andhra Pradesh',
  AR: 'Arunachal Pradesh',
  AS: 'Assam',
  BR: 'Bihar',
  CH: 'Chandigarh',
  CG: 'Chhattisgarh',
  DD: 'Daman & Diu',
  DL: 'Delhi',
  DN: 'Dadra & Nagar Haveli',
  GA: 'Goa',
  GJ: 'Gujarat',
  HP: 'Himachal Pradesh',
  HR: 'Haryana',
  JH: 'Jharkhand',
  JK: 'Jammu & Kashmir',
  KA: 'Karnataka',
  KL: 'Kerala',
  LA: 'Ladakh',
  LD: 'Lakshadweep',
  MH: 'Maharashtra',
  ML: 'Meghalaya',
  MN: 'Manipur',
  MP: 'Madhya Pradesh',
  MZ: 'Mizoram',
  NL: 'Nagaland',
  OD: 'Odisha',
  PB: 'Punjab',
  PY: 'Puducherry',
  RJ: 'Rajasthan',
  SK: 'Sikkim',
  TN: 'Tamil Nadu',
  TR: 'Tripura',
  TS: 'Telangana',
  UK: 'Uttarakhand',
  UP: 'Uttar Pradesh',
  WB: 'West Bengal',
};

@Injectable()
export class VehicleDataService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Normalizes and validates Indian registration numbers across Standard and BH Series plates.
   */
  normalizeRegistrationNumber(rawReg?: string): NormalizedRegistrationResult {
    if (!rawReg || !rawReg.trim() || rawReg.trim().toUpperCase() === 'NEW') {
      return {
        raw: rawReg || '',
        normalized: 'NEW',
        isValid: true,
        isNewVehicle: true,
        seriesType: 'UNREGISTERED',
      };
    }

    // Strip whitespace, hyphens, dots
    const cleaned = rawReg.toUpperCase().replace(/[\s\-\.]/g, '');

    // 1. Check Standard Indian Plate: e.g. MH02CB1234, DL10A1234, KA011234
    const standardRegex = /^([A-Z]{2})([0-9]{1,2})([A-Z]{0,3})([0-9]{4})$/;
    const standardMatch = cleaned.match(standardRegex);

    if (standardMatch) {
      const stateCode = standardMatch[1];
      const rtoDigit = standardMatch[2].padStart(2, '0');
      const seriesLetters = standardMatch[3];
      const numberPart = standardMatch[4];

      const rtoCode = `${stateCode}${rtoDigit}`;
      const normalized = `${rtoCode}${seriesLetters}${numberPart}`;

      return {
        raw: rawReg,
        normalized,
        isValid: true,
        isNewVehicle: false,
        stateCode,
        rtoCode,
        seriesType: 'STANDARD',
      };
    }

    // 2. Check Bharat Series (BH): e.g. 22BH1234AA, 23BH5678Z
    const bhRegex = /^([0-9]{2})BH([0-9]{4})([A-Z]{1,2})$/;
    const bhMatch = cleaned.match(bhRegex);

    if (bhMatch) {
      return {
        raw: rawReg,
        normalized: cleaned,
        isValid: true,
        isNewVehicle: false,
        seriesType: 'BH_SERIES',
      };
    }

    return {
      raw: rawReg,
      normalized: cleaned,
      isValid: false,
      isNewVehicle: false,
      seriesType: 'INVALID',
      errorMessage: `Registration number "${rawReg}" is not a valid Indian vehicle plate format (expected e.g. MH02CB1234, 22BH1234AA, or NEW).`,
    };
  }

  /**
   * Validates vehicle category and enforces categorySpecificData rules per IRDAI standards.
   */
  validateVehicleSpecs(
    category: VehicleCategory,
    specs: Record<string, any>,
  ): VehicleSpecValidationResult {
    const missingFields: string[] = [];
    const errors: string[] = [];

    const allowedCategories = Object.values(VehicleCategory);
    if (!allowedCategories.includes(category)) {
      errors.push(`Invalid vehicle category "${category}". Must be one of: ${allowedCategories.join(', ')}`);
      return { isValid: false, category, missingFields, errors, sanitizedSpecs: specs };
    }

    switch (category) {
      case VehicleCategory.BIKE:
        if (!specs.vehicleSubType) missingFields.push('vehicleSubType (Scooter/Motorcycle/Moped/Electric)');
        if (!specs.engineCapacityCcOrKw && !specs.engineCapacity) missingFields.push('engineCapacityCcOrKw');
        break;

      case VehicleCategory.PRIVATE_CAR:
        if (!specs.vehicleSubType) missingFields.push('vehicleSubType (Hatchback/Sedan/SUV/MPV/Electric)');
        if (!specs.engineCapacityCcOrKw && !specs.engineCapacity) missingFields.push('engineCapacityCcOrKw');
        break;

      case VehicleCategory.GCV:
        if (!specs.grossVehicleWeightKg && !specs.gvwKg) missingFields.push('grossVehicleWeightKg');
        if (!specs.carryingCapacityTonnes && !specs.carryingCapacity) missingFields.push('carryingCapacityTonnes');
        break;

      case VehicleCategory.TRACTOR:
        if (!specs.horsePowerHp && !specs.hp) missingFields.push('horsePowerHp');
        break;

      case VehicleCategory.AUTO:
        if (!specs.seatingOrLoadCapacity && !specs.seatingCapacity) missingFields.push('seatingOrLoadCapacity');
        break;

      case VehicleCategory.TAXI:
        if (!specs.seatingCapacity) missingFields.push('seatingCapacity');
        if (!specs.permitType) missingFields.push('permitType (Local/All India/State)');
        break;

      case VehicleCategory.BUS_COACH:
        if (!specs.seatingCapacity) missingFields.push('seatingCapacity');
        if (!specs.routePermitType) missingFields.push('routePermitType (School/Staff/Stage Carriage/Contract Carriage)');
        break;

      case VehicleCategory.MISC_CLASS_D:
        if (!specs.purposeOfUse && !specs.specialClassType) missingFields.push('purposeOfUse (Ambulance/Hearse/Crane/Special)');
        break;
    }

    return {
      isValid: missingFields.length === 0 && errors.length === 0,
      category,
      missingFields,
      errors,
      sanitizedSpecs: {
        ...specs,
        validatedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Looks up a vehicle by registration number.
   */
  async findByRegistration(registrationNumber: string) {
    const norm = this.normalizeRegistrationNumber(registrationNumber);
    if (!norm.isValid || norm.isNewVehicle) {
      throw new BadRequestException(norm.errorMessage || 'Cannot lookup unregistered or invalid vehicle plate');
    }

    const vehicle = await this.prisma.vehicle.findFirst({
      where: {
        registrationNumber: { equals: norm.normalized, mode: 'insensitive' },
        deletedAt: null,
      },
      include: {
        contact: {
          select: {
            id: true,
            contactCode: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          },
        },
      },
    });

    if (!vehicle) {
      throw new NotFoundException(`No vehicle record found for registration number ${norm.normalized}`);
    }

    return vehicle;
  }

  /**
   * Creates or updates a canonical Vehicle under a Contact.
   */
  async upsertVehicle(dto: UpsertVehicleDto, actorId?: string) {
    const contact = await this.prisma.contact.findUnique({
      where: { id: dto.contactId },
    });
    if (!contact) {
      throw new NotFoundException(`Contact with ID ${dto.contactId} not found`);
    }

    let normalizedPlate: string | null = null;
    let rtoLoc = dto.rtoLocation;

    if (dto.registrationNumber) {
      const norm = this.normalizeRegistrationNumber(dto.registrationNumber);
      if (!norm.isValid) {
        throw new BadRequestException(norm.errorMessage);
      }
      normalizedPlate = norm.normalized === 'NEW' ? null : norm.normalized;
      if (norm.rtoCode && !rtoLoc) {
        const stateName = norm.stateCode ? INDIAN_STATE_NAMES[norm.stateCode] || norm.stateCode : '';
        rtoLoc = `${norm.rtoCode} (${stateName})`;
      }
    }

    // Validate category specs
    const validation = this.validateVehicleSpecs(
      dto.category,
      dto.categorySpecificData || {},
    );

    // If existing vehicle under this contact with matching registration
    let existingVehicle: any = null;
    if (normalizedPlate) {
      existingVehicle = await this.prisma.vehicle.findFirst({
        where: {
          contactId: dto.contactId,
          registrationNumber: normalizedPlate,
          deletedAt: null,
        },
      });
    }

    if (existingVehicle) {
      return this.prisma.vehicle.update({
        where: { id: existingVehicle.id },
        data: {
          category: dto.category,
          makeModel: dto.makeModel || existingVehicle.makeModel,
          fuelType: dto.fuelType || existingVehicle.fuelType,
          manufactureYearMonth: dto.manufactureYearMonth || existingVehicle.manufactureYearMonth,
          dateOfRegistration: dto.dateOfRegistration ? new Date(dto.dateOfRegistration) : existingVehicle.dateOfRegistration,
          engineNumber: dto.engineNumber || existingVehicle.engineNumber,
          chassisNumber: dto.chassisNumber || existingVehicle.chassisNumber,
          rtoLocation: rtoLoc || existingVehicle.rtoLocation,
          categorySpecificData: validation.sanitizedSpecs,
          status: VehicleStatus.EXISTING,
        },
      });
    }

    // Generate unique vehicleCode
    const vehicleCount = await this.prisma.vehicle.count();
    const vehicleCode = `VEH-${new Date().getFullYear()}-${String(vehicleCount + 1).padStart(6, '0')}`;

    return this.prisma.vehicle.create({
      data: {
        vehicleCode,
        status: normalizedPlate ? VehicleStatus.EXISTING : VehicleStatus.NEW,
        category: dto.category,
        registrationNumber: normalizedPlate,
        makeModel: dto.makeModel,
        fuelType: dto.fuelType,
        manufactureYearMonth: dto.manufactureYearMonth,
        dateOfRegistration: dto.dateOfRegistration ? new Date(dto.dateOfRegistration) : undefined,
        engineNumber: dto.engineNumber,
        chassisNumber: dto.chassisNumber,
        rtoLocation: rtoLoc,
        categorySpecificData: validation.sanitizedSpecs,
        contact: { connect: { id: dto.contactId } },
        createdBy: actorId ? { connect: { id: actorId } } : undefined,
      },
    });
  }

  /**
   * Retrieves all vehicles owned by a contact.
   */
  async findByContact(contactId: string) {
    return this.prisma.vehicle.findMany({
      where: { contactId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }
}
