import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../database/prisma.service';

@Injectable()
export class DuplicateDetectionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Scans existing leads and contacts to find duplicates based on
   * exact matching of Phone, Email, PAN, Aadhaar, or GST.
   */
  async detectDuplicates(leadData: { email?: string; phone?: string; panNumber?: string; aadhaarNumber?: string; gstNumber?: string; }): Promise<string | null> {
    const OR_CONDITIONS = [];

    if (leadData.email) OR_CONDITIONS.push({ contact: { email: leadData.email } });
    if (leadData.phone) OR_CONDITIONS.push({ contact: { phone: leadData.phone } });
    if (leadData.panNumber) OR_CONDITIONS.push({ contact: { panNumber: leadData.panNumber } });
    if (leadData.aadhaarNumber) OR_CONDITIONS.push({ contact: { aadhaarNumber: leadData.aadhaarNumber } });
    if (leadData.gstNumber) OR_CONDITIONS.push({ contact: { gstNumber: leadData.gstNumber } });

    if (OR_CONDITIONS.length === 0) return null;

    const duplicateLead = await this.prisma.lead.findFirst({
      where: {
        OR: OR_CONDITIONS,
      },
      select: { id: true },
    });

    return duplicateLead ? duplicateLead.id : null;
  }
}
