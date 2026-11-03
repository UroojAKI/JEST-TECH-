import { GenerateQuotationService } from './generate-quotation.service';
import { QuotationMapper } from '../../mappers/quotation.mapper';

describe('GenerateQuotationService Agent attribution', () => {
  it('stores the canonical Agent and resolved external-code reference on the quotation', async () => {
    const quotation = {
      id: 'quotation-1',
      quotationCode: 'QTN-000001',
      insurerName: 'Insurer A',
      productType: 'HEALTH',
      sumInsured: { toString: () => '100000' },
      basePremium: { toString: () => '2000' },
      gstAmount: { toString: () => '360' },
      totalPremium: { toString: () => '2360' },
      discountAmount: { toString: () => '0' },
      ncbPercentage: 0,
    };
    const repository = {
      generateQuotationCode: jest.fn().mockResolvedValue('QTN-000001'),
      create: jest.fn().mockResolvedValue(quotation),
      createVersion: jest.fn().mockResolvedValue({}),
      addHistoryEntry: jest.fn().mockResolvedValue({}),
      addDocument: jest.fn().mockResolvedValue({}),
      findDetail: jest.fn().mockResolvedValue(quotation),
    };
    const resolver = {
      resolveExternalCodeForAssignment: jest.fn().mockResolvedValue({
        agentId: 'agent-1',
        externalCodeId: 'external-code-1',
      }),
      validateAgentOwnership: jest.fn().mockResolvedValue({ id: 'agent-1' }),
    };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ companyId: 'company-1' }) },
      contact: {
        findUnique: jest.fn().mockResolvedValue({ id: 'contact-1', companyId: 'company-1' }),
      },
    };
    const mapper = jest.spyOn(QuotationMapper, 'toResponse').mockReturnValue({ id: 'quotation-1' } as any);
    const service = new GenerateQuotationService(
      repository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { generateDocumentPdf: jest.fn().mockResolvedValue({ fileKey: 'quote.pdf', fileName: 'quote.pdf', fileSize: 10 }) } as any,
      {} as any,
      {} as any,
      prisma as any,
      resolver as any,
    );

    await service.execute(
      {
        title: 'Health quote',
        contactId: 'contact-1',
        insurerName: 'Insurer A',
        productType: 'HEALTH',
        sumInsured: 100000,
        policyTenure: 1,
        expiryDate: '2027-01-01T00:00:00.000Z',
        externalAgentCode: 'IGSK001',
        agentCodeSystem: 'CLIENT_A',
      } as any,
      'creator-user-1',
      {
        id: 'ops-user-1',
        userId: 'ops-user-1',
        companyId: 'company-1',
        organizationId: 'company-1',
        role: 'BACK_OFFICE',
      } as any,
    );

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: { connect: { id: 'agent-1' } },
        agentExternalCode: { connect: { id: 'external-code-1' } },
      }),
    );
    expect(resolver.resolveExternalCodeForAssignment).toHaveBeenCalledWith(
      'IGSK001',
      'CLIENT_A',
      expect.objectContaining({ userId: 'ops-user-1', companyId: 'company-1' }),
    );
    mapper.mockRestore();
  });
});
