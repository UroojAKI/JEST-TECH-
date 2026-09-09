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

    let formatConfig = await this.prisma.numberingFormat.findUnique({
      where: { entityType },
    });

    if (!formatConfig) {
      const DEFAULT_FORMATS: Record<
        string,
        { prefix: string; format: string; padding: number }
      > = {
        POLICY: { prefix: 'POL', format: '{PREFIX}-{YYYY}-{MM}-{SEQUENCE}', padding: 6 },
        CLAIM: { prefix: 'CLM', format: '{PREFIX}-{YYYY}-{MM}-{SEQUENCE}', padding: 6 },
        PROPOSAL: { prefix: 'PROP', format: '{PREFIX}-{YYYY}-{MM}-{SEQUENCE}', padding: 6 },
        ENDORSEMENT: { prefix: 'END', format: '{PREFIX}-{YYYY}-{MM}-{SEQUENCE}', padding: 6 },
        INSPECTION: { prefix: 'INS', format: '{PREFIX}-{YYYY}-{MM}-{SEQUENCE}', padding: 6 },
        QUOTATION: { prefix: 'QT', format: '{PREFIX}-{YYYY}-{MM}-{SEQUENCE}', padding: 6 },
        CONTACT: { prefix: 'CONT', format: '{PREFIX}-{YYYY}-{MM}-{SEQUENCE}', padding: 6 },
        LEAD: { prefix: 'LEAD', format: '{PREFIX}-{YYYY}-{MM}-{SEQUENCE}', padding: 6 },
      };

      const defaultCfg = DEFAULT_FORMATS[entityType.toUpperCase()] || {
        prefix: entityType.slice(0, 4).toUpperCase(),
        format: '{PREFIX}-{YYYY}-{MM}-{SEQUENCE}',
        padding: 6,
      };

      formatConfig = await this.prisma.numberingFormat.upsert({
        where: { entityType },
        create: {
          entityType,
          prefix: defaultCfg.prefix,
          format: defaultCfg.format,
          padding: defaultCfg.padding,
        },
        update: {},
      });
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
