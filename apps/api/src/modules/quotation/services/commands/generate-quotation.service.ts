import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, QuotationStatus } from '@prisma/client';

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
    // 1. Validate existences
    await this.contactsService.findById(dto.contactId);
    if (dto.accountId) {
      await this.accountsService.findById(dto.accountId);
    }

    // 2. Perform engine pricing calculations
    const basePremiumCalculated = this.premiumService.calculateBasePremium(
      dto.productType,
      dto.sumInsured,
    );

    const addonsTotal = dto.addons
      ? this.addonsService.calculateAddonsTotal(dto.addons)
      : 0;

    const subtotal = basePremiumCalculated + addonsTotal;

    const discountResult = dto.discounts
      ? this.discountService.applyDiscounts(subtotal, dto.discounts)
      : { totalDiscountAmount: 0, discountedPremium: subtotal };

    const netPremium = discountResult.discountedPremium;
    const gstAmount = this.gstService.calculateGst(netPremium);
    const totalPremium = netPremium + gstAmount;

    // 3. Generate Code
    const quotationCode = await this.quotationRepository.generateQuotationCode();

    // 4. Map DB Create Input
    const createData: Prisma.QuotationCreateInput = {
      quotationCode,
      title: dto.title,
      status: QuotationStatus.DRAFT,
      insurerName: dto.insurerName,
      productType: dto.productType,
      sumInsured: new Prisma.Decimal(dto.sumInsured),
      basePremium: new Prisma.Decimal(basePremiumCalculated),
      gstAmount: new Prisma.Decimal(gstAmount),
      totalPremium: new Prisma.Decimal(totalPremium),
      ncbPercentage: dto.ncbPercentage || 0,
      discountAmount: new Prisma.Decimal(discountResult.totalDiscountAmount),
      expiryDate: new Date(dto.expiryDate),
      contact: { connect: { id: dto.contactId } },
      createdBy: { connect: { id: createdById } },
      updatedBy: { connect: { id: createdById } },
    };

    if (dto.leadId) {
      createData.lead = { connect: { id: dto.leadId } };
    }

    if (dto.accountId) {
      createData.account = { connect: { id: dto.accountId } };
    }

    if (dto.addons && dto.addons.length > 0) {
      createData.addons = {
        create: dto.addons.map((a) => ({
          addonCode: a.addonCode,
          addonName: a.addonName,
          premium: new Prisma.Decimal(a.premium),
        })),
      };
    }

    if (dto.discounts && dto.discounts.length > 0) {
      createData.discounts = {
        create: dto.discounts.map((d) => ({
          discountType: d.discountType,
          percentage: d.percentage ? new Prisma.Decimal(d.percentage) : null,
          amount: new Prisma.Decimal(d.amount),
        })),
      };
    }

    // 5. Create Quotation in Database
    const quotation = await this.quotationRepository.create(createData);

    // 6. Write Side-effects (Version 1, History Entry, PDF Document)
    const pdfStub = this.pdfService.generatePdfStub(quotationCode);

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
        pdfStub.fileKey,
        pdfStub.fileName,
        pdfStub.fileSize,
      ),
    ]);

    // 7. Fetch updated details with versions and documents
    const finalQuotation = await this.quotationRepository.findDetail(quotation.id);
    return QuotationMapper.toResponse(finalQuotation!);
  }
}
