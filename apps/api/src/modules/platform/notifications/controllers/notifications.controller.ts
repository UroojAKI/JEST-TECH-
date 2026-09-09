import {
  Controller,
  Get,
  Patch,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import type { RequestUser } from '../../../auth/decorators/current-user.decorator';
import { NotificationService } from '../services/notification.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  getNotifications(@CurrentUser() user: RequestUser) {
    return this.notificationService.getUserNotifications(user.id);
  }

  // ── EPIC-30: Delivery Monitor & Telemetry Endpoints (DEF-004 Fix) ─────────
  @Get('delivery-logs')
  @ApiOperation({ summary: 'Get channel message delivery monitor logs' })
  getDeliveryLogs() {
    return this.notificationService.getDeliveryLogs();
  }

  @Get('events')
  @ApiOperation({ summary: 'Get domain event telemetry stream' })
  getEventStream(@Query('category') category?: string) {
    return this.notificationService.getEventStream(category);
  }

  @Get('templates')
  @ApiOperation({ summary: 'Get multichannel notification templates' })
  getTemplates() {
    return this.notificationService.getNotificationTemplates();
  }

  @Put('templates/:id')
  @ApiOperation({ summary: 'Update notification template body' })
  updateTemplate(
    @Param('id') id: string,
    @Body('bodyTemplate') bodyTemplate: string,
  ) {
    return this.notificationService.updateNotificationTemplate(id, bodyTemplate);
  }

  @Get('unread')
  getUnreadNotifications(@CurrentUser() user: RequestUser) {
    return this.notificationService.getUnreadNotifications(user.id);
  }

  @Get('count')
  getUnreadCount(@CurrentUser() user: RequestUser) {
    return this.notificationService.getUnreadCount(user.id);
  }

  @Patch('read-all')
  markAllAsRead(@CurrentUser() user: RequestUser) {
    return this.notificationService.markAllAsRead(user.id);
  }

  @Patch(':id/read')
  markAsRead(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.notificationService.markAsRead(id, user.id);
  }

  @Delete(':id')
  deleteNotification(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.notificationService.deleteNotification(id, user.id);
  }

  @Get('preferences')
  getPreferences(@CurrentUser() user: RequestUser) {
    return this.notificationService.getPreferences(user.id);
  }

  @Patch('preferences')
  updatePreferences(@CurrentUser() user: RequestUser, @Body() data: any) {
    return this.notificationService.updatePreferences(user.id, data);
  }
}
