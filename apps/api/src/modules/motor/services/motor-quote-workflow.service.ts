import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { MotorRuleEngineService, MotorRuleContext } from './motor-rule-engine.service';

export interface CapturePreviousPolicyDto {
  quotationId: string;
  policyExpiryDate?: string; // ISO date string
  ownershipTransfer: boolean;
  previousPolicyType?: 'COMPREHENSIVE' | 'THIRD_PARTY' | 'SAOD' | 'NOT_AVAILABLE';
  previousInsurerName?: string;
  previousPolicyNumber?: string;
  previousOdInsurerName?: string;
  previousOdPolicyNumber?: string;
  odExpiryDate?: string;
  tpExpiryDate?: string;
  claimInPreviousYear: boolean;
  previousPolicyTransferred?: boolean;
  rcTransferStatus?: boolean;
  newOwnerName?: string;
  previousPolicyCopyUrl?: string;
  eligibleNcbPercentage: number;
  newPolicyType: 'TP_ONLY' | 'SAOD' | 'PACKAGE';
  newInsurerName?: string;
}

@Injectable()
export class MotorQuoteWorkflowService {
  private readonly logger = new Logger(MotorQuoteWorkflowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ruleEngine: MotorRuleEngineService,
  ) {}

  /**
   * Capture previous policy details, run the rule engine, and persist the audit record.
   * Returns the rule evaluation result — frontend renders based on this.
   * The backend is the ONLY place NCB, inspection requirement, etc. are decided.
   */
  async capturePreviousPolicyAndEvaluate(dto: CapturePreviousPolicyDto) {
    const quotation = await this.prisma.quotation.findUnique({
      where: { id: dto.quotationId },
    });
    if (!quotation) throw new NotFoundException(`Quotation ${dto.quotationId} not found`);

    const today = new Date();
    const expiryDate = dto.policyExpiryDate ? new Date(dto.policyExpiryDate) : null;
    const ninetyDaysAgo = new Date(today);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const expiredMoreThan90Days = expiryDate ? expiryDate < ninetyDaysAgo : false;

    // 1. Save or update the previous policy record
    const prevPolicy = await this.prisma.motorPreviousPolicy.upsert({
      where: { quotationId: dto.quotationId },
      create: {
        quotationId: dto.quotationId,
        policyExpiryDate: expiryDate,
        expiredMoreThan90Days,
        ownershipTransfer: dto.ownershipTransfer,
        previousPolicyType: dto.previousPolicyType as any,
        previousInsurerName: dto.previousInsurerName,
        previousPolicyNumber: dto.previousPolicyNumber,
        previousOdInsurerName: dto.previousOdInsurerName,
        previousOdPolicyNumber: dto.previousOdPolicyNumber,
        odExpiryDate: dto.odExpiryDate ? new Date(dto.odExpiryDate) : null,
        tpExpiryDate: dto.tpExpiryDate ? new Date(dto.tpExpiryDate) : null,
        claimInPreviousYear: dto.claimInPreviousYear,
        policyTransferStatus: dto.previousPolicyTransferred,
        rcTransferStatus: dto.rcTransferStatus,
        newOwnerName: dto.newOwnerName,
        previousPolicyCopyUrl: dto.previousPolicyCopyUrl,
      },
      update: {
        policyExpiryDate: expiryDate,
        expiredMoreThan90Days,
        ownershipTransfer: dto.ownershipTransfer,
        previousPolicyType: dto.previousPolicyType as any,
        previousInsurerName: dto.previousInsurerName,
        previousPolicyNumber: dto.previousPolicyNumber,
        previousOdInsurerName: dto.previousOdInsurerName,
        previousOdPolicyNumber: dto.previousOdPolicyNumber,
        odExpiryDate: dto.odExpiryDate ? new Date(dto.odExpiryDate) : null,
        tpExpiryDate: dto.tpExpiryDate ? new Date(dto.tpExpiryDate) : null,
        claimInPreviousYear: dto.claimInPreviousYear,
        policyTransferStatus: dto.previousPolicyTransferred,
        rcTransferStatus: dto.rcTransferStatus,
        newOwnerName: dto.newOwnerName,
        previousPolicyCopyUrl: dto.previousPolicyCopyUrl,
      },
    });

    // 2. Build rule engine context
    const context: MotorRuleContext = {
      policyExpiryDate: expiryDate,
      expiredMoreThan90Days,
      ownershipTransfer: dto.ownershipTransfer,
      previousPolicyTransferred: dto.previousPolicyTransferred,
      claimInPreviousYear: dto.claimInPreviousYear,
      previousPolicyType: dto.previousPolicyType as any,
      newPolicyType: dto.newPolicyType,
      newInsurerName: dto.newInsurerName,
      previousInsurerName: dto.previousInsurerName,
      tpExpiryDate: dto.tpExpiryDate ? new Date(dto.tpExpiryDate) : null,
      odExpiryDate: dto.odExpiryDate ? new Date(dto.odExpiryDate) : null,
      eligibleNcbPercentage: dto.eligibleNcbPercentage,
      newOwnerName: dto.newOwnerName,
      quotationDate: today,
    };

    // 3. Run the rule engine — backend is SOLE authority
    const result = this.ruleEngine.evaluateQuotation(context);

    // 4. Persist the evaluation (audit record — not the source of truth)
    await this.prisma.motorRuleEvaluation.upsert({
      where: { quotationId: dto.quotationId },
      create: {
        quotationId: dto.quotationId,
        previousPolicyId: prevPolicy.id,
        inspectionRequired: result.inspectionRequired,
        inspectionReasons: result.inspectionReasons,
        ncb: result.ncb,
        ncbReason: result.ncbReason as any,
        eligibleNcb: result.eligibleNcb,
        tpVerificationRequired: result.tpVerificationRequired,
        policyTransferRequired: result.policyTransferRequired,
        saodTpValid: result.saodTpValid,
        missingDocuments: result.missingDocuments,
        nextStep: result.nextStep,
        evaluationContext: context as any,
      },
      update: {
        inspectionRequired: result.inspectionRequired,
        inspectionReasons: result.inspectionReasons,
        ncb: result.ncb,
        ncbReason: result.ncbReason as any,
        eligibleNcb: result.eligibleNcb,
        tpVerificationRequired: result.tpVerificationRequired,
        policyTransferRequired: result.policyTransferRequired,
        saodTpValid: result.saodTpValid,
        missingDocuments: result.missingDocuments,
        nextStep: result.nextStep,
        evaluationContext: context as any,
        evaluatedAt: new Date(),
      },
    });

    // 5. Update quotation workflow state
    await this.prisma.quotation.update({
      where: { id: dto.quotationId },
      data: {
        workflowState: result.inspectionRequired ? 'INSPECTION_REQUIRED' : 'RULES_EVALUATED',
        ncbPercentage: result.ncb,
      },
    });

    this.logger.log(`Previous policy captured and rules evaluated for quotation ${dto.quotationId}`);
    return { previousPolicy: prevPolicy, ruleEvaluation: result };
  }

  /**
   * Re-evaluate rules from stored data. Never trust the stored result as source of truth.
   * Always recalculate from the source context.
   */
  async reEvaluate(quotationId: string) {
    const prevPolicy = await this.prisma.motorPreviousPolicy.findUnique({
      where: { quotationId },
      include: { ruleEvaluation: true },
    });
    if (!prevPolicy) throw new NotFoundException(`No previous policy found for quotation ${quotationId}`);

    const quotation = await this.prisma.quotation.findUnique({ where: { id: quotationId } });
    if (!quotation) throw new NotFoundException(`Quotation ${quotationId} not found`);

    const evaluationContext = prevPolicy.ruleEvaluation?.evaluationContext as any;
    if (!evaluationContext) throw new NotFoundException(`No evaluation context found`);

    // Rebuild context from stored snapshot and re-run
    const context: MotorRuleContext = {
      ...evaluationContext,
      policyExpiryDate: evaluationContext.policyExpiryDate ? new Date(evaluationContext.policyExpiryDate) : null,
      tpExpiryDate: evaluationContext.tpExpiryDate ? new Date(evaluationContext.tpExpiryDate) : null,
      odExpiryDate: evaluationContext.odExpiryDate ? new Date(evaluationContext.odExpiryDate) : null,
      quotationDate: new Date(),
    };

    return this.ruleEngine.evaluateQuotation(context);
  }
}
