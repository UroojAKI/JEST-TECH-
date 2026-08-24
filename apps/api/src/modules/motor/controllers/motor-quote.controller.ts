import { Controller, Post, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { MotorCalculationService } from '../services/motor-calculation.service';
import { PrismaService } from '../../../database/prisma.service';
import { MotorCalculationInputDto } from '../dto/motor-calculation.dto';

@Controller('motor/quotes')
@UseGuards(JwtAuthGuard)
export class MotorQuoteController {
  constructor(
    private readonly calculationService: MotorCalculationService,
    private readonly prisma: PrismaService,
  ) {}

  @Post(':id/finalize')
  async finalizeQuote(
    @Param('id') id: string,
    @Body() input: MotorCalculationInputDto
  ) {
    // 1. Authoritative Backend Calculation
    const calcResult = await this.calculationService.calculate(input);

    // 2. Persist the snapshot
    const quote = await this.prisma.quotation.update({
      where: { id },
      data: {
        totalPremium: calcResult.outputs.totalPremium,
        basePremium: calcResult.outputs.baseOdPremium + calcResult.outputs.baseTpPremium,
        gstAmount: calcResult.outputs.totalGst,
        calculationSnapshot: calcResult as any,
        calculationVersion: calcResult.calculationVersion,
        rateConfigurationVersion: calcResult.rateConfigurationVersion,
        issuanceStatus: 'PROPOSAL_READY'
      }
    });
    return quote;
  }

  @Post(':id/issue')
  async issuePolicy(
    @Param('id') quoteId: string,
    @Body() body: { actualPolicyNumber: string; actualPremium: number; startDate: string; endDate: string; documentUrl?: string; }
  ) {
    const quote = await this.prisma.quotation.findUnique({
      where: { id: quoteId },
      include: { contact: true, lead: true }
    });

    if (!quote) throw new Error('Quotation not found');

    // Update Quotation Status
    await this.prisma.quotation.update({
      where: { id: quoteId },
      data: {
        issuanceStatus: 'ISSUED',
        status: 'CONVERTED_TO_POLICY'
      }
    });
    
    // Parse snapshot to get policy type for OD/TP dates logic
    const snapshot = quote.calculationSnapshot as any;
    const policyType = snapshot?.inputs?.policyType;
    let odExpiry: Date | null = null;
    let tpExpiry: Date | null = null;

    if (body.endDate) {
      const parsedEndDate = new Date(body.endDate);
      if (policyType === 'THIRD_PARTY_ONLY') {
        tpExpiry = parsedEndDate;
      } else if (policyType === 'SAOD') {
        odExpiry = parsedEndDate;
      } else {
        // PACKAGE
        odExpiry = parsedEndDate;
        // Check if tenure is multi-year (e.g. 3yr TP)
        const tenure = snapshot?.inputs?.policyTenure || 1;
        if (tenure > 1) {
          const tpEndDate = new Date(body.startDate);
          tpEndDate.setFullYear(tpEndDate.getFullYear() + tenure);
          tpExpiry = tpEndDate;
        } else {
          tpExpiry = parsedEndDate;
        }
      }
    }

    // Create or update the actual Policy record
    const policy = await this.prisma.policy.create({
      data: {
        policyNumber: body.actualPolicyNumber || `POL-${Date.now()}`,
        actualPolicyNumber: body.actualPolicyNumber,
        contact: { connect: { id: quote.contactId } },
        quotation: { connect: { id: quoteId } },
        premiumAmount: quote.totalPremium,
        actualPremium: body.actualPremium || quote.totalPremium,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        effectiveDate: new Date(body.startDate),
        expiryDate: new Date(body.endDate),
        odExpiryDate: odExpiry,
        tpExpiryDate: tpExpiry,
        paymentStatus: 'PAID' as any,
        status: 'ACTIVE' as any,
        ...(quote.createdById ? { createdBy: { connect: { id: quote.createdById } } } : {}),
        // Lead relation
        ...(quote.leadId ? { lead: { connect: { id: quote.leadId } } } : {})
      }
    });

    return policy;
  }
}
