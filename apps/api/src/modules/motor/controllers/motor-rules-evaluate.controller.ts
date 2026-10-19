import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
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
import { MotorPolicyDateService } from '../services/motor-policy-date.service';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

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
  activeTpInsurer?: string;

  @IsOptional()
  @IsString()
  activeTpPolicyNumber?: string;

  @IsOptional()
  @IsString()
  activeTpStartDate?: string;

  @IsOptional()
  @IsString()
  activeTpVerificationMethod?: string;

  @IsOptional()
  @IsString()
  activeTpVerificationStatus?: 'PENDING' | 'VERIFIED' | 'REJECTED';

  @IsOptional()
  @IsBoolean()
  activeTpVerifiedByUserConfirmed?: boolean;

  @IsOptional()
  @IsString()
  odExpiryDate?: string;

  @IsOptional()
  @IsString()
  newOwnerName?: string;
}

@ApiTags('Motor — Rules Engine')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('motor')
export class MotorRulesEvaluateController {
  private readonly policyDateService = new MotorPolicyDateService();

  constructor(
    private readonly prisma: PrismaService,
    private readonly ruleEngine: MotorRuleEngineService,
  ) {}

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

    if (dto.newPolicyType === 'SAOD') {
      if (
        !dto.activeTpInsurer?.trim() ||
        !dto.activeTpPolicyNumber?.trim() ||
        !dto.activeTpStartDate ||
        !dto.tpExpiryDate ||
        !dto.activeTpVerificationMethod ||
        dto.activeTpVerificationStatus !== 'VERIFIED' ||
        dto.activeTpVerifiedByUserConfirmed !== true
      ) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          errorCode: 'ACTIVE_TP_VERIFICATION_REQUIRED',
          message: 'SAOD underwriting evaluation requires complete, verified and confirmed active TP details.',
        });
      }

      const tpStart = new Date(dto.activeTpStartDate);
      const tpExpiry = new Date(dto.tpExpiryDate);
      if (
        Number.isNaN(tpStart.getTime()) ||
        Number.isNaN(tpExpiry.getTime()) ||
        tpExpiry < tpStart
      ) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          errorCode: 'ACTIVE_TP_DATES_INVALID',
          message: 'Active TP policy dates are invalid; expiry must not precede the start date.',
        });
      }
      const startBusinessDate = this.policyDateService.toBusinessDate(tpStart);
      if (startBusinessDate > this.policyDateService.getBusinessToday()) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          errorCode: 'ACTIVE_TP_NOT_YET_IN_FORCE',
          message: 'Active TP policy start date is in the future; it cannot establish current SAOD eligibility.',
        });
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
