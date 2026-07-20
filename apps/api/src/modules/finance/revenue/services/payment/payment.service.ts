import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../../database/prisma.service';
import { Receipt, Invoice, PaymentAllocation } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class PaymentService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records a receipt and allocates it against an outstanding invoice.
   */
  async processPayment(invoiceId: string, amountStr: string, mode: string, reference?: string): Promise<{ receipt: Receipt, allocation: PaymentAllocation, invoice: Invoice }> {
    const amount = new Decimal(amountStr);

    if (amount.lte(0)) {
      throw new BadRequestException('Payment amount must be greater than zero');
    }

    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { allocations: true },
    });

    if (!invoice) throw new BadRequestException('Invoice not found');

    // Calculate outstanding
    let paidAmount = new Decimal(0);
    for (const alloc of invoice.allocations) {
      paidAmount = paidAmount.add(alloc.amount);
    }
    const outstanding = invoice.totalAmount.sub(paidAmount);

    if (amount.gt(outstanding)) {
      throw new BadRequestException(`Payment amount (${amount}) exceeds outstanding balance (${outstanding})`);
    }

    const receiptNum = `RCPT-${Date.now()}`;

    // Transaction to create receipt, allocate, and update invoice status
    const result = await this.prisma.$transaction(async (tx) => {
      const receipt = await tx.receipt.create({
        data: {
          receiptNum,
          amount,
          paymentMode: mode,
          reference,
          customerId: 'customer-1', // Assuming tied to customer, simplified for now
        }
      });

      const allocation = await tx.paymentAllocation.create({
        data: {
          receiptId: receipt.id,
          invoiceId: invoice.id,
          amount,
        }
      });

      const newPaidAmount = paidAmount.add(amount);
      let status = 'PARTIAL';
      if (newPaidAmount.equals(invoice.totalAmount)) {
        status = 'PAID';
      }

      const updatedInvoice = await tx.invoice.update({
        where: { id: invoice.id },
        data: { status },
      });

      return { receipt, allocation, invoice: updatedInvoice };
    });

    return result;
  }
}
