import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { RequestUser } from '../../auth/decorators/current-user.decorator';
import { WorkspaceService } from '../services/workspace.service';

@ApiTags('Workspace')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('workspace')
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Get()
  @ApiOperation({ summary: 'Resolve active user enterprise workspace, navigation, dashboard & widgets' })
  getWorkspace(@CurrentUser() user: RequestUser) {
    return this.workspaceService.getWorkspaceForUser(user.id);
  }

  @Get('navigation')
  @ApiOperation({ summary: 'Get dynamic workspace navigation tree' })
  getNavigation(@CurrentUser() user: RequestUser) {
    return this.workspaceService.getNavigation(user.id);
  }

  @Get('widgets')
  @ApiOperation({ summary: 'Get workspace widget configurations' })
  getWidgets(@CurrentUser() user: RequestUser) {
    return this.workspaceService.getWidgets(user.id);
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Get workspace dashboard metrics configuration' })
  getDashboard(@CurrentUser() user: RequestUser) {
    return this.workspaceService.getDashboard(user.id);
  }

  @Get('profile')
  @ApiOperation({ summary: 'Get user job role and workspace profile metadata' })
  getProfile(@CurrentUser() user: RequestUser) {
    return this.workspaceService.getProfile(user.id);
  }
}
