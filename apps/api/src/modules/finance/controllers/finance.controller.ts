import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RoleType } from '@prisma/client';
import {
  LedgerService,
  CreateJournalEntryDto,
} from '../accounting/services/ledger/ledger.service';
import { CommissionEngineService } from '../commission/services/commission-engine/commission-engine.service';
import { PaymentService } from '../revenue/services/payment/payment.service';
import {
  FinanceReconciliationService,
  ReconcilePaymentDto,
  DiscrepancyDto,
} from '../services/finance-reconciliation.service';
import { PrismaService } from '../../../database/prisma.service';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { RequestUser } from '../../auth/decorators/current-user.decorator';
import { PaymentTrackingStatus } from '@prisma/client';

@ApiTags('Finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('finance')
export class FinanceController {
  constructor(
    private readonly ledgerService: LedgerService,
    private readonly commissionEngineService: CommissionEngineService,
    private readonly paymentService: PaymentService,
    private readonly reconciliationService: FinanceReconciliationService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('dashboard')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'Export premium receipts register as CSV' })
  async exportReceipts(@Res() res: Response) {
    const receipts = await this.prisma.receipt.findMany({
      take: 1000,
      orderBy: { createdAt: 'desc' },
    });

    const csvHeaders =
      'Receipt Number,Customer ID,Amount,Payment Mode,Reference,Date\n';
    const csvRows = receipts
      .map(
        (r) =>
          `"${r.receiptNum}","${r.customerId}",${Number(r.amount)},"${r.paymentMode}","${r.reference || ''}","${r.createdAt.toISOString()}"`,
      )
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="receipts-register.csv"',
    );
    return res.send(csvHeaders + csvRows);
  }
}
