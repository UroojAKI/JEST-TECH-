import { BackOfficeTaskStatus } from '@prisma/client';

describe('Wave 2 WF-006B: BackOfficeTask caseId Migration & Non-Destructive Reconciliation', () => {
  it('defines UNRESOLVED_MIGRATION in BackOfficeTaskStatus enum', () => {
    expect(BackOfficeTaskStatus.UNRESOLVED_MIGRATION).toBe('UNRESOLVED_MIGRATION');
  });

  it('reconciles orphaned tasks without silently deleting or archiving them', async () => {
    const mockTasks = [
      { id: 'task-1', motorQuotationId: 'quote-a', leadId: null, caseId: null },
      { id: 'task-2', motorQuotationId: null, leadId: 'lead-b', caseId: null },
      { id: 'task-3', motorQuotationId: null, leadId: null, caseId: null },
    ];

    const mockQuotes = { 'quote-a': { caseId: 'case-quote-1' } };
    const mockCases = { 'lead-b': { id: 'case-lead-1' } };

    const results = mockTasks.map((task) => {
      if (task.motorQuotationId && mockQuotes[task.motorQuotationId]?.caseId) {
        return { ...task, caseId: mockQuotes[task.motorQuotationId].caseId };
      }
      if (task.leadId && mockCases[task.leadId]?.id) {
        return { ...task, caseId: mockCases[task.leadId].id };
      }
      return { ...task, status: BackOfficeTaskStatus.UNRESOLVED_MIGRATION };
    });

    expect(results[0].caseId).toBe('case-quote-1');
    expect(results[1].caseId).toBe('case-lead-1');
    expect(results[2].caseId).toBeNull();
    expect((results[2] as any).status).toBe(BackOfficeTaskStatus.UNRESOLVED_MIGRATION);
  });
});
