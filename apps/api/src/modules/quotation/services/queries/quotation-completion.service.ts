import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import { InspectionStatus, MotorWorkflowState, QuotationStatus } from '@prisma/client';

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

  async getCompletion(quotationIdOrCode: string): Promise<QuotationCompletionResult> {
    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        quotationIdOrCode,
      );

    const quotation = await this.prisma.quotation.findFirst({
      where: isUUID
        ? { OR: [{ id: quotationIdOrCode }, { quotationCode: quotationIdOrCode }] }
        : { quotationCode: quotationIdOrCode },
      include: {
        contact: true,
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
    let customerApplicable = 5;
    let customerCompleted = 0;

    if (contact.firstName && contact.lastName) customerCompleted++;
    else customerMissing.push({ field: 'customerName', label: 'Full Customer Name', requiredFor: 'QUOTATION_CREATION' });

    if (contact.phone) customerCompleted++;
    else customerMissing.push({ field: 'phone', label: 'Mobile Number', requiredFor: 'QUOTATION_CREATION' });

    if (contact.email) customerCompleted++;
    else customerMissing.push({ field: 'email', label: 'Email Address', requiredFor: 'POLICY_ISSUANCE' });

    if (contact.dateOfBirth) customerCompleted++;
    else customerMissing.push({ field: 'dateOfBirth', label: 'Date of Birth', requiredFor: 'POLICY_ISSUANCE' });

    if (contact.panNumber || contact.aadhaarNumber) customerCompleted++;
    else customerMissing.push({ field: 'panNumber', label: 'PAN or Aadhaar KYC', requiredFor: 'POLICY_ISSUANCE' });

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
    let vehicleApplicable = 5;
    let vehicleCompleted = 0;

    const makeModel = (vehicle.make && vehicle.model) || (quotation.title && quotation.title !== 'Motor Insurance');
    if (makeModel) vehicleCompleted++;
    else vehicleMissing.push({ field: 'makeModel', label: 'Vehicle Make & Model', requiredFor: 'QUOTATION_CREATION' });

    const regNo = vehicle.registrationNumber || quotation.registrationNumber;
    if (regNo && regNo.trim() && regNo.toUpperCase() !== 'NEW') vehicleCompleted++;
    else vehicleMissing.push({ field: 'registrationNumber', label: 'Registration Plate Number', requiredFor: 'POLICY_ISSUANCE' });

    if (vehicle.engineNumber && vehicle.engineNumber.trim()) vehicleCompleted++;
    else vehicleMissing.push({ field: 'engineNumber', label: 'Engine Number', requiredFor: 'POLICY_ISSUANCE' });

    if (vehicle.chassisNumber && vehicle.chassisNumber.trim()) vehicleCompleted++;
    else vehicleMissing.push({ field: 'chassisNumber', label: 'Chassis Number', requiredFor: 'POLICY_ISSUANCE' });

    if (vehicle.registrationDate) vehicleCompleted++;
    else vehicleMissing.push({ field: 'registrationDate', label: 'Registration Date', requiredFor: 'POLICY_ISSUANCE' });

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
    let coverageApplicable = 3;
    let coverageCompleted = 0;

    if (quotation.sumInsured && Number(quotation.sumInsured) > 0) coverageCompleted++;
    else coverageMissing.push({ field: 'sumInsured', label: 'Insured Declared Value (IDV)', requiredFor: 'QUOTATION_CREATION' });

    if (quotation.policyType) coverageCompleted++;
    else coverageMissing.push({ field: 'policyType', label: 'Policy Type Selection', requiredFor: 'QUOTATION_CREATION' });

    if (quotation.totalPremium && Number(quotation.totalPremium) > 0) coverageCompleted++;
    else coverageMissing.push({ field: 'totalPremium', label: 'Authoritative Premium Calculation', requiredFor: 'QUOTATION_CREATION' });

    sections.push({
      section: 'coverage',
      label: 'Coverage & Commercial Terms',
      complete: coverageMissing.length === 0,
      applicableCount: coverageApplicable,
      completedCount: coverageCompleted,
      missing: coverageMissing,
    });

    // ── SECTION 4: Previous Insurance (Conditional) ─────────────────────
    const isRolloverOrRenewal = quotation.policyType !== 'NEW_BUSINESS' && previousPolicy;
    if (isRolloverOrRenewal) {
      const prevMissing: MissingFieldItem[] = [];
      let prevApplicable = 3;
      let prevCompleted = 0;

      if (previousPolicy?.previousPolicyNumber && previousPolicy.previousPolicyNumber.trim()) prevCompleted++;
      else prevMissing.push({ field: 'previousPolicyNumber', label: 'Previous Policy Number', requiredFor: 'POLICY_ISSUANCE', condition: 'ROLLOVER_RENEWAL' });

      if (previousPolicy?.previousInsurerName && previousPolicy.previousInsurerName.trim()) prevCompleted++;
      else prevMissing.push({ field: 'previousInsurerName', label: 'Previous Insurer Name', requiredFor: 'POLICY_ISSUANCE', condition: 'ROLLOVER_RENEWAL' });

      if (previousPolicy?.previousPolicyExpiryDate) prevCompleted++;
      else prevMissing.push({ field: 'previousPolicyExpiryDate', label: 'Previous Policy Expiry Date', requiredFor: 'POLICY_ISSUANCE', condition: 'ROLLOVER_RENEWAL' });

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
    const totalApplicable = sections.reduce((sum, s) => sum + s.applicableCount, 0);
    const totalCompleted = sections.reduce((sum, s) => sum + s.completedCount, 0);
    const completionPercentage = totalApplicable > 0 ? Math.round((totalCompleted / totalApplicable) * 100) : 0;

    const canApprove = coverageMissing.length === 0 && customerCompleted >= 2;
    const canIssuePolicy =
      completionPercentage === 100 &&
      (quotation.status === QuotationStatus.APPROVED || quotation.status === QuotationStatus.ACCEPTED) &&
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
  ): Promise<QuotationCompletionResult> {
    const quotation = await this.prisma.quotation.findUnique({
      where: { id: quotationId },
      include: {
        contact: true,
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

    // 1. Update Contact fields
    const contactUpdates: any = {};
    if (updates.email !== undefined) contactUpdates.email = updates.email;
    if (updates.panNumber !== undefined) contactUpdates.panNumber = updates.panNumber;
    if (updates.aadhaarNumber !== undefined) contactUpdates.aadhaarNumber = updates.aadhaarNumber;
    if (updates.dateOfBirth !== undefined) contactUpdates.dateOfBirth = new Date(updates.dateOfBirth);
    if (updates.customerName !== undefined) {
      const parts = updates.customerName.trim().split(' ');
      contactUpdates.firstName = parts[0];
      contactUpdates.lastName = parts.slice(1).join(' ') || parts[0];
    }
    if (Object.keys(contactUpdates).length > 0 && quotation.contactId) {
      await this.prisma.contact.update({
        where: { id: quotation.contactId },
        data: contactUpdates,
      });
    }

    // 2. Update Vehicle fields
    const vehicleUpdates: any = {};
    if (updates.engineNumber !== undefined) vehicleUpdates.engineNumber = updates.engineNumber;
    if (updates.chassisNumber !== undefined) vehicleUpdates.chassisNumber = updates.chassisNumber;
    if (updates.registrationNumber !== undefined) vehicleUpdates.registrationNumber = updates.registrationNumber;
    if (updates.makeModel !== undefined) vehicleUpdates.makeModel = updates.makeModel;
    else if (updates.make !== undefined || updates.model !== undefined) {
      vehicleUpdates.makeModel = `${updates.make || ''} ${updates.model || ''}`.trim();
    }

    if (Object.keys(vehicleUpdates).length > 0) {
      if (quotation.vehicleId) {
        await this.prisma.vehicle.update({
          where: { id: quotation.vehicleId },
          data: vehicleUpdates,
        });
      } else {
        const vehicleCount = await this.prisma.vehicle.count();
        const vehicleCode = `VEH-${new Date().getFullYear()}-${String(vehicleCount + 1).padStart(6, '0')}`;
        const newVehicle = await this.prisma.vehicle.create({
          data: {
            vehicleCode,
            category: 'PRIVATE_CAR',
            registrationNumber: updates.registrationNumber || quotation.registrationNumber || 'PENDING',
            makeModel: updates.makeModel || `${updates.make || ''} ${updates.model || ''}`.trim() || 'Standard Vehicle',
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
      const meta = (quotation.motorMetadata as any) || {};
      meta.vehicleDetails = { ...(meta.vehicleDetails || {}), ...vehicleUpdates };
      await this.prisma.quotation.update({
        where: { id: quotationId },
        data: {
          registrationNumber: updates.registrationNumber || quotation.registrationNumber,
          motorMetadata: meta,
        },
      });
    }

    // 3. Update Previous Policy fields
    if (
      updates.previousPolicyNumber !== undefined ||
      updates.previousInsurerName !== undefined ||
      updates.previousPolicyExpiryDate !== undefined
    ) {
      await this.prisma.motorPreviousPolicy.upsert({
        where: { quotationId },
        create: {
          quotationId,
          previousPolicyNumber: updates.previousPolicyNumber || 'POL-UNKNOWN',
          previousInsurerName: updates.previousInsurerName || 'Unknown Insurer',
          policyExpiryDate: updates.previousPolicyExpiryDate
            ? new Date(updates.previousPolicyExpiryDate)
            : new Date(),
        },
        update: {
          previousPolicyNumber: updates.previousPolicyNumber,
          previousInsurerName: updates.previousInsurerName,
          policyExpiryDate: updates.previousPolicyExpiryDate
            ? new Date(updates.previousPolicyExpiryDate)
            : undefined,
        },
      });
    }

    return this.getCompletion(quotationId);
  }
}
