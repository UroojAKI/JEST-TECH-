import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import {
  QuotationStatus,
  InspectionStatus,
  DocumentVerificationStatus,
  Prisma,
} from '@prisma/client';

export interface GateStatus {
  passed: boolean;
  status: string;
  detail: string;
}

export interface BackOfficeQueueItem {
  id: string; // quotationId
  quotationCode: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  salesAgentName: string;
  productType: string;
  insurerName: string;
  totalPremium: number;
  paymentAmount: number;
  paymentReference?: string;
  createdAt: string;
  slaRemainingHours: number;
  slaStatus: 'CRITICAL' | 'WARNING' | 'ON_TRACK';
  gates: {
    customer: GateStatus;
    vehicle: GateStatus;
    inspection: GateStatus;
    payment: GateStatus;
    documents: GateStatus;
  };
  allGatesPassed: boolean;
  nextAction: string;
}

@Injectable()
export class BackOfficeQueueService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves the Back-Office Policy Issuance Queue with multi-gate validation (G021).
   */
  async getBackOfficeQueue(params?: {
    search?: string;
    status?: string;
    quotationId?: string;
  }) {
    const where: Prisma.QuotationWhereInput = {
      status: { in: [QuotationStatus.APPROVED, QuotationStatus.ACCEPTED] },
      ...(params?.quotationId ? { id: params.quotationId } : {}),
    };

    const quotations = await this.prisma.quotation.findMany({
      where,
      include: {
        contact: true,
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        policy: true,
        motorInspection: true,
        motorPaymentRecord: true,
        motorPreviousPolicy: {
          include: {
            ruleEvaluation: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const now = Date.now();
    const items: BackOfficeQueueItem[] = [];

    let readyCount = 0;
    let blockedCount = 0;
    let issuedCount = 0;

    for (const q of quotations) {
      // Exclude already issued policies
      if (q.policy) {
        issuedCount++;
        continue;
      }

      // 1. Customer Gate
      const hasCustomer = !!q.contact;
      const hasContactDetails = !!(q.contact?.phone || q.contact?.email);
      const customerGate: GateStatus = {
        passed: hasCustomer && hasContactDetails,
        status: hasCustomer && hasContactDetails ? 'PASSED' : 'FAILED',
        detail:
          hasCustomer && hasContactDetails
            ? 'Customer details complete'
            : 'Missing customer contact phone/email',
      };

      // 2. Vehicle Integrity Gate
      const vehicleMetadata = (q.motorMetadata as Record<string, any>) || {};
      const regNumber =
        vehicleMetadata.registrationNumber || vehicleMetadata.vehicleNumber;
      const vehicleGate: GateStatus = {
        passed: !!regNumber,
        status: regNumber ? 'PASSED' : 'FAILED',
        detail: regNumber
          ? `Vehicle plate ${regNumber} valid`
          : 'Missing vehicle registration plate',
      };

      // 3. Inspection Gate
      const isInspectionRequired =
        q.motorPreviousPolicy?.ruleEvaluation?.inspectionRequired ||
        q.workflowState === 'INSPECTION_REQUIRED';
      const inspection = q.motorInspection;
      let inspectionPassed = true;
      let inspectionDetail = 'Inspection waived / not required';

      if (isInspectionRequired) {
        if (inspection?.status === InspectionStatus.COMPLETED) {
          inspectionPassed = true;
          inspectionDetail = 'Break-in inspection approved';
        } else {
          inspectionPassed = false;
          inspectionDetail = inspection
            ? `Inspection in ${inspection.status} status (requires COMPLETED)`
            : 'Break-in inspection required but not scheduled';
        }
      }

      const inspectionGate: GateStatus = {
        passed: inspectionPassed,
        status: inspectionPassed ? 'PASSED' : 'BLOCKED',
        detail: inspectionDetail,
      };

      // 4. Payment Gate
      const payment = q.motorPaymentRecord;
      const paidAmt = Number(payment?.amount || 0);
      const payableAmt = Number(q.totalPremium || 0);
      const isPaid = payment?.status === 'PAID' && paidAmt >= payableAmt;

      const paymentGate: GateStatus = {
        passed: isPaid,
        status: isPaid ? 'PASSED' : 'BLOCKED',
        detail: isPaid
          ? `Full premium received (₹${paidAmt.toLocaleString('en-IN')})`
          : payment
            ? `Payment status ${payment.status} (received ₹${paidAmt} of ₹${payableAmt})`
            : 'No payment recorded',
      };

      // 5. Document Verification Gate (G017)
      // Check if entity documents exist and if any are pending review
      const documents = await this.prisma.document.findMany({
        where: {
          entityId: q.id,
          deletedAt: null,
        },
      });

      let documentsPassed = true;
      let documentsDetail = 'All mandatory documents verified';

      const unverified = documents.filter(
        (d) => d.verificationStatus !== DocumentVerificationStatus.VERIFIED,
      );

      if (unverified.length > 0) {
        documentsPassed = false;
        documentsDetail = `${unverified.length} document(s) pending underwriter verification`;
      } else if (documents.length === 0 && isInspectionRequired) {
        documentsPassed = false;
        documentsDetail = 'Inspection/Break-in documents required';
      }

      const documentsGate: GateStatus = {
        passed: documentsPassed,
        status: documentsPassed ? 'PASSED' : 'BLOCKED',
        detail: documentsDetail,
      };

      // Multi-gate synthesis
      const allGatesPassed =
        customerGate.passed &&
        vehicleGate.passed &&
        inspectionGate.passed &&
        paymentGate.passed &&
        documentsGate.passed;

      let nextAction = 'Ready to Issue Policy';
      if (!paymentGate.passed) {
        nextAction = 'Awaiting Premium Payment Confirmation';
      } else if (!inspectionGate.passed) {
        nextAction = 'Awaiting Vehicle Break-in Inspection Sign-Off';
      } else if (!documentsGate.passed) {
        nextAction = 'Awaiting Document KYC/RC Verification';
      } else if (!customerGate.passed) {
        nextAction = 'Awaiting Customer Identity Completion';
      }

      if (allGatesPassed) {
        readyCount++;
      } else {
        blockedCount++;
      }

      // SLA Countdown (IRDAI target 24h from quotation approval / payment)
      const quoteTime = new Date(q.updatedAt || q.createdAt).getTime();
      const elapsedHours = (now - quoteTime) / 3600000;
      const slaRemainingHours = Math.max(
        0,
        Math.round((24 - elapsedHours) * 10) / 10,
      );

      let slaStatus: 'CRITICAL' | 'WARNING' | 'ON_TRACK' = 'ON_TRACK';
      if (slaRemainingHours <= 4) {
        slaStatus = 'CRITICAL';
      } else if (slaRemainingHours <= 12) {
        slaStatus = 'WARNING';
      }

      const item: BackOfficeQueueItem = {
        id: q.id,
        quotationCode: q.quotationCode,
        customerName: q.contact
          ? `${q.contact.firstName} ${q.contact.lastName || ''}`.trim()
          : 'Unknown Customer',
        customerPhone: q.contact?.phone || undefined,
        customerEmail: q.contact?.email || undefined,
        salesAgentName: q.createdBy
          ? `${q.createdBy.firstName} ${q.createdBy.lastName || ''}`.trim()
          : 'Direct Sales',
        productType: q.productType || 'MOTOR',
        insurerName: q.insurerName || 'HDFC ERGO',
        totalPremium: payableAmt,
        paymentAmount: paidAmt,
        paymentReference: payment?.referenceNumber || undefined,
        createdAt: q.createdAt.toISOString(),
        slaRemainingHours,
        slaStatus,
        gates: {
          customer: customerGate,
          vehicle: vehicleGate,
          inspection: inspectionGate,
          payment: paymentGate,
          documents: documentsGate,
        },
        allGatesPassed,
        nextAction,
      };

      // Search filter
      if (params?.search && params.search.trim()) {
        const query = params.search.toLowerCase().trim();
        const matches =
          item.quotationCode.toLowerCase().includes(query) ||
          item.customerName.toLowerCase().includes(query) ||
          item.salesAgentName.toLowerCase().includes(query);
        if (!matches) continue;
      }

      // Status filter
      if (params?.status === 'READY' && !item.allGatesPassed) continue;
      if (params?.status === 'BLOCKED' && item.allGatesPassed) continue;

      items.push(item);
    }

    return {
      data: items,
      summary: {
        totalPending: items.length,
        readyCount,
        blockedCount,
        issuedCount,
      },
    };
  }

  /**
   * Validates all gates before policy issuance.
   * Throws BadRequestException detailing blockers if any gate fails.
   */
  async validateIssuanceGates(quotationId: string) {
    const queueResult = await this.getBackOfficeQueue({ quotationId });
    const item = queueResult.data.find((q) => q.id === quotationId);

    if (!item) {
      throw new NotFoundException(
        `Quotation ${quotationId} not found in Back-Office queue or not in APPROVED/ACCEPTED status`,
      );
    }

    if (!item.allGatesPassed) {
      const blockers: string[] = [];
      if (!item.gates.customer.passed)
        blockers.push(`Customer Gate: ${item.gates.customer.detail}`);
      if (!item.gates.vehicle.passed)
        blockers.push(`Vehicle Gate: ${item.gates.vehicle.detail}`);
      if (!item.gates.inspection.passed)
        blockers.push(`Inspection Gate: ${item.gates.inspection.detail}`);
      if (!item.gates.payment.passed)
        blockers.push(`Payment Gate: ${item.gates.payment.detail}`);
      if (!item.gates.documents.passed)
        blockers.push(`Documents Gate: ${item.gates.documents.detail}`);

      throw new BadRequestException(
        `Policy issuance blocked by gate validator: ${blockers.join(' | ')}`,
      );
    }

    return { allowed: true, quotationCode: item.quotationCode };
  }
}
