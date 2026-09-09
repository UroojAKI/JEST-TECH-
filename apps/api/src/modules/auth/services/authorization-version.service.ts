import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class AuthorizationVersionService {
  constructor(private readonly prisma: PrismaService) {}

  async checkVersion(userId: string, tokenVersion: number): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { updatedAt: true },
    });

    if (!user) {
      return false;
    }

    // Note: authVersion column must be added via EPIC-05 migration
    const currentVersion = user.updatedAt.getTime();
    
    return currentVersion === tokenVersion;
  }
}
