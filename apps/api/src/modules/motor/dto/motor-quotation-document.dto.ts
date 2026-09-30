import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { MotorDocumentType, DocumentVerificationStatus } from '@prisma/client';

export class AttachMotorDocumentDto {
  @IsUUID()
  documentId: string;

  @IsEnum(MotorDocumentType)
  documentType: MotorDocumentType;
}

export class VerifyMotorDocumentDto {
  @IsEnum(DocumentVerificationStatus)
  status: DocumentVerificationStatus;

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}