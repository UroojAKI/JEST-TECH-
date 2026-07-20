import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from './payment.service';
import { PrismaService } from '../../../../../database/prisma.service';
import { BadRequestException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';

describe('PaymentService', () => {
  let service: PaymentService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        {
          provide: PrismaService,
          useValue: {
            invoice: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            receipt: {
              create: jest.fn(),
            },
            paymentAllocation: {
              create: jest.fn(),
            },
            $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
          },
        },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should throw if payment amount is zero or negative', async () => {
    await expect(service.processPayment('inv-1', '0', 'CASH')).rejects.toThrow(BadRequestException);
    await expect(service.processPayment('inv-1', '-50', 'CASH')).rejects.toThrow(BadRequestException);
  });

  it('should throw if payment exceeds outstanding balance', async () => {
    jest.spyOn(prisma.invoice, 'findUnique').mockResolvedValue({
      id: 'inv-1',
      totalAmount: new Decimal(1000),
      allocations: [
        { amount: new Decimal(600) }, // 400 outstanding
      ]
    } as any);

    await expect(service.processPayment('inv-1', '500', 'CASH')).rejects.toThrow(/exceeds outstanding balance/);
  });

  it('should mark invoice as PARTIAL if payment is less than outstanding', async () => {
    jest.spyOn(prisma.invoice, 'findUnique').mockResolvedValue({
      id: 'inv-1',
      totalAmount: new Decimal(1000),
      allocations: [],
    } as any);

    jest.spyOn(prisma.receipt, 'create').mockResolvedValue({ id: 'rcpt-1' } as any);
    jest.spyOn(prisma.paymentAllocation, 'create').mockResolvedValue({ id: 'alloc-1' } as any);
    jest.spyOn(prisma.invoice, 'update').mockResolvedValue({ id: 'inv-1', status: 'PARTIAL' } as any);

    const result = await service.processPayment('inv-1', '400', 'CASH');

    expect(result.invoice.status).toBe('PARTIAL');
    expect(prisma.invoice.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { status: 'PARTIAL' }
    }));
  });

  it('should mark invoice as PAID if payment completes the balance', async () => {
    jest.spyOn(prisma.invoice, 'findUnique').mockResolvedValue({
      id: 'inv-1',
      totalAmount: new Decimal(1000),
      allocations: [
        { amount: new Decimal(600) }, // 400 outstanding
      ],
    } as any);

    jest.spyOn(prisma.receipt, 'create').mockResolvedValue({ id: 'rcpt-1' } as any);
    jest.spyOn(prisma.paymentAllocation, 'create').mockResolvedValue({ id: 'alloc-1' } as any);
    jest.spyOn(prisma.invoice, 'update').mockResolvedValue({ id: 'inv-1', status: 'PAID' } as any);

    const result = await service.processPayment('inv-1', '400', 'CASH');

    expect(result.invoice.status).toBe('PAID');
    expect(prisma.invoice.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { status: 'PAID' }
    }));
  });
});
