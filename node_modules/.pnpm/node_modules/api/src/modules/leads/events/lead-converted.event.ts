import { LeadResponseDto } from '../dto/lead-response.dto';

export class LeadConvertedEvent {
  constructor(public readonly lead: LeadResponseDto) {}
}
