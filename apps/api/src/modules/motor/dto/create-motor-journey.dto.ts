import { IsOptional, IsString } from 'class-validator';

export class CreateMotorJourneyDto {
  @IsOptional()
  @IsString()
  vehicleCategory?: string;

  @IsOptional()
  @IsString()
  assignedAgentId?: string;

  @IsOptional()
  @IsString()
  leadId?: string;
}
