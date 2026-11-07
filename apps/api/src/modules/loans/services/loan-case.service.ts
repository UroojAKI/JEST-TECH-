import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { NumberingEngineService } from '../../administration/services/numbering-engine/numbering-engine.service';
import { ResourceAuthorizationService } from '../../../common/services/resource-authorization.service';
import { ScopeResolver } from '../../../common/services/scope-resolver.service';
import { ActorContext } from '../../../common/interfaces/actor-context.interface';
import { PaginationDto } from '../../../common/pagination/pagination.dto';
import { PaginatedResponseDto } from '../../../common/pagination/paginated-response.dto';
import { CreateLoanCaseDto } from '../dto/create-loan-case.dto';
import { UpdateLoanCaseDto } from '../dto/update-loan-case.dto';
import { CreateLoanPartyDto } from '../dto/loan-party.dto';
import { IssueLoanSanctionDto, IssueLoanDisbursementDto } from '../dto/issue-loan.dto';
import { LoanCalculationService } from './loan-calculation.service';
import { LoanEnquiryStatus, LoanPartyRole, LoanFacilityType } from '@prisma/client';

@Injectable()
export class LoanCaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numberingEngine: NumberingEngineService,
    private readonly authzService: ResourceAuthorizationService,
    private readonly scopeResolver: ScopeResolver,
    private readonly calculationService: LoanCalculationService,
  ) {}

  async createCase(dto: CreateLoanCaseDto, actor: ActorContext) {
    this.authzService.authorize(actor, 'LOAN_APPLICATION_CASE', 'CREATE');
    const companyId = actor.organizationId || (actor as any).companyId;
    if (!companyId) {
      throw new ForbiddenException('Company context is required to create a loan enquiry');
    }

    // 1. Resolve or auto-create contact in tenant
    let contactId = dto.contactId;
    let contact = contactId
      ? await this.prisma.contact.findFirst({ where: { id: contactId, companyId } })
      : null;

    if (!contact && dto.applicant?.phone) {
      const cleanPhone = dto.applicant.phone.replace(/\D/g, '');
      if (cleanPhone.length === 10) {
        contact = await this.prisma.contact.findFirst({
          where: {
            companyId,
            OR: [
              { phone: cleanPhone },
              ...(dto.applicant.email ? [{ email: dto.applicant.email.trim().toLowerCase() }] : []),
            ],
          },
        });
      }
    }

    if (!contact) {
      const cleanPhone = (dto.applicant?.phone || '').replace(/\D/g, '');
      const contactCode = await this.numberingEngine.generateNext('CONTACT');
      contact = await this.prisma.contact.create({
        data: {
          companyId,
          contactCode,
          type: 'INDIVIDUAL',
          firstName: dto.applicant?.firstName?.trim() || 'Loan',
          lastName: dto.applicant?.lastName?.trim() || 'Applicant',
          phone: cleanPhone.length === 10 ? cleanPhone : null,
          email: dto.applicant?.email?.trim().toLowerCase() || null,
          panNumber: dto.applicant?.panNumber?.trim().toUpperCase() || null,
          aadhaarNumber: dto.applicant?.aadhaarNumber?.trim() || null,
        },
      });
    }

    // 2. Build immutable customer KYC snapshot
    const customerSnapshot = {
      contactId: contact.id,
      firstName: contact.firstName,
      middleName: contact.middleName,
      lastName: contact.lastName,
      fullName: [contact.firstName, contact.middleName, contact.lastName].filter(Boolean).join(' '),
      email: contact.email,
      phone: contact.phone,
      panNumber: contact.panNumber,
      aadhaarNumber: contact.aadhaarNumber,
      dateOfBirth: contact.dateOfBirth,
      gender: contact.gender,
      occupation: contact.occupation,
      snapshotTimestamp: new Date().toISOString(),
    };

    // 3. Generate authoritative case number
    const caseCode = await this.numberingEngine.generateNext('LOAN_CASE');

    const monthlyIncome =
      dto.monthlyIncome !== undefined && !isNaN(dto.monthlyIncome)
        ? dto.monthlyIncome
        : 50000;
    const annualIncome =
      dto.annualIncome !== undefined && !isNaN(dto.annualIncome)
        ? dto.annualIncome
        : monthlyIncome * 12;

    const occupationType = dto.occupationType?.trim() || 'SALARIED';
    const employerBusinessName = dto.employerBusinessName?.trim() || 'Self / Business';
    const cibilScore = dto.cibilScore && dto.cibilScore > 0 ? dto.cibilScore : null;

    return this.prisma.$transaction(async (tx) => {
      const loanCase = await tx.loanApplicationCase.create({
        data: {
          companyId,
          caseCode,
          category: dto.category,
          status: LoanEnquiryStatus.DRAFT,
          contactId: contact.id,
          agentId: dto.agentId || actor.agentId || null,
          leadId: dto.leadId || null,
          leadSource: dto.leadSource || 'Direct CRM',
          occupationType,
          employerBusinessName,
          monthlyIncome,
          annualIncome,
          existingEmiObligations: dto.existingEmiObligations || 0,
          cibilScore,
          bankAccountDetails: dto.bankAccountDetails || {},
          residentialAddress: dto.residentialAddress || {},
          permanentAddress: dto.permanentAddress || {},
          customerSnapshot,
          categoryData: dto.categoryData || {},
          createdById: actor.userId,
        },
      });

      // 4. Initial facility if provided
      if (dto.facility) {
        let fType = dto.facility.facilityType as any;
        if (fType === 'OVERDRAFT' || fType === 'DROP_LINE_OD') {
          fType = LoanFacilityType.OVERDRAFT_CASH_CREDIT;
        }

        await tx.loanFacility.create({
          data: {
            loanCaseId: loanCase.id,
            facilityType: fType || LoanFacilityType.NEW_TERM_LOAN,
            requestedAmount: dto.facility.requestedAmount || 100000,
            tenureMonths: dto.facility.tenureMonths || 60,
            interestRateType: dto.facility.interestRateType || 'FLOATING',
            targetRoiPercentage: dto.facility.targetRoiPercentage || null,
            disbursementMode: dto.facility.disbursementMode || 'SINGLE_DISBURSEMENT',
            marginPercentage: dto.facility.marginPercentage || null,
            ltvRatioPercentage: dto.facility.ltvRatioPercentage || null,
            existingLenderName: dto.facility.existingLenderName || null,
            existingLoanAccountNo: dto.facility.existingLoanAccountNo || null,
            outstandingAmount: dto.facility.outstandingAmount || null,
            existingRoiPercentage: dto.facility.existingRoiPercentage || null,
            topUpAmountRequested: dto.facility.topUpAmountRequested || null,
            foreclosureCharges: dto.facility.foreclosureCharges || null,
          },
        });
      }

      // 5. Co-applicants / guarantors
      if (dto.parties && dto.parties.length > 0) {
        for (const p of dto.parties) {
          await tx.loanParty.create({
            data: {
              loanCaseId: loanCase.id,
              role: p.role || LoanPartyRole.CO_APPLICANT,
              name: p.name || 'Co-Applicant',
              relationship: p.relationship || null,
              dateOfBirth: p.dateOfBirth ? new Date(p.dateOfBirth) : null,
              gender: p.gender || null,
              mobileNumber: p.mobileNumber || null,
              email: p.email || null,
              panNumber: p.panNumber || null,
              aadhaarNumber: p.aadhaarNumber || null,
              occupation: p.occupation || null,
              employerBusinessName: p.employerBusinessName || null,
              monthlyIncome: p.monthlyIncome || null,
              cibilScore: p.cibilScore && p.cibilScore > 0 ? p.cibilScore : null,
              address: p.address || {},
            },
          });
        }
      }

      return loanCase;
    });
  }

  async findAll(pagination: PaginationDto, actor: ActorContext, filters?: any) {
    const scopeFilter = this.scopeResolver.resolveScopeFilter(actor, 'LOAN_APPLICATION_CASE');
    const page = pagination.page || 1;
    const limit = pagination.limit || 25;
    const skip = (page - 1) * limit;

    const where: any = {
      ...scopeFilter,
      deletedAt: null,
    };

    if (filters?.category) {
      where.category = filters.category;
    }
    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.search) {
      const q = filters.search.trim();
      where.OR = [
        { caseCode: { contains: q, mode: 'insensitive' } },
        { contact: { firstName: { contains: q, mode: 'insensitive' } } },
        { contact: { lastName: { contains: q, mode: 'insensitive' } } },
        { contact: { phone: { contains: q } } },
        { contact: { email: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.loanApplicationCase.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              panNumber: true,
            },
          },
          agent: {
            select: { id: true, agentCode: true, user: { select: { firstName: true, lastName: true } } },
          },
          facilities: {
            select: {
              id: true,
              facilityType: true,
              requestedAmount: true,
              tenureMonths: true,
              selectedOfferId: true,
              selectedOffer: {
                select: {
                  id: true,
                  lenderName: true,
                  offeredAmount: true,
                  rateOfInterest: true,
                  emiAmount: true,
                  status: true,
                },
              },
            },
          },
          _count: {
            select: { parties: true, documents: true, facilities: true },
          },
        },
      }),
      this.prisma.loanApplicationCase.count({ where }),
    ]);

    return new PaginatedResponseDto(data, total, page, limit);
  }

  async findOne(id: string, actor: ActorContext) {
    const loanCase = await this.prisma.loanApplicationCase.findUnique({
      where: { id },
      include: {
        contact: true,
        agent: {
          select: { id: true, agentCode: true, user: { select: { firstName: true, lastName: true } } },
        },
        lead: {
          select: { id: true, leadCode: true, title: true, status: true },
        },
        parties: {
          orderBy: { createdAt: 'asc' },
        },
        facilities: {
          include: {
            lenderOffers: {
              orderBy: { rateOfInterest: 'asc' },
            },
            addOns: true,
            selectedOffer: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        documents: {
          include: {
            document: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!loanCase || loanCase.deletedAt) {
      throw new NotFoundException(`Loan case ${id} not found`);
    }

    this.authzService.authorize(actor, 'LOAN_APPLICATION_CASE', 'READ', loanCase);
    return loanCase;
  }

  async updateCase(id: string, dto: UpdateLoanCaseDto, actor: ActorContext) {
    const existing = await this.findOne(id, actor);
    this.authzService.authorize(actor, 'LOAN_APPLICATION_CASE', 'UPDATE', existing);

    const mergedCategoryData = dto.categoryData || (existing.categoryData as any) || {};
    if (dto.disbursementDetails) {
      mergedCategoryData.disbursementDetails = {
        ...(mergedCategoryData.disbursementDetails || {}),
        ...dto.disbursementDetails,
      };
    }

    return this.prisma.loanApplicationCase.update({
      where: { id },
      data: {
        ...(dto.category ? { category: dto.category } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.occupationType ? { occupationType: dto.occupationType } : {}),
        ...(dto.employerBusinessName ? { employerBusinessName: dto.employerBusinessName } : {}),
        ...(dto.monthlyIncome !== undefined ? { monthlyIncome: dto.monthlyIncome } : {}),
        ...(dto.annualIncome !== undefined ? { annualIncome: dto.annualIncome } : {}),
        ...(dto.existingEmiObligations !== undefined ? { existingEmiObligations: dto.existingEmiObligations } : {}),
        ...(dto.cibilScore !== undefined ? { cibilScore: dto.cibilScore && dto.cibilScore > 0 ? dto.cibilScore : null } : {}),
        ...(dto.bankAccountDetails ? { bankAccountDetails: dto.bankAccountDetails } : {}),
        ...(dto.residentialAddress ? { residentialAddress: dto.residentialAddress } : {}),
        ...(dto.permanentAddress ? { permanentAddress: dto.permanentAddress } : {}),
        categoryData: mergedCategoryData,
      },
      include: {
        contact: true,
        parties: true,
        facilities: {
          include: { lenderOffers: true, addOns: true, selectedOffer: true },
        },
      },
    });
  }

  async updateStatus(id: string, status: LoanEnquiryStatus, actor: ActorContext, reason?: string) {
    const loanCase = await this.findOne(id, actor);
    this.authzService.authorize(actor, 'LOAN_APPLICATION_CASE', 'TRANSITION', loanCase);

    const categoryData = (loanCase.categoryData as any) || {};
    if (reason) {
      categoryData.statusHistory = categoryData.statusHistory || [];
      categoryData.statusHistory.push({
        from: loanCase.status,
        to: status,
        reason,
        timestamp: new Date().toISOString(),
        actorId: actor.userId,
      });
    }

    return this.prisma.loanApplicationCase.update({
      where: { id },
      data: {
        status,
        categoryData,
      },
      include: {
        contact: true,
        facilities: {
          include: { lenderOffers: true, selectedOffer: true, addOns: true },
        },
      },
    });
  }

  async issueSanction(id: string, dto: IssueLoanSanctionDto, actor: ActorContext) {
    const loanCase = await this.findOne(id, actor);
    this.authzService.authorize(actor, 'LOAN_APPLICATION_CASE', 'TRANSITION', loanCase);

    const categoryData = (loanCase.categoryData as any) || {};
    categoryData.sanctionDetails = {
      sanctionDate: dto.sanctionDate || new Date().toISOString().slice(0, 10),
      sanctionLetterDocId: dto.sanctionLetterDocId || null,
      sanctionedAmount: dto.sanctionedAmount || null,
      notes: dto.notes || null,
      sanctionedAt: new Date().toISOString(),
      sanctionedById: actor.userId,
    };

    return this.prisma.$transaction(async (tx) => {
      // 1. If any selected offers exist, update sanction attributes
      for (const facility of loanCase.facilities) {
        if (facility.selectedOfferId) {
          await tx.loanLenderOffer.update({
            where: { id: facility.selectedOfferId },
            data: {
              ...(dto.sanctionLetterDocId ? { sanctionLetterDocId: dto.sanctionLetterDocId } : {}),
              ...(dto.sanctionDate ? { sanctionDate: new Date(dto.sanctionDate) } : {}),
            },
          });
        }
      }

      // 2. Transition case to SANCTIONED
      return tx.loanApplicationCase.update({
        where: { id },
        data: {
          status: LoanEnquiryStatus.SANCTIONED,
          categoryData,
        },
        include: {
          contact: true,
          facilities: {
            include: { lenderOffers: true, selectedOffer: true, addOns: true },
          },
        },
      });
    });
  }

  async issueLoanDisbursement(id: string, dto: IssueLoanDisbursementDto, actor: ActorContext) {
    const loanCase = await this.findOne(id, actor);
    this.authzService.authorize(actor, 'LOAN_APPLICATION_CASE', 'TRANSITION', loanCase);

    const categoryData = (loanCase.categoryData as any) || {};
    const selectedOffers = loanCase.facilities
      .map((f) => f.selectedOffer)
      .filter(Boolean);

    const defaultDisbursedAmount =
      dto.disbursedAmount ||
      selectedOffers.reduce((sum, o) => sum + Number(o?.offeredAmount || 0), 0) ||
      loanCase.facilities.reduce((sum, f) => sum + Number(f.requestedAmount || 0), 0);

    const defaultBankName = dto.bankName || selectedOffers[0]?.lenderName || 'Lending Partner';

    categoryData.disbursementDetails = {
      loanAccountNumber: dto.loanAccountNumber || `LON-${loanCase.caseCode}-${Date.now().toString().slice(-4)}`,
      disbursementDate: dto.disbursementDate || new Date().toISOString().slice(0, 10),
      disbursedAmount: defaultDisbursedAmount,
      utrNumber: dto.utrNumber || `UTR-${Date.now().toString().slice(-8)}`,
      bankName: defaultBankName,
      notes: dto.notes || null,
      disbursedAt: new Date().toISOString(),
      disbursedById: actor.userId,
    };

    return this.prisma.$transaction(async (tx) => {
      // 1. Mark case as DISBURSED (Loan Formally Issued)
      const updated = await tx.loanApplicationCase.update({
        where: { id },
        data: {
          status: LoanEnquiryStatus.DISBURSED,
          categoryData,
        },
        include: {
          contact: true,
          facilities: {
            include: { lenderOffers: true, selectedOffer: true, addOns: true },
          },
        },
      });

      // 2. Auto-close any underwriting task in back office queue
      try {
        if ((tx as any).backOfficeTask?.updateMany) {
          await (tx as any).backOfficeTask.updateMany({
            where: {
              entityId: loanCase.id,
              entityType: 'LOAN_CASE',
            },
            data: {
              status: 'COMPLETED',
            },
          });
        }
      } catch (e) {
        // Safe ignore
      }

      return updated;
    });
  }

  async addParty(caseId: string, dto: CreateLoanPartyDto, actor: ActorContext) {
    const loanCase = await this.findOne(caseId, actor);
    this.authzService.authorize(actor, 'LOAN_APPLICATION_CASE', 'UPDATE', loanCase);

    return this.prisma.loanParty.create({
      data: {
        loanCaseId: caseId,
        role: dto.role,
        name: dto.name,
        relationship: dto.relationship || null,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
        gender: dto.gender || null,
        mobileNumber: dto.mobileNumber || null,
        email: dto.email || null,
        panNumber: dto.panNumber || null,
        aadhaarNumber: dto.aadhaarNumber || null,
        occupation: dto.occupation || null,
        employerBusinessName: dto.employerBusinessName || null,
        monthlyIncome: dto.monthlyIncome || null,
        cibilScore: dto.cibilScore && dto.cibilScore > 0 ? dto.cibilScore : null,
        address: dto.address || {},
      },
    });
  }

  async removeParty(caseId: string, partyId: string, actor: ActorContext) {
    const loanCase = await this.findOne(caseId, actor);
    this.authzService.authorize(actor, 'LOAN_APPLICATION_CASE', 'UPDATE', loanCase);

    const party = await this.prisma.loanParty.findFirst({
      where: { id: partyId, loanCaseId: caseId },
    });
    if (!party) {
      throw new NotFoundException(`Party ${partyId} not found on this case`);
    }

    await this.prisma.loanParty.delete({ where: { id: partyId } });
    return { success: true, message: 'Party removed from case' };
  }

  async submitForReview(id: string, actor: ActorContext) {
    const loanCase = await this.findOne(id, actor);
    this.authzService.authorize(actor, 'LOAN_APPLICATION_CASE', 'TRANSITION', loanCase);

    if (loanCase.status === LoanEnquiryStatus.SUBMITTED_FOR_REVIEW) {
      return loanCase;
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.loanApplicationCase.update({
        where: { id },
        data: { status: LoanEnquiryStatus.SUBMITTED_FOR_REVIEW },
      });

      // Best effort auto-create BackOfficeTask for underwriting queue
      try {
        if ((tx as any).backOfficeTask?.create) {
          await (tx as any).backOfficeTask.create({
            data: {
              taskNumber: `BOT-LN-${loanCase.caseCode}`,
              entityType: 'LOAN_CASE',
              entityId: loanCase.id,
              title: `Loan Underwriting: ${loanCase.category} - ${loanCase.caseCode}`,
              status: 'PENDING',
              priority: 'HIGH',
              assignedToId: null,
            },
          });
        }
      } catch (e) {
        // Safe ignore if task system has custom constraints
      }

      return updated;
    });
  }
}
