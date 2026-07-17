import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AssignSurveyorDto {
  @ApiProperty({ example: 'John Doe' })
  @IsNotEmpty()
  @IsString()
  surveyorName: string;

  @ApiProperty({ example: 'License #S-12345, Contact: +1234567890' })
  @IsNotEmpty()
  @IsString()
  surveyorDetails: string;
}
