import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RoleType } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { RequestUser } from '../../auth/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { ScopeResolver } from '../../../common/services/scope-resolver.service';
import { NumberingEngineService } from '../../administration/services/numbering-engine/numbering-engine.service';
import { RenewalEngineService } from '../services/renewal-engine.service';
import { MarkTaskLostDto } from '../dto/mark-task-lost.dto';
import { MotorCalculationService } from '../../motor/services/motor-calculation.service';

@ApiTags('Renewals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('renewals')
export class RenewalsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopeResolver: ScopeResolver,
    private readonly numberingEngine: NumberingEngineService,
    private readonly renewalEngine: RenewalEngineService,
    private readonly motorCalculationService: MotorCalculationService,
  ) {}

  @Get('tasks')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  @ApiOperation({
    summary: 'Get paginated renewal tasks scoped by tenancy and role',
  })
  async getRenewalTasks(
    @Query('urgencyDays') urgencyDays?: number,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @CurrentUser() user?: RequestUser,
  ) {
    const p = Math.max(1, Number(page) || 1);
    const l = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (p - 1) * l;

    const scopedFilter = this.scopeResolver.resolveScopeFilter(
      user as any,
      'RENEWAL_TASK',
    );

    let dueDateFilter: any = {};
    if (urgencyDays !== undefined && !isNaN(Number(urgencyDays))) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + Number(urgencyDays));
      dueDateFilter = { dueDate: { lte: targetDate } };
    }

    const effectiveCompanyId = user?.companyId || (user as any)?.organizationId;
    const where: any = {
      ...(effectiveCompanyId ? { policy: { companyId: effectiveCompanyId } } : {}),
      ...scopedFilter,
      ...(status && status !== 'ALL' ? { status } : {}),
      ...dueDateFilter,
    };

    const [items, total] = await Promise.all([
      this.prisma.renewalTask.findMany({
        where,
        skip,
        take: l,
        include: {
          policy: {
            include: { contact: true, quotation: true },
          },
        },
        orderBy: { dueDate: 'asc' },
      }),
      this.prisma.renewalTask.count({ where }),
    ]);

    return {
      items,
      meta: {
        page: p,
        limit: l,
        total,
        totalPages: Math.ceil(total / l) || 1,
      },
    };
  }

  @Get('policies/:policyId/quote-prefill')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  @ApiOperation({ summary: 'Get policy data prefilled for renewal quotation with precedence' })
  async getRenewalQuotePrefill(
    @Param('policyId') policyId: string,
    @CurrentUser() user: RequestUser,
  ) {
    const effectiveCompanyId = user?.companyId || (user as any)?.organizationId;
    const scopedFilter = this.scopeResolver.resolveScopeFilter(
      user as any,
      'POLICY',
    );
    const policy = await this.prisma.policy.findFirst({
      where: {
        id: policyId,
        ...(effectiveCompanyId ? { companyId: effectiveCompanyId } : {}),
        ...scopedFilter,
      },
      include: {
        contact: true,
        customer: true,
        vehicle: true,
        quotation: true,
        insurerDetail: true,
        endorsements: {
          where: { status: 'APPROVED' },
          orderBy: { effectiveDate: 'asc' }, // oldest to newest so newest overwrites
        },
        claims: {
          where: { status: { not: 'REJECTED' } },
        },
      },
    });

    if (!policy) {
      throw new NotFoundException(`Policy with ID ${policyId} not found or access denied`);
    }

    const warnings: string[] = [];

    // Precedence rule: Approved Endorsement -> Current Policy / Current Vehicle / Current Contact -> Previous Quotation
    const mergedEndorsementChanges: Record<string, any> = {};
    for (const end of policy.endorsements) {
      const changes =
        (end.validatedChanges as Record<string, any>) ||
        (end.requestedChanges as Record<string, any>) ||
        {};
      Object.assign(mergedEndorsementChanges, changes);
    }

    // Contact details
    const customer = {
      contactId: policy.contactId,
      customerId: policy.customerId || null,
      firstName: mergedEndorsementChanges.firstName || policy.contact?.firstName || policy.customer?.firstName || policy.quotation?.title || '',
      lastName: mergedEndorsementChanges.lastName ?? (policy.contact?.lastName || policy.customer?.lastName || ''),
      email: mergedEndorsementChanges.email || policy.contact?.email || policy.customer?.email || '',
      phone: mergedEndorsementChanges.phone || policy.contact?.phone || policy.customer?.mobile || '',
      address: mergedEndorsementChanges.address || policy.customer?.addressLine1 || '',
      city: mergedEndorsementChanges.city || policy.customer?.city || '',
      state: mergedEndorsementChanges.state || policy.customer?.state || '',
      pincode: mergedEndorsementChanges.pincode || policy.customer?.pincode || '',
    };

    // Vehicle details
    const categorySpecificData = {
      ...((policy.vehicle?.categorySpecificData as any) || {}),
      ...(mergedEndorsementChanges.categorySpecificData || {}),
    };

    const vehicle = {
      vehicleId: policy.vehicleId || policy.quotation?.vehicleId || null,
      registrationNumber:
        mergedEndorsementChanges.registrationNumber ||
        policy.vehicle?.registrationNumber ||
        (policy.motorMetadata as any)?.registrationNumber ||
        '',
      vehicleCategory:
        mergedEndorsementChanges.category ||
        policy.vehicle?.category ||
        policy.vehicleCategory ||
        (policy.motorMetadata as any)?.vehicleCategory ||
        'PRIVATE_CAR',
      makeModel:
        mergedEndorsementChanges.makeModel ||
        policy.vehicle?.makeModel ||
        (policy.motorMetadata as any)?.makeModel ||
        '',
      engineNumber:
        mergedEndorsementChanges.engineNumber ||
        policy.vehicle?.engineNumber ||
        '',
      chassisNumber:
        mergedEndorsementChanges.chassisNumber ||
        policy.vehicle?.chassisNumber ||
        '',
      fuelType:
        mergedEndorsementChanges.fuelType ||
        policy.vehicle?.fuelType ||
        '',
      rtoLocation:
        mergedEndorsementChanges.rtoLocation ||
        policy.vehicle?.rtoLocation ||
        '',
      manufactureYearMonth:
        mergedEndorsementChanges.manufactureYearMonth ||
        policy.vehicle?.manufactureYearMonth ||
        (policy.motorMetadata as any)?.manufactureYearMonth ||
        '',
      trailerCount:
        categorySpecificData.trailerCount !== undefined
          ? Number(categorySpecificData.trailerCount)
          : undefined,
      categorySpecificData,
    };

    // Insurer details
    const insurerName =
      (policy.insurerDetail?.submissionPayload as any)?.insurerName ||
      policy.quotation?.insurerName ||
      policy.activeTpInsurer ||
      null;

    const insurerId =
      (policy.insurerDetail?.submissionPayload as any)?.insurerId ||
      policy.quotation?.insurerId ||
      null;

    if (!insurerName) {
      warnings.push('Previous insurer name is missing on the policy record. Please select insurer manually.');
    }

    // Claims check
    const hasClaims = policy.claims.length > 0;

    // Previous NCB and Renewal NCB
    const prevNcb = Number(policy.quotation?.ncbPercentage ?? 0);
    const renewalNcb = hasClaims ? 0 : this.renewalEngine.calculateNextNCBSlab(prevNcb);

    // Sum Insured / IDV
    const expiringIdv =
      Number(mergedEndorsementChanges.idv || policy.quotation?.sumInsured || (policy.motorMetadata as any)?.idv) || null;

    let suggestedIdv: number | null = null;
    let depreciationPercentage: number = 10;

    if (expiringIdv && expiringIdv > 0) {
      const regYear = policy.vehicle?.dateOfRegistration
        ? new Date(policy.vehicle.dateOfRegistration).getFullYear()
        : (policy.vehicle?.manufactureYearMonth ? parseInt(policy.vehicle.manufactureYearMonth.split('/')[1] || policy.vehicle.manufactureYearMonth) : null);
      const currentYear = new Date().getFullYear();
      const vehicleAgeYears = regYear ? Math.max(1, currentYear - regYear) : 1;

      const idvCalc = this.renewalEngine.calculateRevisedIdv(expiringIdv, vehicleAgeYears);
      suggestedIdv = idvCalc.revisedIdv;
      depreciationPercentage = idvCalc.depreciationPercentage;
    } else {
      warnings.push('Expiring policy has no Sum Insured/IDV recorded. Please enter IDV manually.');
    }

    return {
      success: true,
      prefill: {
        policyId: policy.id,
        policyNumber: policy.actualPolicyNumber || policy.policyNumber,
        policyType: mergedEndorsementChanges.policyType || policy.policyType || 'PACKAGE_COMPREHENSIVE',
        policyTenure: 1,
        expiryDate: policy.expiryDate,
        insurer: {
          insurerId,
          insurerName,
        },
        customer,
        vehicle,
        pricing: {
          expiringIdv,
          suggestedIdv,
          depreciationPercentage,
          previousNcb: prevNcb,
          renewalNcb,
          hasClaims,
        },
        precedenceApplied: {
          approvedEndorsementCount: policy.endorsements.length,
          endorsementTypes: policy.endorsements.map((e) => e.type),
          overridesFromEndorsements: Object.keys(mergedEndorsementChanges),
        },
        warnings,
      },
    };
  }

  @Post('tasks/:id/quote')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  @ApiOperation({ summary: 'Create renewal quote linked to policy and task' })
  async createRenewalQuote(
    @Param('id') taskId: string,
    @CurrentUser() user: RequestUser,
  ) {
    const task = await this.prisma.renewalTask.findUnique({
      where: { id: taskId },
      include: {
        policy: {
          include: {
            quotation: true,
            contact: true,
            vehicle: true,
            insurerDetail: true,
            endorsements: { where: { status: 'APPROVED' } },
            claims: { where: { status: { not: 'REJECTED' } } },
          },
        },
      },
    });
    if (!task) {
      throw new NotFoundException(`Renewal task with ID ${taskId} not found`);
    }

    const scopedFilter = this.scopeResolver.resolveScopeFilter(
      user as any,
      'RENEWAL_TASK',
    );
    const accessible = await this.prisma.renewalTask.findFirst({
      where: { id: taskId, ...scopedFilter },
    });
    if (!accessible) {
      throw new ForbiddenException('Access to this renewal task is denied');
    }

    const existingQuote = task.policy.quotation;
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 30);

    const quotationCode = await this.numberingEngine.generateNext(
      'QUOTATION',
      this.prisma,
    );

    // Calculate authoritative renewal parameters derived from IRDAI rating config & statutory depreciation:
    const prevSumInsured = Number(
      existingQuote?.sumInsured || task.policy.actualPremium || task.policy.premiumAmount,
    );
    const prevBasePrem = Number(
      existingQuote?.basePremium || task.policy.actualPremium || task.policy.premiumAmount,
    );
    const prevNcb = Number(existingQuote?.ncbPercentage || 0);

    const vehicleMeta = (task.policy.motorMetadata as Record<string, any>) || {};
    const regYear = Number(vehicleMeta.registrationYear || vehicleMeta.manufacturingYear || (new Date().getFullYear() - 1));
    const vehicleAgeYears = Math.max(1, new Date().getFullYear() - regYear);

    const hasClaims = task.policy.claims.length > 0;

    let revisedIdv = prevSumInsured;
    const nextNcb = hasClaims ? 0 : this.renewalEngine.calculateNextNCBSlab(prevNcb);
    let revisedBase = prevBasePrem;
    let gstAmount = 0;
    let totalPremium = 0;
    let depreciationPercentage = 10;

    const vehicleCat = (task.policy.vehicleCategory as any) || vehicleMeta.vehicleCategory || 'PRIVATE_CAR';
    if (prevSumInsured && prevSumInsured > 0) {
      const depCalc = this.renewalEngine.calculateRevisedIdv(prevSumInsured, vehicleAgeYears);
      revisedIdv = depCalc.revisedIdv;
      depreciationPercentage = depCalc.depreciationPercentage;

      try {
        const motorCalc = await this.motorCalculationService.calculate({
          vehicleCategory: vehicleCat,
          vehicleStatus: 'EXISTING',
          policyType: (task.policy.policyType as any) || 'PACKAGE_COMPREHENSIVE',
          idv: revisedIdv,
          ncbPercent: nextNcb,
          claimInExpiringPolicy: hasClaims,
        });
        revisedBase = motorCalc.outputs.netCustomerPremium;
        gstAmount = motorCalc.outputs.totalGst;
        totalPremium = motorCalc.outputs.finalPayableAmount;
      } catch (calcErr) {
        const pricing = this.renewalEngine.calculateRenewalPricing({
          prevSumInsured,
          prevBasePremium: prevBasePrem,
          prevNcb,
          hasClaims,
          vehicleAgeYears,
        });
        revisedBase = pricing.revisedBase;
        gstAmount = pricing.gstAmount;
        totalPremium = pricing.totalPremium;
      }
    }

    const insurerName =
      existingQuote?.insurerName ||
      (task.policy.insurerDetail?.submissionPayload as any)?.insurerName ||
      task.policy.activeTpInsurer ||
      'Direct Insurer';

    const renewalQuote = await this.prisma.quotation.create({
      data: {
        title: `Renewal Quote - ${task.policy.actualPolicyNumber || task.policy.policyNumber}`,
        quotationCode,
        status: 'DRAFT',
        companyId: task.policy.companyId,
        contactId: task.policy.contactId,
        accountId: task.policy.accountId,
        leadId: existingQuote?.leadId || null,
        agentId: user.agentId || task.agentId || null,
        createdById: user.id,
        insurerName,
        productType: existingQuote?.productType || 'MOTOR',
        sumInsured: revisedIdv,
        basePremium: revisedBase,
        gstAmount,
        totalPremium,
        ncbPercentage: nextNcb,
        calculationSnapshot: {
          revisedIdv,
          revisedBase,
          gstAmount,
          totalPremium,
          ncbPercentage: nextNcb,
          depreciationApplied: `${depreciationPercentage}%`,
          calculatedAt: new Date().toISOString(),
        },
        calculationVersion: 'RENEWAL_V2',
        expiryDate: expiry,
      },
    });

    // Update renewal task status to QUOTED per requirement
    await this.prisma.renewalTask.update({
      where: { id: taskId },
      data: { status: 'QUOTED' },
    });

    return {
      success: true,
      renewalTaskId: taskId,
      quotation: renewalQuote,
    };
  }

  @Post('tasks/:id/complete')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  @ApiOperation({ summary: 'Transition renewal task to COMPLETED' })
  async completeTask(
    @Param('id') taskId: string,
    @CurrentUser() user: RequestUser,
  ) {
    const scopedFilter = this.scopeResolver.resolveScopeFilter(
      user as any,
      'RENEWAL_TASK',
    );
    const task = await this.prisma.renewalTask.findFirst({
      where: { id: taskId, ...scopedFilter },
    });
    if (!task) {
      throw new NotFoundException(
        `Renewal task with ID ${taskId} not found or access denied`,
      );
    }
    const updated = await this.prisma.renewalTask.update({
      where: { id: taskId },
      data: { status: 'COMPLETED' },
    });
    return { success: true, task: updated };
  }

  @Post('tasks/:id/lost')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  @ApiOperation({ summary: 'Transition renewal task to LOST/CANCELLED' })
  async markTaskLost(
    @Param('id') taskId: string,
    @Body() dto: MarkTaskLostDto,
    @CurrentUser() user: RequestUser,
  ) {
    const scopedFilter = this.scopeResolver.resolveScopeFilter(
      user as any,
      'RENEWAL_TASK',
    );
    const task = await this.prisma.renewalTask.findFirst({
      where: { id: taskId, ...scopedFilter },
    });
    if (!task) {
      throw new NotFoundException(
        `Renewal task with ID ${taskId} not found or access denied`,
      );
    }
    const updated = await this.prisma.renewalTask.update({
      where: { id: taskId },
      data: { status: 'CANCELLED' },
    });
    return { success: true, task: updated, reason: dto?.reason };
  }
}
