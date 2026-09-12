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

    // A token is valid as long as its version is greater than or equal to the user's last updatedAt timestamp
    const currentVersion = user.updatedAt.getTime();
    
    return tokenVersion >= currentVersion;
  }
}
