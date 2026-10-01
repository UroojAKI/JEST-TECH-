import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class NumberingEngineService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the next globally unique, collision-free code for a given prefix.
   * Uses a PostgreSQL sequence — atomic under any concurrency level.
   *
   * WF-010: Replaces the racy count()+while-loop that could generate duplicate
   * task codes when two simultaneous requests hit the service at the same time.
   */
  async generateNext(prefix: string): Promise<string> {
    const result = await this.prisma.$queryRaw<[{ nextval: bigint }]>`
      SELECT nextval('back_office_task_code_seq')::bigint AS nextval
    `;
    const seq = Number(result[0].nextval);
    return `${prefix}-${seq.toString().padStart(6, '0')}`;
  }
}