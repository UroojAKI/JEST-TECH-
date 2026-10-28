import { HealthDocumentRuleService } from './health-document-rule.service';

describe('HealthDocumentRuleService', () => {
  const service = new HealthDocumentRuleService();
  const types = (list: { documentType: string }[]) => list.map((d) => d.documentType);
  const find = (list: any[], type: string) => list.find((d) => d.documentType === type);

  it('always includes the 7 common Section C documents', () => {
    const list = service.getRequirements('INDIVIDUAL', 'NEW_POLICY');

    expect(types(list)).toEqual([
      'PROPOSAL_FORM',
      'KYC_DOCUMENTS',
      'AGE_PROOF',
      'MEDICAL_TEST_REPORTS',
      'PREVIOUS_POLICY',
      'PORTABILITY_FORM',
      'GOOD_HEALTH_DECLARATION',
    ]);
  });

  it('requires the previous policy copy only for renewal / portability', () => {
    expect(find(service.getRequirements('INDIVIDUAL', 'NEW_POLICY'), 'PREVIOUS_POLICY').required).toBe(false);
    expect(find(service.getRequirements('INDIVIDUAL', 'RENEWAL_PORTABILITY'), 'PREVIOUS_POLICY').required).toBe(true);
  });

  it('adds relationship proof for family floater', () => {
    expect(types(service.getRequirements('FAMILY_FLOATER', 'NEW_POLICY'))).toContain('RELATIONSHIP_PROOF');
  });

  it('adds HR documents for group / corporate', () => {
    expect(types(service.getRequirements('GROUP_CORPORATE', 'NEW_POLICY'))).toEqual(
      expect.arrayContaining(['MASTER_POLICY_RULES', 'EMPLOYEE_CENSUS', 'HR_AUTHORIZATION']),
    );
  });

  it('adds base policy copy for top-up plans', () => {
    expect(types(service.getRequirements('TOP_UP', 'NEW_POLICY'))).toContain('BASE_POLICY_COPY');
  });
});
