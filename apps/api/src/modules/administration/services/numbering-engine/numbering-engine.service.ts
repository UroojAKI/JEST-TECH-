import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';

@Injectable()
export class NumberingEngineService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates the next number for a given entity type (e.g. POLICY, CLAIM)
   * Uses an atomic update to guarantee no duplicates even under concurrent load.
   */
  async generateNext(entityType: string): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-12

    // First fetch the format
    const formatConfig = await this.prisma.numberingFormat.findUnique({
      where: { entityType },
    });

    if (!formatConfig) {
      throw new InternalServerErrorException(
        `Numbering format for ${entityType} is not configured.`,
      );
    }

    // Atomically increment the sequence or create if it doesn't exist for this month/year
    const sequenceRecord = await this.prisma.numberingSequence.upsert({
      where: {
        entityType_year_month: {
          entityType,
          year,
          month,
        },
      },
      update: {
        sequence: { increment: 1 },
      },
      create: {
        entityType,
        year,
        month,
        sequence: 1,
      },
    });

    // Construct the formatted string
    // e.g. format: '{PREFIX}-{YYYY}-{MM}-{SEQUENCE}'
    const paddedSequence = sequenceRecord.sequence
      .toString()
      .padStart(formatConfig.padding, '0');
    const monthStr = month.toString().padStart(2, '0');

    let result = formatConfig.format;
    result = result.replace('{PREFIX}', formatConfig.prefix);
    result = result.replace('{YYYY}', year.toString());
    result = result.replace('{MM}', monthStr);
    result = result.replace('{SEQUENCE}', paddedSequence);

    return result;
  }
}
