import { IsOptional, IsString, IsNumber, Min } from 'class-validator';

export class UpdateClaimDto {
  @IsOptional()
  @IsString()
  surveyorName?: string;

  @IsOptional()
  @IsString()
  surveyorDetails?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  approvedAmount?: number;
}
