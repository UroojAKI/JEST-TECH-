import { Injectable } from '@nestjs/common';
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
    const sumInsuredNum = Number(
      dto.sumInsured ?? (dto as any).idvValue ?? (dto as any).idv ?? 850000,
    );
    const productTypeStr = dto.productType || 'MOTOR';
    const titleStr = dto.title || 'Motor Insurance Quotation';
    const insurerNameStr = dto.insurerName || 'HDFC ERGO General Insurance';

    // 1. Resolve Contact ID fallback safely
    let targetContactId = dto.contactId;

    if (!targetContactId) {
      const contacts = await this.contactsService.findAll();
      if (contacts && contacts.length > 0) {
        targetContactId = contacts[0].id;
      } else {
        const newContact = await this.contactsService.create(
          {
            firstName: 'Prospect',
            lastName: 'Customer',
            email: 'prospect@jestpolicy.com',
            phone: '+919876543210',
          } as any,
          createdById,
        );
        targetContactId = newContact.id;
      }
    }

    // 2. Perform engine pricing calculations
    let basePremiumCalculated = Number(
      (dto as any).basePremium ?? (dto as any).odPremium ?? 0,
    );

    if (!basePremiumCalculated || basePremiumCalculated === 0) {
      basePremiumCalculated = Math.round(sumInsuredNum * 0.02);
    }

    const addonsTotal = dto.addons
      ? this.addonsService.calculateAddonsTotal(dto.addons)
      : 0;

    const subtotal = basePremiumCalculated + addonsTotal;

    const discountResult = dto.discounts
      ? this.discountService.applyDiscounts(subtotal, dto.discounts)
      : { totalDiscountAmount: 0, discountedPremium: subtotal };

    const netPremium = discountResult.discountedPremium;
    const gstAmount =
      Number((dto as any).gstAmount) ||
      this.gstService.calculateGst(netPremium);
    const totalPremium =
      Number((dto as any).totalPremium) || netPremium + gstAmount;

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
      basePremium: new Prisma.Decimal(basePremiumCalculated),
      gstAmount: new Prisma.Decimal(gstAmount),
      totalPremium: new Prisma.Decimal(totalPremium),
      ncbPercentage: dto.ncbPercentage || 0,
      discountAmount: new Prisma.Decimal(discountResult.totalDiscountAmount || 0),
      expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : new Date(Date.now() + 30 * 86400000),
      contact: { connect: { id: targetContactId } },
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

    // 6. Write Side-effects
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
    const finalQuotation = await this.quotationRepository.findDetail(
      quotation.id,
    );
    return QuotationMapper.toResponse(finalQuotation!);
  }
}
