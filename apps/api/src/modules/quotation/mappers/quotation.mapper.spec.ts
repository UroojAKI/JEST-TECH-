import { QuotationMapper } from './quotation.mapper';

describe('QuotationMapper PII masking', () => {
  it('masks contact and nested calculation PII in standard quotation responses', () => {
    const response = QuotationMapper.toResponse({
      id: 'quote-1',
      quotationCode: 'Q-1',
      title: 'Health quote',
      status: 'DRAFT',
      leadId: null,
      contactId: 'contact-1',
      accountId: null,
      insurerName: 'Insurer',
      productType: 'HEALTH',
      sumInsured: 500000,
      basePremium: 1000,
      gstAmount: 180,
      totalPremium: 1180,
      ncbPercentage: 0,
      discountAmount: 0,
      expiryDate: new Date('2026-12-01T00:00:00.000Z'),
      createdById: 'user-1',
      updatedById: 'user-1',
      createdAt: new Date('2026-11-04T00:00:00.000Z'),
      updatedAt: new Date('2026-11-04T00:00:00.000Z'),
      contact: {
        id: 'contact-1',
        firstName: 'Test',
        lastName: 'Customer',
        email: 'test@example.test',
        phone: '9000000000',
        panNumber: 'ABCDE1234F',
        aadhaarNumber: '123456789012',
      },
      motorMetadata: {
        proposerDetails: { panNumber: 'ABCDE1234F', aadhaarNumber: '123456789012' },
      },
      calculationSnapshot: { inputs: { pan: 'ABCDE1234F', aadhaarNumber: '123456789012' } },
      versions: [],
      addons: [],
      discounts: [],
      histories: [],
      documents: [],
    } as any);

    expect(response.contact.panNumber).toBe('XXXXX1234F');
    expect(response.contact.aadhaarNumber).toBe('XXXX-XXXX-9012');
    expect(response.motorMetadata.proposerDetails.panNumber).toBe('XXXXX1234F');
    expect(response.motorMetadata.proposerDetails.aadhaarNumber).toBe('XXXX-XXXX-9012');
    expect(response.calculationSnapshot.inputs.pan).toBe('XXXXX1234F');
    expect(response.calculationSnapshot.inputs.aadhaarNumber).toBe('XXXX-XXXX-9012');
  });
});
