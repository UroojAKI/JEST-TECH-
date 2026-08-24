import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { WorkspaceFactory } from '../factories/workspace.factory';
import { WorkspaceResponseDto } from '../dto/workspace.dto';

@Injectable()
export class WorkspaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaceFactory: WorkspaceFactory,
  ) {}

  async getWorkspaceForUser(userId: string): Promise<WorkspaceResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: true,
        jobRole: { include: { department: true, dashboards: true } },
        department: true,
        workspacePreference: true,
      },
    });

    if (!user) throw new NotFoundException(`User with ID '${userId}' not found`);

    const roleCode = user.role?.code || 'SALES_AGENT';
    const jobRole = user.jobRole;
    const department = user.department || user.jobRole?.department || null;
    let registry: any = null;

    if (jobRole?.dashboards?.length) {
      registry = jobRole.dashboards[0];
    } else if (jobRole) {
      registry = await this.prisma.dashboardRegistry.findFirst({ where: { jobRoleId: jobRole.id } });
    }

    const isRegistryUsable = (reg: any, currentJobRole: any) => {
      if (!reg || reg.isActive === false || !reg.widgets || reg.widgets.length === 0) return false;
      let navLength = 0;
      if (Array.isArray(reg.navigation)) navLength = reg.navigation.length;
      else if (typeof reg.navigation === 'string') {
        try {
          const parsed = JSON.parse(reg.navigation);
          navLength = Array.isArray(parsed) ? parsed.length : Object.keys(parsed || {}).length;
        } catch {
          navLength = 0;
        }
      } else if (reg.navigation && typeof reg.navigation === 'object') {
        navLength = Object.keys(reg.navigation).length;
      }
      if (navLength === 0) return false;
      if (currentJobRole && reg.jobRoleId && reg.jobRoleId !== currentJobRole.id) return false;
      return true;
    };

    let workspaceConfig: any;
    if (isRegistryUsable(registry, jobRole)) {
      workspaceConfig = {
        dashboardCode: registry.dashboardCode,
        workspaceCode: registry.workspaceCode,
        title: registry.title,
        subtitle: registry.subtitle,
        navigation: typeof registry.navigation === 'string' ? JSON.parse(registry.navigation) : registry.navigation,
        widgets: typeof registry.widgets === 'string' ? JSON.parse(registry.widgets) : registry.widgets,
        quickActions: registry.quickActions || [],
        permissions: registry.permissions || [],
      };
    } else {
      workspaceConfig = this.workspaceFactory.createDefaultWorkspace(
        jobRole?.code || 'AGENT',
        roleCode,
        jobRole?.name || 'Sales Agent',
      );
    }

    return {
      user: {
        id: user.id,
        employeeCode: user.employeeCode,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        designation: user.designation,
        status: user.status,
      },
      jobRole: jobRole ? {
        id: jobRole.id,
        code: jobRole.code,
        name: jobRole.name,
        defaultRoleType: jobRole.defaultRoleType,
        description: jobRole.description,
      } : null,
      department: department ? { id: department.id, code: department.code, name: department.name } : null,
      dashboardCode: workspaceConfig.dashboardCode,
      workspaceCode: workspaceConfig.workspaceCode,
      title: workspaceConfig.title,
      subtitle: workspaceConfig.subtitle,
      navigation: workspaceConfig.navigation,
      widgets: workspaceConfig.widgets,
      quickActions: workspaceConfig.quickActions,
      permissions: workspaceConfig.permissions,
      preferences: user.workspacePreference || null,
    };
  }

  async getNavigation(userId: string) {
    return (await this.getWorkspaceForUser(userId)).navigation;
  }

  async getWidgets(userId: string) {
    return (await this.getWorkspaceForUser(userId)).widgets;
  }

  async getDashboard(userId: string) {
    const ws = await this.getWorkspaceForUser(userId);
    return { dashboardCode: ws.dashboardCode, workspaceCode: ws.workspaceCode, title: ws.title, subtitle: ws.subtitle, widgets: ws.widgets, quickActions: ws.quickActions };
  }

  async getProfile(userId: string) {
    const ws = await this.getWorkspaceForUser(userId);
    return { user: ws.user, jobRole: ws.jobRole, department: ws.department, preferences: ws.preferences };
  }
}
