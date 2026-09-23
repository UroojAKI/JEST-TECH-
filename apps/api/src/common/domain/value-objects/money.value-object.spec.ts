import { Money } from './money.value-object';
import { Prisma } from '@prisma/client';

describe('Money Value Object & Premium Calculation Invariance (F-039)', () => {
  it('correctly creates instances from number, string, and Decimal', () => {
    const m1 = Money.from(100.5);
    const m2 = Money.from('200.75');
    const m3 = Money.from(new Prisma.Decimal('300.25'));
    const zero = Money.zero();

    expect(m1.toNumber()).toBe(100.5);
    expect(m2.toString()).toBe('200.75');
    expect(m3.toNumber()).toBe(300.25);
    expect(zero.toNumber()).toBe(0);
  });

  it('performs exact addition and subtraction without floating-point errors', () => {
    const a = Money.from('0.1');
    const b = Money.from('0.2');
    const sum = a.add(b);
    expect(sum.toString()).toBe('0.3');

    const c = Money.from('100.00');
    const d = Money.from('25.50');
    const diff = c.subtract(d);
    expect(diff.toString()).toBe('74.5');
  });

  it('performs arbitrary-precision multiplication', () => {
    const amount = Money.from('1000.00');
    const gstRate = '0.18';
    const gst = amount.multiply(gstRate);
    expect(gst.toString()).toBe('180');
  });

  it('calculates full premium breakdown with discount and statutory GST (F-039)', () => {
    const base = Money.from(10000);
    const discount = Money.from(1000);
    const taxPercentage = 18; // 18% GST

    // Net Amount = 10000 - 1000 = 9000
    // GST = 9000 * 0.18 = 1620
    // Total = 9000 + 1620 = 10620
    const result = Money.calculatePremium(base, taxPercentage, discount);

    expect(result.basePremium.toNumber()).toBe(10000);
    expect(result.discountAmount.toNumber()).toBe(1000);
    expect(result.gstAmount.toNumber()).toBe(1620);
    expect(result.totalPremium.toNumber()).toBe(10620);
  });

  it('handles zero discount calculation accurately', () => {
    const base = Money.from(5000);
    const result = Money.calculatePremium(base, 18, Money.zero());

    expect(result.discountAmount.toNumber()).toBe(0);
    expect(result.gstAmount.toNumber()).toBe(900);
    expect(result.totalPremium.toNumber()).toBe(5900);
  });
});
