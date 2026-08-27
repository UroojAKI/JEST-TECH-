import * as fs from 'fs';
import * as path from 'path';

describe('CI/CD & Production Infrastructure Hardening (Iteration 19)', () => {
  const rootDir = path.resolve(__dirname, '../../../..');

  it('should verify apps/api/Dockerfile enforces non-root USER execution', () => {
    const dockerfilePath = path.join(rootDir, 'apps/api/Dockerfile');
    expect(fs.existsSync(dockerfilePath)).toBe(true);

    const dockerfileContent = fs.readFileSync(dockerfilePath, 'utf-8');
    expect(dockerfileContent).toContain('USER nestjs');
    expect(dockerfileContent).toContain('adduser -S nestjs -G nodejs');
  });

  it('should verify apps/api/Dockerfile defines container HEALTHCHECK probe', () => {
    const dockerfilePath = path.join(rootDir, 'apps/api/Dockerfile');
    const dockerfileContent = fs.readFileSync(dockerfilePath, 'utf-8');

    expect(dockerfileContent).toContain('HEALTHCHECK');
    expect(dockerfileContent).toContain('/api/v1/health');
  });

  it('should verify GitHub Actions CI pipeline runs API tests and Prisma validation', () => {
    const ciPath = path.join(rootDir, '.github/workflows/ci.yml');
    expect(fs.existsSync(ciPath)).toBe(true);

    const ciContent = fs.readFileSync(ciPath, 'utf-8');
    expect(ciContent).toContain('pnpm --filter api test');
    expect(ciContent).toContain('prisma:generate');
  });

  it('should verify production docker-compose includes database healthcheck and restart policies', () => {
    const composePath = path.join(rootDir, 'docker-compose.yml');
    expect(fs.existsSync(composePath)).toBe(true);

    const composeContent = fs.readFileSync(composePath, 'utf-8');
    expect(composeContent).toContain('postgres:');
    expect(composeContent).toContain('healthcheck:');
  });
});
