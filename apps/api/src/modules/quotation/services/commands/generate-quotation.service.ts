import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma, QuotationStatus, AddonCode } from '@prisma/client';

import { QuotationRepository } from '../../repositories/quotation.repository';
import { QuotationMapper } from '../../mappers/quotation.mapper';
import { CreateQuotationDto } from '../../dto/create-quotation.dto';

import { PremiumService } from '../../engine/premium.service';
import { GstService } from '../../engine/gst.service';
import { DiscountService } from '../../engine/discount.service';
import { AddonsService } from '../../engine/addons.service';
import { PdfService } from '../../engine/pdf.service';

import { ContactsService } from '../../../contacts/services/contacts.service';
import { AccountsService } from '../../../accounts/services/accounts.service';

@Injectable()
export class GenerateQuotationService {
  constructor(
    private readonly quotationRepository: QuotationRepository,
    private readonly premiumService: PremiumService,
    private readonly gstService: GstService,
    private readonly discountService: DiscountService,
    private readonly addonsService: AddonsService,
    private readonly pdfService: PdfService,
    private readonly contactsService: ContactsService,
    private readonly accountsService: AccountsService,
  ) {}

  async execute(dto: CreateQuotationDto, createdById: string) {
    if (!dto.contactId) {
      throw new BadRequestException(
        'contactId is required to generate quotation. Manufacture of unverified customer is forbidden in production.',
      );
    }

    const sumInsuredRaw =
      dto.sumInsured ?? (dto as any).idvValue ?? (dto as any).idv;
    if (!sumInsuredRaw || Number(sumInsuredRaw) <= 0) {
      throw new BadRequestException(
        'sumInsured (IDV) must be a positive number to calculate an authoritative quotation.',
      );
    }

    if (!dto.insurerName?.trim()) {
      throw new BadRequestException(
        'insurerName is required to bind quotation to an authoritative insurer partner.',
      );
    }

    const sumInsuredNum = Number(sumInsuredRaw);
    const productTypeStr = dto.productType || 'MOTOR';
    const titleStr =
      dto.title || `${dto.insurerName} ${productTypeStr} Insurance Quotation`;
    const insurerNameStr = dto.insurerName;
    const targetContactId = dto.contactId;

    // 2. Perform authoritative engine pricing calculations
    let baseOd = Number((dto as any).odPremium || 0);
    if (!baseOd || baseOd === 0) {
      baseOd = Math.round(sumInsuredNum * 0.03127);
    }

    const ncbPercent = Number(dto.ncbPercentage || 0);
    const ncbDiscount = Math.round(baseOd * (ncbPercent / 100));
    const odAfterNcb = Math.max(0, baseOd - ncbDiscount);

    let discountPercent = Number((dto as any).discountPercent || 0);
    if (!discountPercent && dto.discounts && dto.discounts.length > 0) {
      discountPercent = dto.discounts[0].percentage || 0;
    }
    const specialOdDiscount = Math.round(odAfterNcb * (discountPercent / 100));
    const netOd = Math.max(0, odAfterNcb - specialOdDiscount);

    const addonsTotal = dto.addons
      ? this.addonsService.calculateAddonsTotal(dto.addons)
      : 0;

    let baseTp = Number((dto as any).tpPremium || 0);
    if (!baseTp && productTypeStr.toUpperCase().includes('MOTOR')) {
      baseTp = 3416;
    }

    // Option A: Gross Pre-Tax -> GST on Gross -> Discounts on premium components -> Net Customer Premium + unchanged GST = Final Payable
    const grossPreTaxPremium = baseOd + addonsTotal + baseTp;
    const totalDiscountAmount = ncbDiscount + specialOdDiscount;
    const netCustomerPremium = netOd + addonsTotal + baseTp;
    const gstAmount = Math.round(grossPreTaxPremium * 0.18);
    const totalPremium = netCustomerPremium + gstAmount;

    // 3. Generate Code
    const quotationCode =
      await this.quotationRepository.generateQuotationCode();

    // 4. Map DB Create Input
    const createData: Prisma.QuotationCreateInput = {
      quotationCode,
      title: titleStr,
      status: QuotationStatus.DRAFT,
      insurerName: insurerNameStr,
      productType: productTypeStr,
      sumInsured: new Prisma.Decimal(sumInsuredNum),
      basePremium: new Prisma.Decimal(netCustomerPremium),
      gstAmount: new Prisma.Decimal(gstAmount),
      totalPremium: new Prisma.Decimal(totalPremium),
      ncbPercentage: dto.ncbPercentage || 0,
      discountAmount: new Prisma.Decimal(totalDiscountAmount || 0),
      expiryDate: dto.expiryDate
        ? new Date(dto.expiryDate)
        : new Date(Date.now() + 30 * 86400000),
      contact: { connect: { id: targetContactId } },
      createdBy: { connect: { id: createdById } },
      updatedBy: { connect: { id: createdById } },
      vehicleCategory: dto.vehicleCategory as any,
      registrationNumber: dto.registrationNumber,
      policyTenure: dto.policyTenure || 1,
      activeTpInsurer: dto.activeTpInsurer,
      activeTpPolicyNumber: dto.activeTpPolicyNumber,
      activeTpExpiryDate: dto.activeTpExpiryDate
        ? new Date(dto.activeTpExpiryDate)
        : undefined,
    };

    // vehicleId legacy block removed pending 8-category mapping logic
    if (dto.leadId) {
      createData.lead = { connect: { id: dto.leadId } };
    }

    if (dto.accountId) {
      createData.account = { connect: { id: dto.accountId } };
    }

    if (dto.addons && dto.addons.length > 0) {
      createData.addons = {
        create: dto.addons.map((a) => ({
          addonCode: a.addonCode as AddonCode,
          addonName: a.addonName,
          premium: new Prisma.Decimal(a.premium || 0),
        })),
      };
    }

    if (dto.discounts && dto.discounts.length > 0) {
      createData.discounts = {
        create: dto.discounts.map((d) => ({
          discountType: d.discountType,
          percentage: d.percentage ? new Prisma.Decimal(d.percentage) : null,
          amount: new Prisma.Decimal(d.amount || 0),
        })),
      };
    }

    // 5. Create Quotation in Database
    const quotation = await this.quotationRepository.create(createData);

    // 6. Write Side-effects (Authoritative signed PDF)
    const pdfDoc = await this.pdfService.generateDocumentPdf(
      'Motor Insurance Quotation',
      quotationCode,
      {
        'Quotation Code': quotationCode,
        'Insurer': quotation.insurerName,
        'Product': quotation.productType,
        'Sum Insured (IDV)': `Rs. ${quotation.sumInsured.toString()}`,
        'Net Customer Premium': `Rs. ${quotation.basePremium.toString()}`,
        'Statutory GST (18%)': `Rs. ${quotation.gstAmount.toString()}`,
        'Final Payable Total': `Rs. ${quotation.totalPremium.toString()}`,
        'Discount Applied': `Rs. ${quotation.discountAmount.toString()}`,
        'NCB Percentage': `${quotation.ncbPercentage}%`,
      },
    );

    await Promise.all([
      this.quotationRepository.createVersion({
        quotation: { connect: { id: quotation.id } },
        versionNumber: 1,
        sumInsured: quotation.sumInsured,
        basePremium: quotation.basePremium,
        gstAmount: quotation.gstAmount,
        totalPremium: quotation.totalPremium,
        discountAmount: quotation.discountAmount,
        createdBy: { connect: { id: createdById } },
      }),

      this.quotationRepository.addHistoryEntry(
        quotation.id,
        QuotationStatus.DRAFT,
        'Quotation generated successfully.',
        createdById,
      ),

      this.quotationRepository.addDocument(
        quotation.id,
        'QUOTE_PDF',
        pdfDoc.fileKey,
        pdfDoc.fileName,
        pdfDoc.fileSize,
      ),
    ]);

    // 7. Fetch updated details with versions and documents
    const finalQuotation = await this.quotationRepository.findDetail(
      quotation.id,
    );
    return QuotationMapper.toResponse(finalQuotation!);
  }
}
