import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { MotorPolicyType } from '@prisma/client';

export class CreateMotorQuotationDto {
  @ApiProperty({ description: 'Lead ID' })
  @IsNotEmpty()
  @IsUUID()
  leadId: string;

  @ApiProperty({ description: 'Vehicle ID' })
  @IsNotEmpty()
  @IsUUID()
  vehicleId: string;

  @ApiProperty({
    description:
      'Insurer Company Name (e.g. HDFC ERGO, ICICI Lombard, Tata AIG)',
  })
  @IsNotEmpty()
  @IsString()
  insurerName: string;

  @ApiPropertyOptional({ description: 'Plan or Package Name' })
  @IsOptional()
  @IsString()
  planName?: string;

  @ApiProperty({
    enum: MotorPolicyType,
    default: MotorPolicyType.PACKAGE_COMPREHENSIVE,
  })
  @IsOptional()
  @IsEnum(MotorPolicyType)
  policyType?: MotorPolicyType = MotorPolicyType.PACKAGE_COMPREHENSIVE;

  @ApiPropertyOptional({ description: 'Insured Declared Value (?)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  idv?: number;

  @ApiPropertyOptional({ description: 'Own Damage Premium (?)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  odPremium?: number;

  @ApiPropertyOptional({ description: 'Third Party Premium (?)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  tpPremium?: number;

  @ApiPropertyOptional({ description: 'Add-on Covers Premium (?)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  addonPremium?: number;

  @ApiPropertyOptional({ description: 'NCB Discount Amount (?)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  ncbDiscount?: number;

  @ApiPropertyOptional({ description: 'Special / Other Discounts Amount (?)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  otherDiscounts?: number;

  @ApiPropertyOptional({ description: 'Net Premium before GST (?)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  netPremium?: number;

  @ApiPropertyOptional({ description: 'GST 18% Amount (?)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  gstAmount?: number;

  @ApiProperty({ description: 'Final Payable Premium including GST (?)' })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  finalPremium: number;

  @ApiPropertyOptional({ description: 'Full calculation breakup details' })
  @IsOptional()
  @IsObject()
  breakup?: Record<string, any>;

  @ApiPropertyOptional({ description: 'List of selected addon cover codes' })
  @IsOptional()
  addonsSelected?: any;
}
