import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import { ActorContext } from '../../../../common/interfaces/actor-context.interface';
import { RequestUser } from '../../../auth/decorators/current-user.decorator';
import {
  InspectionStatus,
  MotorWorkflowState,
  Prisma,
  QuotationStatus,
} from '@prisma/client';

export interface MissingFieldItem {
  field: string;
  label: string;
  requiredFor: 'QUOTATION_CREATION' | 'APPROVAL' | 'POLICY_ISSUANCE';
  condition?: string;
  value?: any;
}

export interface CompletionSection {
  section: string;
  label: string;
  complete: boolean;
  applicableCount: number;
  completedCount: number;
  missing: MissingFieldItem[];
}

export interface QuotationCompletionResult {
  quotationId: string;
  quotationCode: string;
  status: 'COMPLETE' | 'INCOMPLETE';
  completionPercentage: number;
  canApprove: boolean;
  canIssuePolicy: boolean;
  workflowState: MotorWorkflowState | null;
  sections: CompletionSection[];
}

@Injectable()
export class QuotationCompletionService {
  constructor(private readonly prisma: PrismaService) {}

  async getCompletion(
    quotationIdOrCode: string,
    actor?: ActorContext | RequestUser,
  ): Promise<QuotationCompletionResult> {
    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        quotationIdOrCode,
      );

    const quotation = await this.prisma.quotation.findFirst({
      where: {
        ...(isUUID
          ? {
              OR: [
                { id: quotationIdOrCode },
                { quotationCode: quotationIdOrCode },
              ],
            }
          : { quotationCode: quotationIdOrCode }),
        ...(actor?.companyId ? { companyId: actor.companyId } : {}),
      },
      include: {
        contact: {
          include: {
            customer: true,
          },
        },
        vehicle: true,
        motorPreviousPolicy: true,
        motorInspection: true,
        motorPaymentRecord: true,
        documents: true,
        saodVerification: true,
      },
    });

    if (!quotation) {
      throw new NotFoundException(`Quotation ${quotationIdOrCode} not found`);
    }

    if (actor?.companyId && quotation.companyId !== actor.companyId) {
      throw new ForbiddenException({
        code: 'CROSS_TENANT_ACCESS_FORBIDDEN',
        message: 'Access denied: You cannot view quotation details belonging to another company tenant.',
      });
    }

    return this.evaluateQuotationCompletion(quotation);
  }

  evaluateQuotationCompletion(quotation: any): QuotationCompletionResult {
    const contact = quotation.contact || {};
    const vehicle = quotation.vehicle || {};
    const previousPolicy = quotation.motorPreviousPolicy;
    const inspection = quotation.motorInspection;
    const payment = quotation.motorPaymentRecord;
    const docs = quotation.documents || [];

    const sections: CompletionSection[] = [];

    // ── SECTION 1: Customer KYC & Identity ──────────────────────────────
    const customerMissing: MissingFieldItem[] = [];
    const customerApplicable = 6;
    let customerCompleted = 0;

    if (contact.firstName && contact.lastName) customerCompleted++;
    else
      customerMissing.push({
        field: 'customerName',
        label: 'Full Customer Name',
        requiredFor: 'QUOTATION_CREATION',
      });

    if (contact.phone) customerCompleted++;
    else
      customerMissing.push({
        field: 'phone',
        label: 'Mobile Number',
        requiredFor: 'QUOTATION_CREATION',
      });

    if (contact.email) customerCompleted++;
    else
      customerMissing.push({
        field: 'email',
        label: 'Email Address',
        requiredFor: 'POLICY_ISSUANCE',
      });

    if (contact.dateOfBirth) customerCompleted++;
    else
      customerMissing.push({
        field: 'dateOfBirth',
        label: 'Date of Birth',
        requiredFor: 'POLICY_ISSUANCE',
      });

    // REQ-4: Mandatory Customer Address & PIN code validation
    const proposer = (quotation.motorMetadata as any)?.proposerDetails || {};
    const customer =
      (quotation.contact as any)?.customer || (quotation as any).customer || {};
    const address =
      proposer.address ||
      proposer.communicationAddress ||
      customer.addressLine1 ||
      (contact as any).address;
    if (address && String(address).trim().length >= 5) customerCompleted++;
    else
      customerMissing.push({
        field: 'address',
        label: 'Customer Communication Address',
        requiredFor: 'POLICY_ISSUANCE',
      });

    const pincode =
      proposer.pincode ||
      proposer.pinCode ||
      customer.pincode ||
      (contact as any).pincode;
    if (pincode && /^[1-9][0-9]{5}$/.test(String(pincode).trim())) customerCompleted++;
    else
      customerMissing.push({
        field: 'pincode',
        label: 'PIN Code (6 digits)',
        requiredFor: 'POLICY_ISSUANCE',
      });

    sections.push({
      section: 'customer',
      label: 'Customer KYC & Identity',
      complete: customerMissing.length === 0,
      applicableCount: customerApplicable,
      completedCount: customerCompleted,
      missing: customerMissing,
    });

    // ── SECTION 2: Vehicle Technical Details ───────────────────────────
    const vehicleMissing: MissingFieldItem[] = [];
    const vehicleApplicable = 5;
    let vehicleCompleted = 0;

    const makeModel =
      (vehicle.make && vehicle.model) ||
      (vehicle.makeModel && vehicle.makeModel.trim()) ||
      (quotation.motorMetadata as any)?.vehicleDetails?.makeModel;
    if (makeModel) vehicleCompleted++;
    else
      vehicleMissing.push({
        field: 'makeModel',
        label: 'Vehicle Make & Model',
        requiredFor: 'QUOTATION_CREATION',
      });

    const regNo = vehicle.registrationNumber || quotation.registrationNumber;
    if (regNo && regNo.trim() && regNo.toUpperCase() !== 'NEW')
      vehicleCompleted++;
    else
      vehicleMissing.push({
        field: 'registrationNumber',
        label: 'Registration Plate Number',
        requiredFor: 'POLICY_ISSUANCE',
      });

    if (vehicle.engineNumber && vehicle.engineNumber.trim()) vehicleCompleted++;
    else
      vehicleMissing.push({
        field: 'engineNumber',
        label: 'Engine Number',
        requiredFor: 'POLICY_ISSUANCE',
      });

    if (vehicle.chassisNumber && vehicle.chassisNumber.trim())
      vehicleCompleted++;
    else
      vehicleMissing.push({
        field: 'chassisNumber',
        label: 'Chassis Number',
        requiredFor: 'POLICY_ISSUANCE',
      });

    // FIX: schema field is `dateOfRegistration`, NOT `registrationDate`
    if ((vehicle as any).dateOfRegistration) vehicleCompleted++;
    else
      vehicleMissing.push({
        field: 'dateOfRegistration',
        label: 'Registration Date',
        requiredFor: 'POLICY_ISSUANCE',
      });

    sections.push({
      section: 'vehicle',
      label: 'Vehicle Technical Details',
      complete: vehicleMissing.length === 0,
      applicableCount: vehicleApplicable,
      completedCount: vehicleCompleted,
      missing: vehicleMissing,
    });

    // ── SECTION 3: Coverage & Pricing ──────────────────────────────────
    const coverageMissing: MissingFieldItem[] = [];
    const normalizedPolicyType = String(quotation.policyType || '').toUpperCase();
    const isThirdPartyOnly =
      normalizedPolicyType === 'TP_ONLY' ||
      normalizedPolicyType === 'THIRD_PARTY_ONLY';
    const coverageApplicable = isThirdPartyOnly ? 2 : 3;
    let coverageCompleted = 0;

    if (!isThirdPartyOnly) {
      if (quotation.sumInsured && Number(quotation.sumInsured) > 0)
        coverageCompleted++;
      else
        coverageMissing.push({
          field: 'sumInsured',
          label: 'Insured Declared Value (IDV)',
          requiredFor: 'QUOTATION_CREATION',
        });
    }

    if (quotation.policyType) coverageCompleted++;
    else
      coverageMissing.push({
        field: 'policyType',
        label: 'Policy Type Selection',
        requiredFor: 'QUOTATION_CREATION',
      });

    if (quotation.totalPremium && Number(quotation.totalPremium) > 0)
      coverageCompleted++;
    else
      coverageMissing.push({
        field: 'totalPremium',
        label: 'Authoritative Premium Calculation',
        requiredFor: 'QUOTATION_CREATION',
      });

    sections.push({
      section: 'coverage',
      label: 'Coverage & Commercial Terms',
      complete: coverageMissing.length === 0,
      applicableCount: coverageApplicable,
      completedCount: coverageCompleted,
      missing: coverageMissing,
    });

    // ── SECTION 4: Previous Insurance (Conditional) ─────────────────────
    // FIX: Motor policy types are TP_ONLY/SAOD/PACKAGE — 'NEW_BUSINESS' doesn't exist.
    // Previous insurance is applicable only when:
    //   vehicleStatus !== 'NEW' AND previousPolicyType !== 'NOT_AVAILABLE'
    // Derive this from motorMetadata (which stores vehicleDetails + previousPolicyDetails).
    const meta = (quotation.motorMetadata as any) || {};
    const metaVehicleStatus = meta.vehicleDetails?.vehicleStatus;
    const metaPrevPolicyType = meta.previousPolicyDetails?.previousPolicyType;

    const isNewVehicle = metaVehicleStatus === 'NEW' || vehicle.status === 'NEW';
    const isPrevPolicyNotAvailable =
      metaPrevPolicyType === 'NOT_AVAILABLE' ||
      (previousPolicy as any)?.previousPolicyType === 'NOT_AVAILABLE';

    const isRolloverOrRenewal =
      !isNewVehicle && !isPrevPolicyNotAvailable && !!previousPolicy;

    if (isRolloverOrRenewal) {
      const prevMissing: MissingFieldItem[] = [];
      const prevApplicable = 3;
      let prevCompleted = 0;

      if (
        previousPolicy?.previousPolicyNumber &&
        previousPolicy.previousPolicyNumber.trim()
      )
        prevCompleted++;
      else
        prevMissing.push({
          field: 'previousPolicyNumber',
          label: 'Previous Policy Number',
          requiredFor: 'POLICY_ISSUANCE',
          condition: 'ROLLOVER_RENEWAL',
        });

      if (
        previousPolicy?.previousInsurerName &&
        previousPolicy.previousInsurerName.trim()
      )
        prevCompleted++;
      else
        prevMissing.push({
          field: 'previousInsurerName',
          label: 'Previous Insurer Name',
          requiredFor: 'POLICY_ISSUANCE',
          condition: 'ROLLOVER_RENEWAL',
        });

      if (previousPolicy?.previousPolicyExpiryDate) prevCompleted++;
      else
        prevMissing.push({
          field: 'previousPolicyExpiryDate',
          label: 'Previous Policy Expiry Date',
          requiredFor: 'POLICY_ISSUANCE',
          condition: 'ROLLOVER_RENEWAL',
        });

      sections.push({
        section: 'previousInsurance',
        label: 'Previous Insurance & NCB',
        complete: prevMissing.length === 0,
        applicableCount: prevApplicable,
        completedCount: prevCompleted,
        missing: prevMissing,
      });
    }

    // ── SECTION 5: Inspection Authority (Conditional) ───────────────────
    const inspectionRequired =
      quotation.workflowState === MotorWorkflowState.INSPECTION_REQUIRED ||
      inspection?.status === InspectionStatus.REQUIRED;

    if (inspectionRequired) {
      const inspMissing: MissingFieldItem[] = [];
      const isApproved =
        inspection?.status === ('COMPLETED' as any) ||
        inspection?.status === ('APPROVED' as any) ||
        inspection?.status === ('WAIVED' as any);

      if (isApproved) {
        sections.push({
          section: 'inspection',
          label: 'Vehicle Inspection & Verification',
          complete: true,
          applicableCount: 1,
          completedCount: 1,
          missing: [],
        });
      } else {
        inspMissing.push({
          field: 'inspectionApproval',
          label: `Inspection must be completed & approved (current: ${inspection?.status || 'REQUIRED'})`,
          requiredFor: 'POLICY_ISSUANCE',
          condition: 'INSPECTION_REQUIRED',
        });
        sections.push({
          section: 'inspection',
          label: 'Vehicle Inspection & Verification',
          complete: false,
          applicableCount: 1,
          completedCount: 0,
          missing: inspMissing,
        });
      }
    }

    // ── SECTION 6: Payment Reconciliation ──────────────────────────────
    const paymentMissing: MissingFieldItem[] = [];
    const isPaid = payment?.status === 'PAID';
    if (isPaid) {
      sections.push({
        section: 'payment',
        label: 'Payment & Financial Reconciliation',
        complete: true,
        applicableCount: 1,
        completedCount: 1,
        missing: [],
      });
    } else {
      paymentMissing.push({
        field: 'payment',
        label: `Authoritative payment capture (current status: ${payment?.status || 'PENDING'})`,
        requiredFor: 'POLICY_ISSUANCE',
      });
      sections.push({
        section: 'payment',
        label: 'Payment & Financial Reconciliation',
        complete: false,
        applicableCount: 1,
        completedCount: 0,
        missing: paymentMissing,
      });
    }

    // Calculate dynamic totals
    const totalApplicable = sections.reduce(
      (sum, s) => sum + s.applicableCount,
      0,
    );
    const totalCompleted = sections.reduce(
      (sum, s) => sum + s.completedCount,
      0,
    );
    const completionPercentage =
      totalApplicable > 0
        ? Math.round((totalCompleted / totalApplicable) * 100)
        : 0;

    const canApprove = coverageMissing.length === 0 && customerCompleted >= 2;
    const canIssuePolicy =
      completionPercentage === 100 &&
      (quotation.status === QuotationStatus.APPROVED ||
        quotation.status === QuotationStatus.ACCEPTED) &&
      isPaid;

    return {
      quotationId: quotation.id,
      quotationCode: quotation.quotationCode,
      status: completionPercentage === 100 ? 'COMPLETE' : 'INCOMPLETE',
      completionPercentage,
      canApprove,
      canIssuePolicy,
      workflowState: quotation.workflowState,
      sections,
    };
  }

  async updateDetails(
    quotationId: string,
    updates: Record<string, any>,
    actor?: ActorContext | RequestUser,
  ): Promise<QuotationCompletionResult> {
    const quotation = await this.prisma.quotation.findUnique({
      where: { id: quotationId },
      include: {
        contact: {
          include: {
            customer: true,
          },
        },
        vehicle: true,
        motorPreviousPolicy: true,
        motorInspection: true,
        motorPaymentRecord: true,
        documents: true,
        saodVerification: true,
      },
    });

    if (!quotation) {
      throw new NotFoundException(`Quotation '${quotationId}' not found`);
    }

    if (actor?.companyId && quotation.companyId !== actor.companyId) {
      throw new ForbiddenException({
        code: 'CROSS_TENANT_ACCESS_FORBIDDEN',
        message: 'Access denied: You cannot mutate quotations belonging to another company tenant.',
      });
    }

    const workingMetadata: Record<string, any> = {
      ...((quotation.motorMetadata as Record<string, any>) || {}),
    };

    // 1. Update Contact fields (strictly schema-valid Contact columns only)
    const contactUpdates: Prisma.ContactUpdateInput = {};
    const trimmedEmail =
      updates.email !== undefined && updates.email !== null
        ? String(updates.email).trim()
        : '';
    if (updates.email !== undefined) contactUpdates.email = updates.email;
    const rawPhone = updates.phone ?? updates.mobileNumber;
    const trimmedPhone =
      rawPhone !== undefined && rawPhone !== null ? String(rawPhone).trim() : '';
    if (trimmedPhone) {
      contactUpdates.phone = trimmedPhone;
    }
    if (
      updates.panNumber !== undefined &&
      !/^X{4,}/i.test(String(updates.panNumber).trim()) &&
      !String(updates.panNumber).includes('*')
    ) {
      contactUpdates.panNumber = updates.panNumber;
    }
    if (
      updates.aadhaarNumber !== undefined &&
      !/^X{4,}/i.test(String(updates.aadhaarNumber).trim()) &&
      !String(updates.aadhaarNumber).includes('*')
    ) {
      contactUpdates.aadhaarNumber = updates.aadhaarNumber;
    }
    if (
      updates.dateOfBirth !== undefined &&
      updates.dateOfBirth !== null &&
      String(updates.dateOfBirth).trim() !== ''
    ) {
      const parsedDob = new Date(updates.dateOfBirth);
      if (!Number.isNaN(parsedDob.getTime())) {
        contactUpdates.dateOfBirth = parsedDob;
      }
    }
    const trimmedName =
      updates.customerName !== undefined && updates.customerName !== null
        ? String(updates.customerName).trim()
        : '';
    if (trimmedName) {
      const parts = trimmedName.split(/\s+/);
      contactUpdates.firstName = parts[0];
      contactUpdates.lastName = parts.slice(1).join(' ') || parts[0];
    }
    if (Object.keys(contactUpdates).length > 0 && quotation.contactId) {
      await this.prisma.contact.update({
        where: { id: quotation.contactId },
        data: contactUpdates,
      });
    }

    // Address and location fields live on Customer (linked via Contact.customer) and Quotation.motorMetadata.proposerDetails
    const rawAddress = updates.address ?? updates.addressLine1;
    const rawAddressLine2 = updates.addressLine2;
    const trimmedAddress = rawAddress !== undefined ? String(rawAddress).trim() : '';
    const trimmedAddressLine2 = rawAddressLine2 !== undefined ? String(rawAddressLine2).trim() : '';
    const trimmedCity = updates.city !== undefined ? String(updates.city).trim() : '';
    const trimmedState = updates.state !== undefined ? String(updates.state).trim() : '';
    const trimmedPincode = updates.pincode !== undefined ? String(updates.pincode).trim() : '';

    const hasAddressUpdates = Boolean(
      trimmedAddress || trimmedAddressLine2 || trimmedCity || trimmedState || trimmedPincode,
    );

    const targetCustomerId =
      (quotation.contact as any)?.customer?.id ||
      (quotation as any).customer?.id ||
      (quotation as any).customerId;
    const customerDelegate = (this.prisma as any).customer;
    if ((hasAddressUpdates || trimmedPhone) && customerDelegate) {
      const custUpdates: Prisma.CustomerUpdateInput = {};
      if (trimmedPhone) custUpdates.mobile = trimmedPhone;
      if (trimmedAddress) custUpdates.addressLine1 = trimmedAddress;
      if (trimmedAddressLine2) custUpdates.addressLine2 = trimmedAddressLine2;
      if (trimmedCity) custUpdates.city = trimmedCity;
      if (trimmedState) custUpdates.state = trimmedState;
      if (trimmedPincode) custUpdates.pincode = trimmedPincode;
      if (Object.keys(custUpdates).length > 0) {
        if (targetCustomerId && customerDelegate.update) {
          await customerDelegate
            .update({
              where: { id: targetCustomerId },
              data: custUpdates,
            })
            .catch(() => null);
        } else if (quotation.contactId && customerDelegate.updateMany) {
          await customerDelegate
            .updateMany({
              where: { contactId: quotation.contactId },
              data: custUpdates,
            })
            .catch(() => null);
        }
      }
    }

    if (hasAddressUpdates || trimmedPhone || trimmedEmail || trimmedName) {
      workingMetadata.proposerDetails = {
        ...(workingMetadata.proposerDetails || {}),
        ...(trimmedName ? { customerName: trimmedName } : {}),
        ...(trimmedPhone ? { mobileNumber: trimmedPhone } : {}),
        ...(trimmedEmail ? { emailId: trimmedEmail } : {}),
        ...(trimmedAddress
          ? { address: trimmedAddress, communicationAddress: trimmedAddress }
          : {}),
        ...(trimmedAddressLine2 ? { addressLine2: trimmedAddressLine2 } : {}),
        ...(trimmedPincode ? { pincode: trimmedPincode } : {}),
        ...(trimmedCity ? { city: trimmedCity } : {}),
        ...(trimmedState ? { state: trimmedState } : {}),
      };
      await this.prisma.quotation.update({
        where: { id: quotationId },
        data: { motorMetadata: workingMetadata },
      });
    }

    // 2. Update Vehicle fields
    const vehicleUpdates: any = {};
    if (updates.engineNumber !== undefined)
      vehicleUpdates.engineNumber = updates.engineNumber;
    if (updates.chassisNumber !== undefined)
      vehicleUpdates.chassisNumber = updates.chassisNumber;
    if (updates.registrationNumber !== undefined)
      vehicleUpdates.registrationNumber = updates.registrationNumber;
    if (updates.dateOfRegistration !== undefined)
      vehicleUpdates.dateOfRegistration = new Date(updates.dateOfRegistration);
    if (updates.makeModel !== undefined) {
      vehicleUpdates.makeModel = updates.makeModel.trim();
      const parts = updates.makeModel.trim().split(' ');
      if (parts.length > 1) {
        vehicleUpdates.make = parts[0];
        vehicleUpdates.model = parts.slice(1).join(' ');
      } else {
        vehicleUpdates.make = parts[0];
        vehicleUpdates.model = parts[0];
      }
    }
    if (updates.make !== undefined) vehicleUpdates.make = updates.make;
    if (updates.model !== undefined) vehicleUpdates.model = updates.model;
    if (!vehicleUpdates.makeModel && (updates.make || updates.model)) {
      vehicleUpdates.makeModel =
        `${updates.make || ''} ${updates.model || ''}`.trim();
    }

    if (Object.keys(vehicleUpdates).length > 0) {
      if (quotation.vehicleId) {
        await this.prisma.vehicle.update({
          where: { id: quotation.vehicleId },
          data: vehicleUpdates,
        });
      } else {
        let vehicleCode: string;
        const year = new Date().getFullYear();
        try {
          const res = await this.prisma.$queryRaw<
            [{ nextval: bigint }]
          >`SELECT nextval('vehicle_code_seq')`;
          vehicleCode = `VEH-${year}-${res[0].nextval.toString().padStart(6, '0')}`;
        } catch {
          try {
            await this.prisma
              .$executeRaw`CREATE SEQUENCE IF NOT EXISTS vehicle_code_seq START 1;`;
            const retry = await this.prisma.$queryRaw<
              [{ nextval: bigint }]
            >`SELECT nextval('vehicle_code_seq')`;
            vehicleCode = `VEH-${year}-${retry[0].nextval.toString().padStart(6, '0')}`;
          } catch {
            const count = await this.prisma.vehicle.count().catch(() => 0);
            vehicleCode = `VEH-${year}-${String(count + 1).padStart(6, '0')}`;
          }
        }
        const validCategories = [
          'BIKE',
          'PRIVATE_CAR',
          'GCV',
          'TRACTOR',
          'AUTO',
          'TAXI',
          'BUS_COACH',
          'MISC_CLASS_D',
        ];
        const rawCategory =
          updates.category ||
          (quotation as any).vehicleCategory ||
          ((quotation.motorMetadata as any)?.vehicleDetails?.category) ||
          'PRIVATE_CAR';
        const derivedCategory = validCategories.includes(rawCategory)
          ? rawCategory
          : 'PRIVATE_CAR';

        const newVehicle = await this.prisma.vehicle.create({
          data: {
            vehicleCode,
            category: derivedCategory as any,
            registrationNumber:
              updates.registrationNumber ||
              quotation.registrationNumber ||
              'PENDING',
            makeModel:
              vehicleUpdates.makeModel ||
              updates.makeModel ||
              `${updates.make || ''} ${updates.model || ''}`.trim() ||
              'Standard Vehicle',
            make: vehicleUpdates.make,
            model: vehicleUpdates.model,
            dateOfRegistration: vehicleUpdates.dateOfRegistration,
            engineNumber: updates.engineNumber,
            chassisNumber: updates.chassisNumber,
            contactId: quotation.contactId,
          },
        });
        await this.prisma.quotation.update({
          where: { id: quotationId },
          data: { vehicleId: newVehicle.id },
        });
      }
      workingMetadata.vehicleDetails = {
        ...(workingMetadata.vehicleDetails || {}),
        ...vehicleUpdates,
      };
      await this.prisma.quotation.update({
        where: { id: quotationId },
        data: {
          registrationNumber:
            updates.registrationNumber || quotation.registrationNumber,
          motorMetadata: workingMetadata,
        },
      });
    }

    // 3. Update Previous Policy fields
    if (
      updates.previousPolicyType === 'NOT_AVAILABLE' ||
      updates.clearPreviousPolicy === true
    ) {
      // Symmetrical cleanup: delete stale motorPreviousPolicy if user declares NOT_AVAILABLE
      await this.prisma.motorPreviousPolicy.deleteMany({
        where: { quotationId },
      });
      workingMetadata.previousPolicyDetails = {
        ...(workingMetadata.previousPolicyDetails || {}),
        previousPolicyType: 'NOT_AVAILABLE',
        previousInsurerName: null,
        previousPolicyNumber: null,
        policyExpiryDate: null,
      };
      await this.prisma.quotation.update({
        where: { id: quotationId },
        data: { motorMetadata: workingMetadata },
      });
    } else if (
      updates.previousPolicyNumber !== undefined ||
      updates.previousInsurerName !== undefined ||
      updates.previousPolicyExpiryDate !== undefined ||
      updates.previousPolicyType !== undefined
    ) {
      await this.prisma.motorPreviousPolicy.upsert({
        where: { quotationId },
        create: {
          quotationId,
          previousPolicyType: updates.previousPolicyType || 'COMPREHENSIVE',
          previousPolicyNumber: updates.previousPolicyNumber || 'POL-UNKNOWN',
          previousInsurerName: updates.previousInsurerName || 'Unknown Insurer',
          policyExpiryDate: updates.previousPolicyExpiryDate
            ? new Date(updates.previousPolicyExpiryDate)
            : new Date(),
        },
        update: {
          previousPolicyType: updates.previousPolicyType,
          previousPolicyNumber: updates.previousPolicyNumber,
          previousInsurerName: updates.previousInsurerName,
          policyExpiryDate: updates.previousPolicyExpiryDate
            ? new Date(updates.previousPolicyExpiryDate)
            : undefined,
        },
      });
      workingMetadata.previousPolicyDetails = {
        ...(workingMetadata.previousPolicyDetails || {}),
        previousPolicyType: updates.previousPolicyType || workingMetadata.previousPolicyDetails?.previousPolicyType,
        previousInsurerName: updates.previousInsurerName || workingMetadata.previousPolicyDetails?.previousInsurerName,
        previousPolicyNumber: updates.previousPolicyNumber || workingMetadata.previousPolicyDetails?.previousPolicyNumber,
        policyExpiryDate: updates.previousPolicyExpiryDate || workingMetadata.previousPolicyDetails?.policyExpiryDate,
      };
      await this.prisma.quotation.update({
        where: { id: quotationId },
        data: { motorMetadata: workingMetadata },
      });
    }

    return this.getCompletion(quotationId, actor);
  }
}
