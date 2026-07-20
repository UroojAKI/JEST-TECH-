import {
  Controller,
  Get,
  Param,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';
import { Customer360Service } from './customer-360.service';
import { JwtAuthGuard } from '../../../../auth/guards/jwt-auth.guard';

@Controller('customer-360')
@UseGuards(JwtAuthGuard)
@UseInterceptors(CacheInterceptor)
export class Customer360Controller {
  constructor(private readonly customer360Service: Customer360Service) {}

  @Get(':id')
  @CacheKey('customer_360')
  @CacheTTL(120000) // 2 minutes TTL
  async getCustomer360(@Param('id') id: string) {
    return this.customer360Service.getCustomerProfile(id);
  }
}
