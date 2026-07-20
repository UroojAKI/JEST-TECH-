import { Module } from '@nestjs/common';
import { Customer360Service } from './services/customer-360/customer-360.service';
import { Customer360Controller } from './services/customer-360/customer-360.controller';

@Module({
  providers: [Customer360Service],
  controllers: [Customer360Controller],
})
export class Customer360Module {}
