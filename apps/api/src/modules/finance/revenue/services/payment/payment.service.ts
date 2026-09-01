import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../../database/prisma.service';
import { Receipt, Invoice, PaymentAllocation } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class PaymentService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records a receipt and allocates it against an outstanding invoice.
   * The invoice row is locked and re-read inside the transaction so two
   * concurrent payment requests cannot both spend the same outstanding balance.
   */
  async processPayment(
    invoiceId: string,
    amountStr: string,
    mode: string,
    reference?: string,
  ): Promise<{
    receipt: Receipt;
    allocation: PaymentAllocation;
    invoice: Invoice;
  }> {
    const amount = new Decimal(amountStr);

    if (amount.lte(0)) {
      throw new BadRequestException('Payment amount must be greater than zero');
    }

    if (!mode?.trim()) {
      throw new BadRequestException('Payment mode is required');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Pessimistically lock the authoritative invoice row for this transaction.
      const lockedRows = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "Invoice" WHERE id = ${invoiceId} FOR UPDATE
      `;

      if (!lockedRows.length) {
        throw new BadRequestException('Invoice not found');
      }

      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        include: { allocations: true },
      });

      if (!invoice) throw new BadRequestException('Invoice not found');

      if (invoice.status === 'PAID' || invoice.status === 'VOID') {
        throw new BadRequestException(
          `Invoice is not payable in ${invoice.status} status`,
        );
      }

      let paidAmount = new Decimal(0);
      for (const allocation of invoice.allocations) {
        paidAmount = paidAmount.add(allocation.amount);
      }

      const outstanding = invoice.totalAmount.sub(paidAmount);

      if (outstanding.lte(0)) {
        throw new BadRequestException('Invoice has no outstanding balance');
      }

      if (amount.gt(outstanding)) {
        throw new BadRequestException(
          `Payment amount (${amount}) exceeds outstanding balance (${outstanding})`,
        );
      }

      // The invoice is authoritative for the commercial entity. In the current
      // schema invoices are linked to policies via entityId, and policies carry
      // the authoritative customer/contact relationship.
      if (invoice.entityType !== 'POLICY') {
        throw new BadRequestException(
          `Unsupported invoice entity type: ${invoice.entityType}`,
        );
      }

      const policy = await tx.policy.findUnique({
        where: { id: invoice.entityId },
        select: { id: true, contactId: true },
      });

      if (!policy?.contactId) {
        throw new BadRequestException(
          'Invoice is not linked to a valid policy customer',
        );
      }

      const sequenceRows = await tx.$queryRaw<Array<{ nextval: bigint }>>`
        SELECT nextval('receipt_number_seq')
      `;
      const sequenceNumber = sequenceRows[0]?.nextval;
      if (sequenceNumber === undefined) {
        throw new BadRequestException('Unable to allocate receipt number');
      }

      const receiptNum = `RCPT-${sequenceNumber.toString().padStart(8, '0')}`;

      const receipt = await tx.receipt.create({
        data: {
          receiptNum,
          amount,
          paymentMode: mode.trim(),
          reference,
          customerId: policy.contactId,
        },
      });

      const allocation = await tx.paymentAllocation.create({
        data: {
          receiptId: receipt.id,
          invoiceId: invoice.id,
          amount,
        },
      });

      const newPaidAmount = paidAmount.add(amount);
      const status = newPaidAmount.equals(invoice.totalAmount)
        ? 'PAID'
        : 'PARTIAL';

      const updatedInvoice = await tx.invoice.update({
        where: { id: invoice.id },
        data: { status },
      });

      await tx.auditLog.create({
        data: {
          action: 'CREATE',
          entity: 'Receipt',
          entityId: receipt.id,
          module: 'FINANCE',
          metadata: {
            invoiceId: invoice.id,
            policyId: policy.id,
            customerId: policy.contactId,
            amount: amount.toString(),
            paymentMode: mode.trim(),
          },
          newValue: {
            receiptId: receipt.id,
            invoiceStatus: status,
          },
        },
      });

      return {
        receipt,
        allocation,
        invoice: updatedInvoice,
      };
    });

    return result;
  }
}
