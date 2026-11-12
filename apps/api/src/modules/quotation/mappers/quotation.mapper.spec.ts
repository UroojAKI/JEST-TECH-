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

  it('preserves insurerId, motorWorkflowState, and proposal summary for UI handoff and payment gating', () => {
    const response = QuotationMapper.toResponse({
      id: 'quote-2',
      quotationCode: 'QT-2026-11-000056',
      title: 'Motor quote',
      status: 'APPROVED',
      workflowState: 'PROPOSAL_APPROVED',
      issuanceStatus: 'PROPOSAL_READY',
      backOfficeSubmittedAt: new Date('2026-11-12T06:00:00.000Z'),
      leadId: null,
      contactId: 'contact-1',
      accountId: null,
      insurerId: 'insurer-1',
      insurerName: 'HDFC ERGO',
      productType: 'MOTOR',
      sumInsured: 500000,
      basePremium: 10000,
      gstAmount: 1800,
      totalPremium: 11800,
      ncbPercentage: 20,
      discountAmount: 0,
      expiryDate: new Date('2026-12-01T00:00:00.000Z'),
      createdById: 'user-1',
      updatedById: 'user-1',
      createdAt: new Date('2026-11-04T00:00:00.000Z'),
      updatedAt: new Date('2026-11-04T00:00:00.000Z'),
      proposal: {
        id: 'prop-1',
        status: 'APPROVED',
        proposalNumber: 'PROP-001',
      },
      motorPaymentRecord: {
        id: 'pay-1',
        status: 'PAID',
        amount: 11800,
      },
      versions: [],
      addons: [],
      discounts: [],
      histories: [],
      documents: [],
    } as any);

    expect(response.insurerId).toBe('insurer-1');
    expect(response.motorWorkflowState).toBe('PROPOSAL_APPROVED');
    expect(response.proposalStatus).toBe('APPROVED');
    expect(response.proposal).toEqual({
      id: 'prop-1',
      status: 'APPROVED',
      proposalNumber: 'PROP-001',
    });
    expect(response.motorPaymentRecord?.status).toBe('PAID');
    expect((response.workflowState as any)?.status).toBe('APPROVED');
  });
});
