import { Module } from '@nestjs/common';
import { PaymentService } from './services/payment/payment.service';

@Module({
  providers: [PaymentService],
  exports: [PaymentService],
})
export class RevenueModule {}
