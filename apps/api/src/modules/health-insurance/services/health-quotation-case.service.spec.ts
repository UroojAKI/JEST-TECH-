import { BadRequestException } from '@nestjs/common';
import { HealthQuotationCaseService } from './health-quotation-case.service';

const makeService = (prisma: any, tenantAuth: any = {}) =>
  new HealthQuotationCaseService(
    prisma,
    tenantAuth,
    { generateNext: jest.fn() } as any,
    { calculate: jest.fn() } as any,
    { validatePlanDetails: jest.fn(), validateRenewal: jest.fn() } as any,
    { validateAgentOwnership: jest.fn(async (id) => ({ id })) } as any,
  );

describe('HealthQuotationCaseService access and integrity', () => {
  it('scopes agent case lookup to the assigned Agent and creator fallback', async () => {
    const prisma = {
      healthQuotationCase: {
        findFirst: jest.fn().mockResolvedValue({ id: 'case-1', companyId: 'company-1' }),
      },
    };
    const service = makeService(prisma);

    await service.findCaseForActor('case-1', {
      id: 'user-1',
      userId: 'user-1',
      companyId: 'company-1',
      agentId: 'agent-1',
      role: 'AGENT',
    } as any);

    expect(prisma.healthQuotationCase.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'case-1',
        companyId: 'company-1',
        deletedAt: null,
        OR: [
          { agentId: 'agent-1' },
          { agentId: null, createdById: 'user-1' },
        ],
      },
    });
  });

  it('rejects a family member linked to a different proposer contact', async () => {
    const contact = {
      id: 'contact-1',
      companyId: 'company-1',
      createdById: 'user-1',
      customer: null,
      panNumber: null,
      aadhaarNumber: null,
    };
    const prisma = {
      contact: { findFirst: jest.fn().mockResolvedValue(contact) },
      familyMember: { findMany: jest.fn().mockResolvedValue([]) },
      healthQuotationCase: { create: jest.fn() },
    };
    const tenantAuth = { assertTenantResource: jest.fn().mockResolvedValue(contact) };
    const service = makeService(prisma, tenantAuth);

    await expect(
      service.createCase(
        {
          planCategory: 'INDIVIDUAL',
          policyForm: 'NEW_POLICY',
          contactId: 'contact-1',
          occupation: 'SALARIED',
          address: {},
          nomineeName: 'Nominee',
          nomineeRelation: 'SPOUSE',
          planDetails: {},
          members: [
            {
              familyMemberId: 'foreign-family-member',
              firstName: 'Member',
              relation: 'SELF',
              dateOfBirth: '1990-01-01',
              gender: 'FEMALE',
            },
          ],
        } as any,
        { id: 'user-1', userId: 'user-1', companyId: 'company-1', role: 'BACK_OFFICE' } as any,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.familyMember.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['foreign-family-member'] },
        contactId: 'contact-1',
        contact: { companyId: 'company-1' },
      },
      select: { id: true },
    });
    expect(prisma.healthQuotationCase.create).not.toHaveBeenCalled();
  });

  it('masks contact and quote PII in Health case responses', async () => {
    const prisma = {
      healthQuotationCase: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'case-1',
          companyId: 'company-1',
          customerSnapshot: {
            panNumber: 'ABCDE1234F',
            aadhaarNumber: '123456789012',
            legacy: { proposerPan: 'ABCDE1234F' },
          },
          contact: { panNumber: 'ABCDE1234F', aadhaarNumber: '123456789012' },
          quotations: [
            {
              healthMetadata: {
                insured: { proposerPan: 'ABCDE1234F' },
                proposerAadhaar: '123456789012',
              },
            },
          ],
          selectedQuote: {
            healthMetadata: {
              proposerPan: 'ABCDE1234F',
              proposerAadhaar: '123456789012',
            },
          },
        }),
      },
    };
    const service = makeService(prisma);

    const response = await service.getCase('case-1', {
      id: 'ops-1',
      userId: 'ops-1',
      companyId: 'company-1',
      role: 'BACK_OFFICE',
    } as any);
    const safeResponse = response as any;

    expect(safeResponse.contact.panNumber).toBe('XXXXX1234F');
    expect(safeResponse.contact.aadhaarNumber).toBe('XXXX-XXXX-9012');
    expect(safeResponse.customerSnapshot.panNumber).toBe('XXXXX1234F');
    expect(safeResponse.customerSnapshot.aadhaarNumber).toBe('XXXX-XXXX-9012');
    expect(safeResponse.customerSnapshot.legacy.proposerPan).toBe('XXXXX1234F');
    expect(safeResponse.quotations[0].healthMetadata.insured.proposerPan).toBe('XXXXX1234F');
    expect(safeResponse.selectedQuote.healthMetadata.proposerAadhaar).toBe('XXXX-XXXX-9012');
  });

  it('writes payment evidence and quotation workflow inside one transaction', async () => {
    const tx = {
      healthQuotationCase: {
        findFirst: jest.fn().mockResolvedValue({ id: 'case-1', selectedQuoteId: 'quote-1' }),
      },
      quotation: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'quote-1',
          companyId: 'company-1',
          healthCaseId: 'case-1',
          totalPremium: 1000,
          status: 'ACCEPTED',
        }),
        update: jest.fn().mockResolvedValue(undefined),
      },
      motorPaymentRecord: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(undefined),
      },
    };
    const prisma = {
      $transaction: jest.fn((work: (client: any) => Promise<any>) => work(tx)),
      healthQuotationCase: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'case-1',
          companyId: 'company-1',
          contact: null,
          customerSnapshot: {},
          quotations: [],
          selectedQuote: null,
        }),
      },
    };
    const service = makeService(prisma);

    await service.recordPayment(
      'case-1',
      { amount: 1000, paymentMethod: 'UPI', referenceNumber: 'UTR-1' } as any,
      { id: 'ops-1', userId: 'ops-1', companyId: 'company-1', role: 'BACK_OFFICE' } as any,
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.motorPaymentRecord.create).toHaveBeenCalled();
    expect(tx.quotation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'quote-1', companyId: 'company-1', healthCaseId: 'case-1' },
        data: expect.objectContaining({ workflowState: 'PAYMENT_DONE' }),
      }),
    );
  });

  it('does not downgrade an already verified payment', async () => {
    const tx = {
      healthQuotationCase: {
        findFirst: jest.fn().mockResolvedValue({ id: 'case-1', selectedQuoteId: 'quote-1' }),
      },
      quotation: {
        findFirst: jest.fn().mockResolvedValue({ id: 'quote-1', totalPremium: 1000 }),
        update: jest.fn(),
      },
      motorPaymentRecord: {
        findUnique: jest.fn().mockResolvedValue({
          status: 'PAID',
          amount: 1000,
          paymentMethod: 'UPI',
          referenceNumber: 'UTR-1',
        }),
        update: jest.fn(),
        create: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn((work: (client: any) => Promise<any>) => work(tx)),
    };
    const service = makeService(prisma);

    await expect(
      service.recordPayment(
        'case-1',
        { amount: 1000, paymentMethod: 'UPI', referenceNumber: 'UTR-1', status: 'UNDER_PROCESS' } as any,
        { id: 'ops-1', userId: 'ops-1', companyId: 'company-1', role: 'BACK_OFFICE' } as any,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.motorPaymentRecord.update).not.toHaveBeenCalled();
    expect(tx.quotation.update).not.toHaveBeenCalled();
  });
});
