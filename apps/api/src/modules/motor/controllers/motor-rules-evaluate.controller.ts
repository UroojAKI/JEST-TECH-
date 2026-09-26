import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleType } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { RequestUser } from '../../auth/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import {
  MotorRuleEngineService,
  MotorRuleResult,
} from '../services/motor-rule-engine.service';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateMotorJourneyDto {
  @IsOptional()
  @IsString()
  vehicleCategory?: string;
}

export class EvaluateMotorRulesDto {
  @IsOptional()
  @IsString()
  journeyId?: string;

  @IsOptional()
  @IsString()
  vehicleStatus?: 'NEW' | 'EXISTING';

  @IsString()
  newPolicyType: 'TP_ONLY' | 'SAOD' | 'PACKAGE';

  @IsOptional()
  @IsString()
  previousPolicyType?:
    | 'COMPREHENSIVE'
    | 'THIRD_PARTY'
    | 'SAOD'
    | 'NOT_AVAILABLE';

  @IsOptional()
  @IsString()
  policyExpiryDate?: string;

  @IsOptional()
  @IsBoolean()
  claimInPreviousYear?: boolean;

  @IsOptional()
  @IsBoolean()
  ownershipTransfer?: boolean;

  @IsOptional()
  @IsBoolean()
  previousPolicyTransferred?: boolean;

  @IsOptional()
  @IsNumber()
  eligibleNcbPercentage?: number;

  @IsOptional()
  @IsString()
  tpExpiryDate?: string;

  @IsOptional()
  @IsString()
  odExpiryDate?: string;

  @IsOptional()
  @IsString()
  newOwnerName?: string;
}

@ApiTags('Motor — Rules & Journeys')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('motor')
export class MotorRulesEvaluateController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ruleEngine: MotorRuleEngineService,
  ) {}

  @Post('journeys')
  @HttpCode(HttpStatus.CREATED)
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  @ApiOperation({
    summary: 'Start an authoritative Motor journey with a strict 24-hour TTL.',
  })
  async startJourney(
    @Body() dto: CreateMotorJourneyDto,
    @CurrentUser() user: RequestUser,
  ) {
    const companyId = user.companyId || (user as any).organizationId;
    if (!companyId) {
      throw new ForbiddenException('Tenant organization context is required');
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 Hours TTL

    const journey = await this.prisma.motorJourney.create({
      data: {
        companyId,
        actorId: user.id,
        vehicleCategory: dto.vehicleCategory,
        status: 'IN_PROGRESS',
        expiresAt,
      },
    });

    return {
      journeyId: journey.id,
      expiresAt: journey.expiresAt,
      status: journey.status,
      vehicleCategory: journey.vehicleCategory,
    };
  }

  @Get('journeys/:id')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  @ApiOperation({
    summary: 'Get Motor journey status and verify validity.',
  })
  async getJourney(
    @Param('id') journeyId: string,
    @CurrentUser() user: RequestUser,
  ) {
    const companyId = user.companyId || (user as any).organizationId;
    const journey = await this.prisma.motorJourney.findUnique({
      where: { id: journeyId },
      include: {
        verificationAttempts: true,
      },
    });

    if (!journey) {
      throw new NotFoundException(`Motor journey ${journeyId} not found`);
    }

    if (journey.companyId !== companyId) {
      throw new ForbiddenException('Cross-tenant journey access is forbidden');
    }

    if (journey.actorId !== user.id && user.role !== RoleType.ADMIN) {
      throw new ForbiddenException('Unauthorized access to this motor journey');
    }

    const isExpired = journey.expiresAt < new Date();
    return {
      ...journey,
      isExpired,
    };
  }

  @Post('rules/evaluate')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  @ApiOperation({
    summary:
      'Statelessly evaluate underwriting rules without persisting premature quotation records.',
  })
  async evaluateRules(
    @Body() dto: EvaluateMotorRulesDto,
    @CurrentUser() user: RequestUser,
  ): Promise<MotorRuleResult> {
    const companyId = user.companyId || (user as any).organizationId;

    if (dto.journeyId) {
      const journey = await this.prisma.motorJourney.findUnique({
        where: { id: dto.journeyId },
      });
      if (!journey) {
        throw new NotFoundException(`Motor journey ${dto.journeyId} not found`);
      }
      if (journey.companyId !== companyId || journey.actorId !== user.id) {
        throw new ForbiddenException('Cross-tenant or unauthorized journey access');
      }
      if (journey.expiresAt < new Date()) {
        throw new BadRequestException('Motor journey has expired (24h TTL exceeded)');
      }
      if (journey.status !== 'IN_PROGRESS') {
        throw new BadRequestException(`Journey is no longer in progress (${journey.status})`);
      }
    }

    const result = this.ruleEngine.evaluateQuotation({
      vehicleStatus: dto.vehicleStatus,
      newPolicyType: dto.newPolicyType,
      previousPolicyType: dto.previousPolicyType,
      policyExpiryDate: dto.policyExpiryDate ? new Date(dto.policyExpiryDate) : null,
      claimInPreviousYear: dto.claimInPreviousYear || false,
      ownershipTransfer: dto.ownershipTransfer || false,
      previousPolicyTransferred: dto.previousPolicyTransferred || false,
      eligibleNcbPercentage: dto.eligibleNcbPercentage || 0,
      tpExpiryDate: dto.tpExpiryDate ? new Date(dto.tpExpiryDate) : null,
      odExpiryDate: dto.odExpiryDate ? new Date(dto.odExpiryDate) : null,
      newOwnerName: dto.newOwnerName,
    });

    return result;
  }
}
