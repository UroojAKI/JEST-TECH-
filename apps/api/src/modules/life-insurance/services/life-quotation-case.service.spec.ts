import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  Gender,
  LifeCaseStatus,
  LifePlanCategory,
  LifePolicyType,
  PaymentTrackingStatus,
  PremiumPaymentFrequency,
  PremiumPaymentType,
  ProposerRelation,
  RoleType,
} from '@prisma/client';
import { LifeQuotationCaseService } from './life-quotation-case.service';
import { LifeQuotationCalculationService } from './life-quotation-calculation.service';

const makeService = (prisma: any, tenantAuth: any = {}) => {
  const numberingEngine = { generateNext: jest.fn().mockResolvedValue('LQC-2026-00001') };
  const calcService = new LifeQuotationCalculationService();
  const documentService = { evaluateChecklist: jest.fn() } as any;
  const agentIdentityResolver = { validateAgentOwnership: jest.fn(async (id) => ({ id })) } as any;

  return new LifeQuotationCaseService(
    prisma,
    tenantAuth,
    numberingEngine as any,
    calcService,
    documentService,
    agentIdentityResolver,
  );
};

describe('LifeQuotationCaseService', () => {
  const mockUser: any = {
    id: 'user-1',
    userId: 'user-1',
    companyId: 'company-1',
    role: RoleType.BACK_OFFICE,
  };

  const mockAgentUser: any = {
    id: 'user-agent-1',
    userId: 'user-agent-1',
    agentId: 'agent-1',
    companyId: 'company-1',
    role: RoleType.AGENT,
  };

  describe('Multi-Tenancy & Agent Scoping', () => {
    it('scopes case queries to the tenant companyId and agent ownership', async () => {
      const prisma = {
        lifeQuotationCase: {
          findFirst: jest.fn().mockResolvedValue({ id: 'case-1', companyId: 'company-1' }),
        },
      };
      const service = makeService(prisma);

      await service.findCaseForActor('case-1', mockAgentUser);

      expect(prisma.lifeQuotationCase.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'case-1',
          companyId: 'company-1',
          deletedAt: null,
          OR: [
            { agentId: 'agent-1' },
            { agentId: null, createdById: 'user-agent-1' },
          ],
        },
      });
    });

    it('rejects contact if tenant authorization fails', async () => {
      const prisma = {};
      const tenantAuth = {
        assertTenantResource: jest.fn().mockRejectedValue(new NotFoundException('Contact not found or access denied')),
      };
      const service = makeService(prisma, tenantAuth);

      await expect(
        service.createCase(
          {
            contactId: 'foreign-contact-id',
            planCategory: LifePlanCategory.TERM_INSURANCE,
          } as any,
          mockUser,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('Minor Nominee & Appointee Validation', () => {
    it('requires appointee details when nominee is a minor (< 18 years old)', async () => {
      const contact = {
        id: 'contact-1',
        companyId: 'company-1',
        firstName: 'Rahul',
        lastName: 'Sharma',
        dateOfBirth: new Date('1985-05-15'),
        gender: Gender.MALE,
      };

      const prisma = {
        contact: { findFirst: jest.fn().mockResolvedValue(contact) },
      };
      const tenantAuth = {
        assertTenantResource: jest.fn().mockResolvedValue(contact),
        assertAssignableAgent: jest.fn(),
      };
      const service = makeService(prisma, tenantAuth);

      // Nominee born in 2018 (around 8 years old - minor) without appointee
      await expect(
        service.createCase(
          {
            contactId: 'contact-1',
            planCategory: LifePlanCategory.TERM_INSURANCE,
            nomineeName: 'Baby Sharma',
            nomineeDob: '2018-01-01',
            nomineeRelation: 'CHILD' as any,
          } as any,
          mockUser,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an appointee who is also a minor (< 18 years old)', async () => {
      const contact = {
        id: 'contact-1',
        companyId: 'company-1',
        firstName: 'Rahul',
        lastName: 'Sharma',
        dateOfBirth: new Date('1985-05-15'),
        gender: Gender.MALE,
      };

      const prisma = {
        contact: { findFirst: jest.fn().mockResolvedValue(contact) },
      };
      const tenantAuth = {
        assertTenantResource: jest.fn().mockResolvedValue(contact),
        assertAssignableAgent: jest.fn(),
      };
      const service = makeService(prisma, tenantAuth);

      // Minor nominee with minor appointee (appointee born in 2012)
      await expect(
        service.createCase(
          {
            contactId: 'contact-1',
            planCategory: LifePlanCategory.TERM_INSURANCE,
            nomineeName: 'Baby Sharma',
            nomineeDob: '2018-01-01',
            nomineeRelation: 'CHILD' as any,
            appointeeName: 'Sibling Sharma',
            appointeeDob: '2012-05-10', // 14 years old
            appointeeRelation: 'SIBLING' as any,
          } as any,
          mockUser,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('Proposer vs Life Assured Separation', () => {
    it('defaults life assured demographics from proposer when isLifeAssuredDifferent is false', async () => {
      const contact = {
        id: 'contact-1',
        companyId: 'company-1',
        contactCode: 'CONT-000001',
        firstName: 'Amit',
        lastName: 'Verma',
        dateOfBirth: new Date('1990-10-20'),
        gender: Gender.MALE,
        phone: '9876543210',
        email: 'amit@example.com',
        panNumber: 'ABCDE1234F',
        aadhaarNumber: '123456789012',
      };

      const createdRecord: any = {
        id: 'case-1',
        caseCode: 'LQC-2026-00001',
        companyId: 'company-1',
        contactId: 'contact-1',
        lifeAssuredName: 'Amit Verma',
        lifeAssuredDob: contact.dateOfBirth,
        lifeAssuredGender: Gender.MALE,
        isLifeAssuredDifferent: false,
        proposerRelation: ProposerRelation.SELF,
        customerSnapshot: {},
        contact,
        quotations: [],
        documents: [],
      };

      const prisma = {
        contact: {
          findFirst: jest.fn().mockResolvedValue(contact),
          update: jest.fn(),
        },
        lifeQuotationCase: {
          create: jest.fn().mockResolvedValue(createdRecord),
        },
      };

      const tenantAuth = {
        assertTenantResource: jest.fn().mockResolvedValue(contact),
        assertAssignableAgent: jest.fn(),
      };
      const service = makeService(prisma, tenantAuth);

      const result = await service.createCase(
        {
          contactId: 'contact-1',
          planCategory: LifePlanCategory.TERM_INSURANCE,
          isLifeAssuredDifferent: false,
        } as any,
        mockUser,
      );

      expect(prisma.lifeQuotationCase.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lifeAssuredName: 'Amit Verma',
            isLifeAssuredDifferent: false,
            proposerRelation: ProposerRelation.SELF,
          }),
        }),
      );
      expect(result.id).toBe('case-1');
    });

    it('requires dedicated life assured name, dob, and gender when isLifeAssuredDifferent is true', async () => {
      const contact = {
        id: 'contact-1',
        companyId: 'company-1',
        firstName: 'Amit',
        lastName: 'Verma',
        dateOfBirth: new Date('1990-10-20'),
        gender: Gender.MALE,
      };

      const prisma = {
        contact: { findFirst: jest.fn().mockResolvedValue(contact) },
      };
      const tenantAuth = {
        assertTenantResource: jest.fn().mockResolvedValue(contact),
        assertAssignableAgent: jest.fn(),
      };
      const service = makeService(prisma, tenantAuth);

      await expect(
        service.createCase(
          {
            contactId: 'contact-1',
            planCategory: LifePlanCategory.TERM_INSURANCE,
            isLifeAssuredDifferent: true,
            // missing lifeAssuredName, dob, gender
          } as any,
          mockUser,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('Joint-Life Annuity Underwriting (Category 1.7)', () => {
    it('requires secondaryLifeAssured when Annuity category specifies JOINT_LIFE option', async () => {
      const contact = {
        id: 'contact-1',
        companyId: 'company-1',
        firstName: 'Sunil',
        lastName: 'Mehta',
        dateOfBirth: new Date('1965-02-10'),
        gender: Gender.MALE,
      };

      const prisma = {
        contact: { findFirst: jest.fn().mockResolvedValue(contact) },
      };
      const tenantAuth = {
        assertTenantResource: jest.fn().mockResolvedValue(contact),
        assertAssignableAgent: jest.fn(),
      };
      const service = makeService(prisma, tenantAuth);

      await expect(
        service.createCase(
          {
            contactId: 'contact-1',
            planCategory: LifePlanCategory.ANNUITY,
            categoryData: {
              annuityOption: 'JOINT_LIFE_LAST_SURVIVOR',
            },
            // Missing secondaryLifeAssured
          } as any,
          mockUser,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('Quotation Addition and Selection', () => {
    it('creates canonical quotation and persists associated riders', async () => {
      const existingCase: any = {
        id: 'case-1',
        caseCode: 'LQC-2026-00001',
        companyId: 'company-1',
        planCategory: LifePlanCategory.TERM_INSURANCE,
        status: LifeCaseStatus.DRAFT,
        contactId: 'contact-1',
        agentId: 'agent-1',
        agentExternalCodeId: null,
        leadId: null,
      };

      const createdQuote: any = {
        id: 'quote-1',
        companyId: 'company-1',
        quotationCode: 'QT-2026-00001',
        productType: 'LIFE',
        totalPremium: 23600,
      };

      const txMock = {
        quotation: { create: jest.fn().mockResolvedValue(createdQuote) },
        lifeQuotationRider: { create: jest.fn() },
        lifeQuotationCase: { update: jest.fn() },
      };

      const prisma = {
        lifeQuotationCase: {
          findFirst: jest.fn().mockResolvedValue(existingCase),
        },
        $transaction: jest.fn(async (cb) => cb(txMock)),
      };

      const service = makeService(prisma);
      jest.spyOn(service, 'getCase').mockResolvedValue(existingCase);

      await service.addQuote(
        'case-1',
        {
          insurerName: 'HDFC Life',
          productCode: 'CLICK2PROTECT',
          sumInsured: 10000000,
          basePremium: 20000,
          policyTermYears: 40,
          premiumPayingTermYears: 10,
          lifePolicyType: LifePolicyType.INDIVIDUAL_PURE_RISK,
          premiumPaymentType: PremiumPaymentType.LIMITED_PAY,
          premiumFrequency: PremiumPaymentFrequency.ANNUAL,
        },
        mockUser,
      );

      expect(txMock.quotation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            productType: 'LIFE',
            sumInsured: expect.anything(),
            basePremium: expect.anything(),
            gstAmount: expect.anything(),
            totalPremium: expect.anything(),
          }),
        }),
      );
      expect(txMock.lifeQuotationCase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: LifeCaseStatus.QUOTED },
        }),
      );
    });

    it('selects winning quotation and updates case status to APPROVED', async () => {
      const existingCase: any = {
        id: 'case-1',
        companyId: 'company-1',
        status: LifeCaseStatus.QUOTED,
      };

      const quotation: any = {
        id: 'quote-1',
        lifeCaseId: 'case-1',
        companyId: 'company-1',
      };

      const txMock = {
        quotation: {
          update: jest.fn().mockResolvedValue({ id: 'quote-1', status: 'ACCEPTED' }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        lifeQuotationCase: {
          update: jest.fn().mockResolvedValue({
            ...existingCase,
            selectedQuoteId: 'quote-1',
            status: LifeCaseStatus.APPROVED,
            contact: null,
            quotations: [],
            documents: [],
          }),
        },
      };

      const prisma = {
        lifeQuotationCase: {
          findFirst: jest.fn().mockResolvedValue(existingCase),
        },
        quotation: {
          findFirst: jest.fn().mockResolvedValue(quotation),
        },
        $transaction: jest.fn(async (cb) => cb(txMock)),
      };

      const service = makeService(prisma);

      const result = await service.selectQuote('case-1', 'quote-1', mockUser);

      expect(txMock.quotation.updateMany).toHaveBeenCalledWith({
        where: {
          lifeCaseId: 'case-1',
          companyId: 'company-1',
          id: { not: 'quote-1' },
          status: 'ACCEPTED',
        },
        data: { status: 'PENDING_APPROVAL' },
      });
      expect(txMock.quotation.update).toHaveBeenCalledWith({
        where: { id: 'quote-1' },
        data: { status: 'ACCEPTED' },
      });
      expect(txMock.lifeQuotationCase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { selectedQuoteId: 'quote-1', status: LifeCaseStatus.APPROVED },
        }),
      );
      expect(result.status).toBe(LifeCaseStatus.APPROVED);
    });

    it('rejects quote selection if proposal case is in a terminal status (CONVERTED or CANCELLED)', async () => {
      const convertedCase: any = {
        id: 'case-1',
        companyId: 'company-1',
        status: LifeCaseStatus.CONVERTED,
      };

      const prisma = {
        lifeQuotationCase: {
          findFirst: jest.fn().mockResolvedValue(convertedCase),
        },
      };

      const service = makeService(prisma);

      await expect(
        service.selectQuote('case-1', 'quote-1', mockUser),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('Payment Recording & Role Restrictions', () => {
    it('prohibits AGENT role from marking payments as PAID directly', async () => {
      const prisma = {
        lifeQuotationCase: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'case-1',
            companyId: 'company-1',
            selectedQuoteId: 'quote-1',
          }),
        },
      };
      const service = makeService(prisma);

      await expect(
        service.recordPayment(
          'case-1',
          {
            referenceNumber: 'UTR12345678',
            paymentMethod: 'NET_BANKING',
            status: PaymentTrackingStatus.PAID,
          },
          mockAgentUser, // RoleType.AGENT
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('requires exact amount match against authoritative quote payable for PAID status', async () => {
      const lifeCase = {
        id: 'case-1',
        companyId: 'company-1',
        selectedQuoteId: 'quote-1',
      };
      const quotation = {
        id: 'quote-1',
        companyId: 'company-1',
        totalPremium: 23600,
      };

      const prisma = {
        lifeQuotationCase: { findFirst: jest.fn().mockResolvedValue(lifeCase) },
        quotation: { findFirst: jest.fn().mockResolvedValue(quotation) },
      };
      const service = makeService(prisma);

      // Back office tries to verify ₹20,000 when payable is ₹23,600
      await expect(
        service.recordPayment(
          'case-1',
          {
            amount: 20000,
            referenceNumber: 'UTR12345678',
            paymentMethod: 'NET_BANKING',
            status: PaymentTrackingStatus.PAID,
          },
          mockUser, // RoleType.BACK_OFFICE
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});

