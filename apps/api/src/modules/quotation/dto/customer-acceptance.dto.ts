import { IsEnum, IsOptional, IsString, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum CustomerAcceptanceMethod {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  WHATSAPP = 'WHATSAPP',
  PHYSICAL_SIGNATURE = 'PHYSICAL_SIGNATURE',
  VERBAL_CALL_RECORDING = 'VERBAL_CALL_RECORDING',
  PORTAL_CLICK = 'PORTAL_CLICK',
}

export class CustomerAcceptanceDto {
  @ApiProperty({
    enum: CustomerAcceptanceMethod,
    description: 'Evidence channel via which the customer confirmed quotation acceptance',
    example: CustomerAcceptanceMethod.EMAIL,
  })
  @IsEnum(CustomerAcceptanceMethod)
  evidenceMethod: CustomerAcceptanceMethod;

  @ApiPropertyOptional({
    description: 'Identifier or reference for evidence (e.g. Email ID, Message ID, or Document Link)',
    example: 'EMAIL-MSG-20261014-98421',
  })
  @IsOptional()
  @IsString()
  evidenceReference?: string;

  @ApiPropertyOptional({
    description: 'Agreed statutory GST slab rate (5% or 18%)',
    example: 18,
  })
  @IsOptional()
  @IsIn([5, 18])
  selectedGstRate?: number;

  @ApiPropertyOptional({
    description: 'Underwriter / agent acceptance notes or comments',
    example: 'Customer confirmed acceptance of Comprehensive Package via registered email.',
  })
  @IsOptional()
  @IsString()
  comments?: string;
}
