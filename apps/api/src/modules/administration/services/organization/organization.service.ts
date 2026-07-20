import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  async getHierarchy() {
    return this.prisma.company.findMany({
      where: { isActive: true },
      include: {
        regions: {
          where: { isActive: true },
          include: {
            zones: {
              where: { isActive: true },
              include: {
                branches: {
                  where: { isActive: true },
                  include: {
                    departments: {
                      where: { isActive: true },
                      include: {
                        teams: {
                          where: { isActive: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  async getBranches() {
    return this.prisma.branch.findMany({
      where: { isActive: true },
      include: {
        zone: {
          include: {
            region: true,
          },
        },
      },
    });
  }

  async getDepartments(branchId: string) {
    return this.prisma.department.findMany({
      where: { branchId, isActive: true },
    });
  }

  async getTeams(departmentId: string) {
    return this.prisma.team.findMany({
      where: { departmentId, isActive: true },
    });
  }

  async assignUserToTeam(userId: string, teamId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: { department: true },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        teamId: team.id,
        departmentId: team.departmentId,
        branchId: team.department.branchId,
      },
    });
  }
}
