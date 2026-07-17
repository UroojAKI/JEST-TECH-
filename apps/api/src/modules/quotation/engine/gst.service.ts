import { Injectable } from '@nestjs/common';

@Injectable()
export class GstService {
  private readonly GST_RATE = 0.18;

  /**
   * Applies the standard Indian 18% GST rate on the final premium.
   */
  calculateGst(premiumAfterDiscount: number): number {
    const gst = premiumAfterDiscount * this.GST_RATE;
    return Math.round(gst * 100) / 100;
  }
}
