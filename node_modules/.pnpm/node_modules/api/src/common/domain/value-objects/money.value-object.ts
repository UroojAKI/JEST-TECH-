import { Prisma } from '@prisma/client';

export class Money {
  private readonly amount: Prisma.Decimal;

  constructor(amount: number | string | Prisma.Decimal) {
    this.amount = new Prisma.Decimal(amount);
  }

  get value(): Prisma.Decimal {
    return this.amount;
  }

  add(other: Money): Money {
    return new Money(this.amount.add(other.value));
  }

  subtract(other: Money): Money {
    return new Money(this.amount.sub(other.value));
  }

  multiply(multiplier: number | string | Prisma.Decimal): Money {
    return new Money(this.amount.mul(multiplier));
  }

  static from(amount: number | string | Prisma.Decimal): Money {
    return new Money(amount);
  }

  static zero(): Money {
    return new Money(0);
  }

  /**
   * Calculates premium details from a base premium, a tax percentage, and a discount.
   * Total = (Base - Discount) * (1 + TaxPercentage/100)
   */
  static calculatePremium(
    basePremium: Money,
    taxPercentage: number,
    discountAmount: Money,
  ): {
    basePremium: Money;
    gstAmount: Money;
    discountAmount: Money;
    totalPremium: Money;
  } {
    const netAmount = basePremium.subtract(discountAmount);
    const taxRate = new Prisma.Decimal(taxPercentage).div(100);
    const gstAmount = netAmount.multiply(taxRate);
    const totalPremium = netAmount.add(gstAmount);

    return {
      basePremium,
      gstAmount,
      discountAmount,
      totalPremium,
    };
  }

  toString(): string {
    return this.amount.toString();
  }

  toNumber(): number {
    return this.amount.toNumber();
  }
}
