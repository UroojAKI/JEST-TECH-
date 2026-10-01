import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { InspectionStatus, Prisma } from '@prisma/client';
import { ActorContext } from '../../../common/interfaces/actor-context.interface';

export type WorkflowAction =
  | 'EDIT_PROPOSAL'
  | 'REQUEST_INSPECTION'
  | 'PERFORM_INSPECTION'
  | 'RECORD_PAYMENT'
  | 'VERIFY_PAYMENT'
  | 'SUBMIT_KYC'
  | 'VERIFY_DOCUMENTS'
  | 'ISSUE_POLICY'
  | 'DOWNLOAD_POLICY';

export interface MotorWorkflowProjection {
  quotationId: string;
  quotationCode: string;
  canonicalState: string;
  canIssue: boolean;
  blockingGates: {
    proposalApproved: boolean;
    paymentVerified: boolean;
    inspectionCleared: boolean;
    documentsVerified: boolean;
    kycVerified: boolean;
    calculationValid: boolean;
  };
  blockingReasons: string[];
  allowedActions: WorkflowAction[];
  meta: {
    totalPremium: string;
    paidAmount?: string;
    kycStatus: string;
    inspectionStatus?: string;
    policyNumber?: string;
  };
}

@Injectable()
export class MotorWorkflowGatesService {
  private readonly logger = new Logger(MotorWorkflowGatesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getWorkflowProjection(
    quotationId: string,
    actorCompanyId: string,
    actor?: ActorContext,
  ): Promise<MotorWorkflowProjection> {
    const quotation = await this.prisma.quotation.findUnique({
      where: { id: quotationId },
      include: {
        contact: true,
        account: true,
        vehicle: true,
        motorInspection: true,
        motorPaymentRecord: true,
        proposal: {
          include: {
            documents: true,
          },
        },
        motorDocuments: true,
        policy: true,
      },
    });

    if (!quotation) {
      throw new NotFoundException(`Quotation with ID ${quotationId} not found`);
    }

    if (
      actorCompanyId &&
      quotation.companyId &&
      quotation.companyId !== actorCompanyId
    ) {
      throw new ForbiddenException(
        'Cross-organization quotation access is strictly prohibited',
      );
    }

    const ruleEvaluation = await this.prisma.motorRuleEvaluation.findUnique({
      where: { quotationId },
    });

    const userRoles = new Set(
      [...(actor?.roles || []), actor?.role]
        .filter(Boolean)
        .map((r) => String(r).toUpperCase()),
    );

    const isBO =
      userRoles.has('BACK_OFFICE') ||
      userRoles.has('ADMIN') ||
      userRoles.has('SUPER_ADMIN') ||
      userRoles.has('SYSTEM_ADMINISTRATOR');

    const isFinance =
      isBO ||
      userRoles.has('FINANCE') ||
      userRoles.has('FINANCE_ACCOUNTS_EXECUTIVE') ||
      userRoles.has('CHIEF_FINANCE_OFFICER') ||
      userRoles.has('ACCOUNTANT');

    const isAgent = userRoles.has('AGENT') || userRoles.has('SALES_EXECUTIVE');

    // 1. Calculation Valid Gate
    const sumInsuredNum = Number(quotation.sumInsured ?? 0);
    const totalPremiumNum = Number(quotation.totalPremium ?? 0);
    const calculationValid =
      sumInsuredNum > 0 &&
      totalPremiumNum > 0 &&
      quotation.calculationSnapshot !== null;

    // 2. KYC Verified Gate (Account KYC or Contact PAN present)
    const kycStatus =
      quotation.account?.kycStatus ||
      (quotation.contact?.panNumber ? 'VERIFIED' : 'PENDING');
    const kycVerified = quotation.account
      ? quotation.account.kycStatus === 'VERIFIED'
      : Boolean(quotation.contact?.panNumber);

    // 3. Inspection Cleared Gate
    const inspectionRequired =
      Boolean(ruleEvaluation?.inspectionRequired) ||
      quotation.workflowState === 'INSPECTION_REQUIRED' ||
      quotation.motorInspection?.status === InspectionStatus.REQUIRED;

    let inspectionCleared = true;
    if (inspectionRequired) {
      if (!quotation.motorInspection) {
        inspectionCleared = false;
      } else {
        inspectionCleared =
          quotation.motorInspection.status === InspectionStatus.COMPLETED ||
          quotation.motorInspection.status === InspectionStatus.WAIVED;
      }
    }

    // 4. Proposal Approved Gate
    let proposalApproved = false;
    if (quotation.proposal) {
      proposalApproved = quotation.proposal.status === 'APPROVED';
    } else {
      proposalApproved =
        quotation.workflowState === 'PROPOSAL_APPROVED' ||
        quotation.workflowState === 'PAYMENT_PENDING' ||
        quotation.workflowState === 'PAYMENT_DONE' ||
        quotation.workflowState === 'ISSUANCE_PENDING' ||
        quotation.workflowState === 'POLICY_ISSUED';
    }

    // 5. Payment Verified Gate
    let paymentVerified = false;
    const payment = quotation.motorPaymentRecord;
    if (payment && payment.status === 'PAID') {
      const payable = new Prisma.Decimal(quotation.totalPremium);
      const paid = new Prisma.Decimal(payment.amount ?? 0);
      paymentVerified = payable.equals(paid);
    }

    // 6. Documents Verified Gate
    let documentsVerified = true;
    if (quotation.motorDocuments && quotation.motorDocuments.length > 0) {
      const hasUnverifiedDocs = quotation.motorDocuments.some(
        (doc) => doc.verificationStatus !== 'VERIFIED',
      );
      if (hasUnverifiedDocs) {
        documentsVerified = false;
      }
    } else {
      const isNew = quotation.vehicle?.status === 'NEW';
      if (!isNew && quotation.motorDocuments.length === 0) {
        documentsVerified = false;
      }
    }

    // Compile blocking reasons
    const blockingReasons: string[] = [];
    if (!calculationValid) {
      blockingReasons.push(
        'Quotation premium calculation has not been finalized',
      );
    }
    if (!kycVerified) {
      blockingReasons.push('Customer KYC status is pending or unverified');
    }
    if (inspectionRequired && !inspectionCleared) {
      const inspStatus = quotation.motorInspection?.status || 'REQUIRED';
      blockingReasons.push(
        `Vehicle inspection is required (Current status: ${inspStatus})`,
      );
    }
    if (!proposalApproved) {
      blockingReasons.push('Insurance proposal has not been approved');
    }
    if (!paymentVerified) {
      if (!payment) {
        blockingReasons.push('Payment has not been recorded');
      } else if (payment.status !== 'PAID') {
        blockingReasons.push(
          `Payment verification pending with Finance (Current: ${payment.status})`,
        );
      } else {
        blockingReasons.push(
          'Paid amount does not match authoritative quotation premium',
        );
      }
    }
    if (!documentsVerified) {
      blockingReasons.push(
        'Vehicle & policy documents pending Back Office verification',
      );
    }

    // Determine Canonical State
    let canonicalState = 'DRAFT';
    if (
      quotation.policy ||
      quotation.workflowState === 'POLICY_ISSUED' ||
      quotation.issuanceStatus === 'ISSUED'
    ) {
      canonicalState = 'ISSUED';
    } else if (
      quotation.status === 'REJECTED' ||
      quotation.workflowState === 'REJECTED'
    ) {
      canonicalState = 'REJECTED';
    } else if (
      paymentVerified &&
      documentsVerified &&
      kycVerified &&
      proposalApproved &&
      inspectionCleared
    ) {
      canonicalState = 'PENDING_ISSUANCE';
    } else if (paymentVerified) {
      canonicalState = 'PAYMENT_VERIFIED';
    } else if (inspectionRequired && !inspectionCleared) {
      canonicalState = 'PENDING_INSPECTION';
    } else if (proposalApproved) {
      canonicalState = 'PAYMENT_PENDING';
    } else if (quotation.proposal) {
      canonicalState = 'PROPOSAL_CREATED';
    } else if (calculationValid) {
      canonicalState = 'QUOTED';
    }

    const canIssue =
      isBO &&
      calculationValid &&
      kycVerified &&
      proposalApproved &&
      inspectionCleared &&
      paymentVerified &&
      documentsVerified &&
      !quotation.policy;

    // Compute Allowed Actions for Actor
    const allowedActions: WorkflowAction[] = [];

    // EDIT_PROPOSAL
    if (
      !paymentVerified &&
      canonicalState !== 'ISSUED' &&
      canonicalState !== 'REJECTED'
    ) {
      if (isAgent || isBO) {
        allowedActions.push('EDIT_PROPOSAL');
      }
    }

    // SUBMIT_KYC
    if (!kycVerified && canonicalState !== 'ISSUED') {
      if (isAgent || isBO) {
        allowedActions.push('SUBMIT_KYC');
      }
    }

    // REQUEST_INSPECTION / PERFORM_INSPECTION
    if (
      inspectionRequired &&
      !inspectionCleared &&
      canonicalState !== 'ISSUED'
    ) {
      if (isBO) {
        allowedActions.push('PERFORM_INSPECTION');
        allowedActions.push('REQUEST_INSPECTION');
      }
    }

    // VERIFY_DOCUMENTS
    if (!documentsVerified && canonicalState !== 'ISSUED') {
      if (isBO) {
        allowedActions.push('VERIFY_DOCUMENTS');
      }
    }

    // RECORD_PAYMENT
    if (!paymentVerified && canonicalState !== 'ISSUED') {
      if (isFinance || isBO || isAgent) {
        allowedActions.push('RECORD_PAYMENT');
      }
    }

    // VERIFY_PAYMENT
    if (payment && payment.status !== 'PAID' && canonicalState !== 'ISSUED') {
      if (isFinance || isBO) {
        allowedActions.push('VERIFY_PAYMENT');
      }
    }

    // ISSUE_POLICY
    if (canIssue) {
      allowedActions.push('ISSUE_POLICY');
    }

    // DOWNLOAD_POLICY
    if (quotation.policy || canonicalState === 'ISSUED') {
      allowedActions.push('DOWNLOAD_POLICY');
    }

    return {
      quotationId: quotation.id,
      quotationCode: quotation.quotationCode,
      canonicalState,
      canIssue,
      blockingGates: {
        proposalApproved,
        paymentVerified,
        inspectionCleared,
        documentsVerified,
        kycVerified,
        calculationValid,
      },
      blockingReasons,
      allowedActions,
      meta: {
        totalPremium: quotation.totalPremium.toString(),
        paidAmount: payment?.amount ? payment.amount.toString() : undefined,
        kycStatus,
        inspectionStatus: quotation.motorInspection?.status,
        policyNumber: quotation.policy?.policyNumber,
      },
    };
  }
}
