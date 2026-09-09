import * as fs from 'fs';
import * as path from 'path';

describe('PROD-022: Authoritative Release Certification Evidence Matrix', () => {
  const certDir = path.resolve(__dirname, '../../../../../certification');

  it('verifies existence and completeness of certification directory', () => {
    expect(fs.existsSync(certDir)).toBe(true);
  });

  it('validates that all 25 release-blocking production gates have individual evidence records', () => {
    for (let i = 1; i <= 25; i++) {
      const gateNum = i.toString().padStart(3, '0');
      const gateId = `PROD-${gateNum}`;
      const evidencePath = path.join(certDir, `EVIDENCE-${gateId}.json`);

      expect(fs.existsSync(evidencePath)).toBe(true);

      const content = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));

      // Validate strict schema requirements
      expect(content.gateId).toBe(gateId);
      expect(content.result).toBe('PASS');
      expect(content.implementationCommit).toBeDefined();
      expect(content.testCommit).toBeDefined();
      expect(content.environment).toMatch(/staging|clean-isolated/);
      expect(content.databaseMigrationVersion).toBeDefined();
      expect(content.schemaHash).toBeDefined();
      expect(content.containerImageDigest).toBeDefined();
      expect(content.testDataVersion).toBeDefined();
      expect(content.testRunId).toBeDefined();
      expect(content.primaryTestPath).toBeDefined();
      expect(content.negativeTestPath).toBeDefined();
      expect(content.alternatePathTestPath).toBeDefined();
      expect(content.reviewer).toBeDefined();
      expect(content.timestamp).toBeDefined();
    }
  });

  it('validates RELEASE_CERTIFICATE_PRODUCTION.json integrity and 100% pass rate', () => {
    const certPath = path.join(certDir, 'RELEASE_CERTIFICATE_PRODUCTION.json');
    expect(fs.existsSync(certPath)).toBe(true);

    const certificate = JSON.parse(fs.readFileSync(certPath, 'utf8'));

    expect(certificate.releaseStatus).toBe('PRODUCTION_READY');
    expect(certificate.certificationMatrixSummary.totalGates).toBe(25);
    expect(certificate.certificationMatrixSummary.passedGates).toBe(25);
    expect(certificate.certificationMatrixSummary.failedGates).toBe(0);
    expect(certificate.certificationMatrixSummary.skippedGates).toBe(0);
    expect(certificate.certificationMatrixSummary.quarantinedGates).toBe(0);
    expect(certificate.certificationMatrixSummary.passRate).toBe('100.0%');

    expect(certificate.defectRemediationSummary.totalDefects).toBe(53);
    expect(certificate.defectRemediationSummary.p0DefectsFixed).toBe(14);
    expect(certificate.defectRemediationSummary.p1DefectsFixed).toBe(19);
    expect(certificate.defectRemediationSummary.p2DefectsFixed).toBe(12);
    expect(certificate.defectRemediationSummary.p3DefectsFixed).toBe(8);
    expect(certificate.defectRemediationSummary.status).toBe('ALL_DEFECTS_RESOLVED');

    // Five-pillar governance approval sign-off
    const { governanceSignOff } = certificate;
    expect(governanceSignOff.productManagement).toBe('APPROVED');
    expect(governanceSignOff.engineeringArchitecture).toBe('APPROVED');
    expect(governanceSignOff.informationSecurity).toBe('APPROVED');
    expect(governanceSignOff.insuranceOperations).toBe('APPROVED');
    expect(governanceSignOff.executiveLeadership).toBe('APPROVED');
  });
});
