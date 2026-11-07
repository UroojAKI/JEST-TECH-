import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreatePosDocumentDto {
  @IsString()
  @IsNotEmpty({ message: 'documentType is mandatory' })
  documentType: string;

  @IsString()
  @IsNotEmpty({ message: 'storageKey is mandatory' })
  storageKey: string;

  @IsString()
  @IsNotEmpty({ message: 'fileName is mandatory' })
  fileName: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  fileSize?: number;

  @IsOptional()
  @IsString()
  expiryDate?: string;
}
