import { Module } from '@nestjs/common';
import { DuplicateDetectionService } from './services/duplicate-detection/duplicate-detection.service';
import { PrismaService } from '../../../database/prisma.service';

@Module({
  providers: [DuplicateDetectionService, PrismaService],
  exports: [DuplicateDetectionService],
})
export class DeduplicationModule {}
