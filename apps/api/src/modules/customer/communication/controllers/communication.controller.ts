import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleType } from '@prisma/client';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { CommunicationService } from '../services/communication/communication.service';
import { PrismaService } from '../../../../database/prisma.service';

@ApiTags('Communications & Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class CommunicationController {
  constructor(
    private readonly communicationService: CommunicationService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('communications')
  @ApiOperation({ summary: 'Get outgoing and incoming communications' })
  async getCommunications(@Query('channel') channel?: string) {
    return [
      {
        id: 'COMM-001',
        channel: channel || 'WHATSAPP',
        customerId: 'CUST-101',
        customerName: 'Sunita Kulkarni',
        subject: 'Policy Renewal Reminder',
        messageContent: 'Your policy is due in 15 days.',
        status: 'DELIVERED',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'COMM-002',
        channel: channel || 'EMAIL',
        customerId: 'CUST-102',
        customerName: 'Acme Logistics',
        subject: 'Quotation Shared',
        messageContent: 'Here is your policy quote for Motor Comprehensive.',
        status: 'SENT',
        createdAt: new Date().toISOString(),
      },
    ];
  }

  @Post('communications')
  @ApiOperation({ summary: 'Send message via email, SMS, or WhatsApp' })
  async sendMessage(
    @Body()
    dto: {
      channel: string;
      customerId: string;
      subject?: string;
      messageContent: string;
    },
  ) {
    return {
      id: `COMM-${Date.now().toString().slice(-6)}`,
      channel: dto.channel,
      customerId: dto.customerId,
      subject: dto.subject || 'CRM Message',
      messageContent: dto.messageContent,
      status: 'SENT',
      createdAt: new Date().toISOString(),
    };
  }

  @Get('notifications/templates')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  @ApiOperation({ summary: 'Get notification templates' })
  async getTemplates() {
    return [
      {
        id: 'TPL-01',
        code: 'RENEWAL_REMINDER_WA',
        channel: 'WHATSAPP',
        subject: 'Policy Renewal Notice',
        bodyTemplate:
          'Dear {{customerName}}, your policy {{policyNumber}} is due on {{expiryDate}}.',
      },
      {
        id: 'TPL-02',
        code: 'POLICY_ISSUED_EMAIL',
        channel: 'EMAIL',
        subject: 'Policy Document Enclosed',
        bodyTemplate:
          'Dear {{customerName}}, thank you for choosing JEST Policy. Schedule is attached.',
      },
    ];
  }

  @Put('notifications/templates/:id')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  @ApiOperation({ summary: 'Update notification template' })
  async updateTemplate(@Param('id') id: string, @Body() dto: any) {
    return { id, status: 'updated', ...dto };
  }

  @Get('notifications/delivery-logs')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  @ApiOperation({ summary: 'Get notification delivery logs' })
  async getDeliveryLogs() {
    return [
      {
        id: 'LOG-001',
        recipient: '+919876543210',
        channel: 'WHATSAPP',
        status: 'DELIVERED',
        timestamp: new Date().toISOString(),
      },
      {
        id: 'LOG-002',
        recipient: 'client@gmail.com',
        channel: 'EMAIL',
        status: 'OPENED',
        timestamp: new Date().toISOString(),
      },
    ];
  }

  @Get('notifications/events')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  @ApiOperation({ summary: 'Get system notification events' })
  async getNotificationEvents() {
    return [
      { event: 'POLICY_ISSUED', count: 184 },
      { event: 'RENEWAL_DUE_30D', count: 42 },
      { event: 'CLAIM_FILED', count: 12 },
    ];
  }
}
