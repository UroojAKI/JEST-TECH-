import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { QuotationStatus, PolicyStatus, PaymentStatus } from '@prisma/client';

import { QuotationRepository } from '../../repositories/quotation.repository';
import { QuotationMapper } from '../../mappers/quotation.mapper';
import { PrismaService } from '../../../../database/prisma.service';

@Injectable()
export class ConvertQuotationService {
  constructor(
    private readonly quotationRepository: QuotationRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(id: string, convertedById: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.quotation.findFirst({
        where: { id, deletedAt: null },
      });

      if (!existing) {
        throw new NotFoundException(`Quotation with ID ${id} not found`);
      }

      if (
        existing.status !== QuotationStatus.APPROVED &&
        existing.status !== QuotationStatus.DRAFT
      ) {
        throw new BadRequestException(
          `Cannot convert quotation in status ${existing.status}. Must be APPROVED or DRAFT first.`,
        );
      }

      // Check if policy already exists for this quotation
      const existingPolicy = await tx.policy.findFirst({
        where: { quotationId: id },
      });

      let policyId: string;
      let policyNumber: string;

      if (existingPolicy) {
        policyId = existingPolicy.id;
        policyNumber = existingPolicy.policyNumber;
      } else {
        try {
          const seqResult = await tx.$queryRaw<[{ nextval: bigint }]>`
            SELECT nextval('policy_number_seq')`;
          policyNumber = `POL-${seqResult[0].nextval.toString().padStart(6, '0')}`;
        } catch {
          const count = await tx.policy.count();
          policyNumber = `POL-${(count + 1001).toString().padStart(6, '0')}`;
        }

        // Create genuine Policy entity in database
        const newPolicy = await tx.policy.create({
          data: {
            policyNumber,
            status: PolicyStatus.ACTIVE,
            quotation: { connect: { id } },
            contact: { connect: { id: existing.contactId } },
            account: existing.accountId
              ? { connect: { id: existing.accountId } }
              : undefined,
            premiumAmount: existing.totalPremium,
            effectiveDate: new Date(),
            expiryDate: existing.expiryDate,
            createdBy: { connect: { id: convertedById } },
            updatedBy: { connect: { id: convertedById } },
            payments: {
              create: [
                {
                  amount: existing.totalPremium,
                  transactionId: `TXN-${policyNumber}`,
                  paymentMethod: 'ONLINE',
                  status: PaymentStatus.SUCCESS,
                },
              ],
            },
            histories: {
              create: [
                {
                  status: PolicyStatus.ACTIVE,
                  comments: `Policy issued from converted quotation ${existing.quotationCode}.`,
                  createdById: convertedById,
                },
              ],
            },
          },
        });
        policyId = newPolicy.id;
      }

      // Transition Quotation status
      await tx.quotation.update({
        where: { id },
        data: {
          status: QuotationStatus.CONVERTED_TO_POLICY,
          updatedBy: { connect: { id: convertedById } },
        },
      });

      await tx.quotationHistory.create({
        data: {
          quotationId: id,
          status: QuotationStatus.CONVERTED_TO_POLICY,
          comments: `Quotation converted to active Policy ${policyNumber}.`,
          createdById: convertedById,
        },
      });

      const quotation = await this.quotationRepository.findDetail(id);
      const mappedResponse = QuotationMapper.toResponse(quotation!);

      return {
        message: `Quotation ${existing.quotationCode} converted successfully to Policy ${policyNumber}.`,
        quotation: mappedResponse,
        policy: {
          id: policyId,
          policyNumber,
          contactId: existing.contactId,
          accountId: existing.accountId,
          premiumAmount: Number(existing.totalPremium),
          effectiveDate: new Date(),
          expiryDate: existing.expiryDate,
        },
      };
    });
  }
}
