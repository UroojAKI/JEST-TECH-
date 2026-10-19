# Domain K — CI/CD Pipeline & Supply Chain Audit

## Summary
A comprehensive audit of the CI/CD pipeline, GitHub Actions workflows, dependency supply chain, and build integrity was conducted for the JEST Policy CRM repository (`e:\JEST TECH\JEST POLICY\jest-policy-crm`).

The repository demonstrates several good supply chain practices, including strict `--frozen-lockfile` enforcement across all workflows, pinned package manager versions (`pnpm@10.34.4`), exclusion of dangerous `pull_request_target` triggers, secret scanning with Gitleaks in CI, and tamper-evident release certification scripts.

However, multiple **critical (P1)** and **major (P2)** findings prevent production deployment readiness:
1. **ESLint `--fix` Mutating Source in CI**: The deployment pipeline executes `pnpm turbo run lint --filter=api`, which runs `eslint ... --fix`, silently mutating source code on the runner before build/deploy.
2. **5 Critical & 14 High Unpatched Supply Chain Vulnerabilities**: Running `pnpm audit --audit-level=high` reports 63 vulnerabilities (including Next.js SSRF `GHSA-cjq9-62q9-8jv4` and sharp librsvg `CVE-2026-96889`), causing the security gates in `pr-checks.yml` and `deploy.yml` to fail.
3. **Undocumented Audit Exception (`CVE-2026-53571`)**: Root `package.json` ignores `CVE-2026-53571` without an owner, compensating controls, or expiration date.
4. **Production Certification is WITHDRAWN**: `certification/RELEASE_CERTIFICATE_PRODUCTION.json` is marked `WITHDRAWN`, schema hashes and commit SHAs mismatch HEAD, causing `scripts/verify-certification-validity.js` to exit with code 1 and block all automated deployments.
5. **Cold Deployment Crash in `deploy.yml`**: Deployment script runs `pm2 start pnpm --name "jest-app" -- run start` at repo root, but root `package.json` lacks a `start` script.
6. **Invalid Action Version in `codeql.yml`**: Uses non-existent `actions/checkout@v7`, breaking automated security scanning.
7. **Playwright Multi-Tenant E2E Tests Omitted from CI**: Browser isolation tests exist in `test/e2e` but are never run in any GitHub Actions workflow, and `playwright.config.ts` lacks a `webServer` block.

---

## Findings

### K-01: GitHub Actions Workflow Inventory & Pipeline Orchestration — RISK
**Severity**: P2  
**File**: `.github/workflows/` (`ci.yml`, `codeql.yml`, `deploy.yml`, `pr-checks.yml`, `production-remediation-ci.yml`)  
**Observed**:  
The repository contains 5 workflow files with overlapping triggers and divergent quality gates:

1. **`ci.yml` (CI Quality Gates)**:
   - **Triggers**: `push` on `[main, develop, 'feature/**', 'fix/**']`, `pull_request` on `[main, develop]`.
   - **Jobs**:
     - `api-quality-gates`: Runs on `ubuntu-latest`. Spins up `postgres:16-alpine` and `redis:7-alpine` service containers. Runs Gitleaks v8.30.1 scan, pnpm 10.34.4 setup, Node 24 setup, `pnpm install --frozen-lockfile`, `prisma:generate`, `prisma migrate deploy`, `tsc --noEmit` (API), `check:tenancy`, `check:mock-data`, API unit tests (`pnpm --filter api test`), certification tests (`pnpm --filter api test:cert`), e2e tests (`pnpm --filter api test:e2e`), and an HTTP smoke test readiness probe on `:4000/api/v1/health/ready`.
     - `web-quality-gates`: Runs on `ubuntu-latest`. Runs pnpm 10.34.4 setup, Node 24, frozen lockfile install, `tsc --noEmit` (Web), Vitest unit & integration tests (`pnpm --filter web test`).
   - **Secrets Referenced**: None (uses local docker test fixtures).

2. **`pr-checks.yml` (PR Checks)**:
   - **Triggers**: `pull_request` on `[main, develop]`.
   - **Jobs**:
     - `migration-safety`: Verifies if `schema.prisma` was modified without adding a migration file under `prisma/migrations/`.
     - `dependency-audit`: Runs `pnpm audit --audit-level=high`.
     - `tenant-security-ast`: Runs `pnpm exec tsx scripts/analyze-tenant-security.ts`.
   - **Secrets Referenced**: None.

3. **`production-remediation-ci.yml` (Production Remediation CI)**:
   - **Triggers**: `push` and `pull_request` on `[main, production-rebuild-2026]`.
   - **Jobs**:
     - `verify`: Runs Gitleaks, `prisma generate & validate`, API typecheck, Web typecheck, `check:tenancy`, `check:mock-data`, API unit tests (`pnpm test --runInBand`), Web vitest, API build, Web build, `pnpm audit --audit-level moderate`, and a regex scan for prohibited patterns (`generatePdfStub`, `jest_access_token`, `jest_refresh_token`, unencrypted localStorage persistence).
   - **Secrets Referenced**: `DATABASE_URL: ${{ secrets.DATABASE_URL }}` (set at workflow level).

4. **`deploy.yml` (Deploy JEST API)**:
   - **Triggers**: `push` on `[main, staging]`.
   - **Jobs**:
     - `lint-and-test`: Runs Gitleaks, Node 24, pnpm 10.34.4 with cache, frozen lockfile install, prisma generate, lint (`pnpm turbo run lint --filter=api`), test (`pnpm turbo run test --filter=api`), `scripts/analyze-tenant-security.ts`, `pnpm audit --audit-level=high`, `scripts/verify-certification-validity.js`, and API build.
     - `deploy`: Runs via `appleboy/ssh-action@v1.0.3` to EC2. Resets branch, runs frozen install, prisma generate, prisma migrate deploy, build, and PM2 start/restart.
   - **Secrets Referenced**: `secrets.EC2_HOST`, `secrets.EC2_USERNAME`, `secrets.EC2_SSH_KEY`.

5. **`codeql.yml` (CodeQL Advanced)**:
   - **Triggers**: `push` on `main`, `pull_request` on `main`, weekly schedule cron.
   - **Jobs**: `analyze` for `actions` and `javascript-typescript`. References invalid `actions/checkout@v7`.

**Expected**:  
A unified, non-redundant CI pipeline where PRs to `main` go through a single canonical gate ensuring deterministic linting, typing, tenancy AST analysis, security audits, unit tests, and Playwright E2E verification.  
**Evidence**:  
`Get-ChildItem .github/workflows` output:
```text
Name                          Length LastWriteTime      
----                          ------ -------------      
ci.yml                          6487 15-10-2026 16:11:12
codeql.yml                      4840 23-09-2026 23:13:14
deploy.yml                      3407 15-10-2026 16:13:20
pr-checks.yml                   1925 15-10-2026 16:13:31
production-remediation-ci.yml   2790 15-10-2026 16:11:12
```
Primary CI Gate: `ci.yml` is the primary functional gate, but `pr-checks.yml` and `production-remediation-ci.yml` run parallel, conflicting checks on the same PR events.  
**Impact**:  
Developer confusion, redundant CI resource consumption, and false senses of security when one workflow passes (e.g. `ci.yml` without dependency audit) while another fails (e.g. `pr-checks.yml` with dependency audit).  
**Recommendation**:  
Consolidate `ci.yml`, `pr-checks.yml`, and `production-remediation-ci.yml` into a single canonical pipeline. Deprecate `production-remediation-ci.yml`.

---

### K-02: ESLint `--fix` in CI Pipeline Mutating Source Files — FAIL
**Severity**: P1  
**File**: `apps/api/package.json:19` and `.github/workflows/deploy.yml:57`  
**Observed**:  
In `apps/api/package.json`, the `lint` script is configured with `--fix`:
```json
"lint": "eslint \"src/**/*.ts\" \"test/**/*.ts\" --fix"
```
In `.github/workflows/deploy.yml`, step `Lint` executes:
```yaml
- name: Lint
  run: pnpm turbo run lint --filter=api
```
When this runs in CI, Turborepo invokes `api:lint`, which triggers ESLint with `--fix`. This automatically rewrites source files inside the runner workspace before the code is built and deployed. Furthermore, neither `ci.yml` nor `pr-checks.yml` contains any lint step.  
**Expected**:  
CI workflows must execute lint checks in read-only verification mode (e.g. `eslint "src/**/*.ts" "test/**/*.ts" --max-warnings=0`). Under no circumstance should a CI gate apply mutations to source code, because auto-fixed changes are not committed back to git, causing the deployed build artifact to diverge from the committed git SHA.  
**Evidence**:  
`apps/api/package.json`:
```json
19: "lint": "eslint \"src/**/*.ts\" \"test/**/*.ts\" --fix",
```
`.github/workflows/deploy.yml`:
```yaml
56: - name: Lint
57:   run: pnpm turbo run lint --filter=api
```
**Impact**:  
Code changes occur in CI without developer review, auditability, or git attribution. A silent autofix could alter application behavior or mask syntax inconsistencies, leading to untracked production bugs.  
**Recommendation**:  
1. Change `apps/api/package.json` line 19 to:
   ```json
   "lint": "eslint \"src/**/*.ts\" \"test/**/*.ts\" --max-warnings=0",
   "lint:fix": "eslint \"src/**/*.ts\" \"test/**/*.ts\" --fix"
   ```
2. Add a read-only linting check to the canonical pull request workflow (`ci.yml`).

---

### K-03: Test Isolation — Redundant `runInBand` Invocations — RISK
**Severity**: P3  
**File**: `apps/api/package.json:20` and `.github/workflows/production-remediation-ci.yml:67`  
**Observed**:  
`apps/api/package.json` natively defines:
```json
"test": "jest --runInBand"
```
In `.github/workflows/production-remediation-ci.yml` line 67, the step executes:
```yaml
- name: API unit tests
  working-directory: apps/api
  run: pnpm test --runInBand
```
Because the script already includes `--runInBand`, Jest receives `jest --runInBand --runInBand`.  
In `.github/workflows/ci.yml` lines 78, 90, 102, the commands cleanly execute `pnpm --filter api test`, `test:cert`, and `test:e2e` without passing duplicate CLI flags.  
**Expected**:  
Package scripts should specify standard flags, and workflow invocations should not redundantly repeat arguments already baked into the package scripts.  
**Evidence**:  
`apps/api/package.json`:
```json
20: "test": "jest --runInBand",
22: "test:cov": "jest --coverage --runInBand",
24: "test:e2e": "jest --config ./test/jest-e2e.json --forceExit --runInBand",
```
`.github/workflows/production-remediation-ci.yml`:
```yaml
66: - name: API unit tests
67:   working-directory: apps/api
68:   run: pnpm test --runInBand
```
**Impact**:  
While Jest handles duplicate `--runInBand` flags without throwing an error, passing duplicate CLI parameters indicates lack of workflow synchronization and sloppy configuration.  
**Recommendation**:  
Remove `--runInBand` from line 67 of `production-remediation-ci.yml`, or retire the redundant workflow entirely.

---

### K-04: Playwright Browser E2E Gate Completely Omitted from CI — FAIL
**Severity**: P2  
**File**: `playwright.config.ts:15`, `package.json:12`, `test/e2e/multi-tenant-isolation.spec.ts`  
**Observed**:  
The repository includes a dedicated Playwright test suite for critical multi-tenant browser security: `test/e2e/multi-tenant-isolation.spec.ts`. This suite verifies that unauthenticated workspace and claims routes redirect to login, that logout wipes `jest-auth-storage`, and that browser history navigation back cannot access cached tenant records.  
However:
1. **Zero CI Execution**: Neither `ci.yml`, `pr-checks.yml`, `production-remediation-ci.yml`, nor `deploy.yml` executes `playwright test` or `pnpm test:e2e`. (`ci.yml:102` only runs `pnpm --filter api test:e2e`, which is the NestJS backend Jest integration test).
2. **Missing `webServer` in Configuration**: `playwright.config.ts` sets `baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'`, but defines no `webServer` block to automatically start Next.js or the API in CI. If invoked in CI, it would fail immediately due to connection refused.  
**Expected**:  
Multi-tenant browser isolation tests must run automatically in the CI PR gate against an automated local test instance.  
**Evidence**:  
`package.json`:
```json
12: "test:e2e": "playwright test",
```
`playwright.config.ts`:
```typescript
14:   use: {
15:     baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
16:     trace: 'on-first-retry',
17:     screenshot: 'only-on-failure',
18:   },
```
Workflow search for `playwright` or `test:e2e`:
```text
.github\workflows\ci.yml:102:        run: pnpm --filter api test:e2e
```
(No root Playwright invocation exists in any workflow).  
**Impact**:  
Regressions in browser multi-tenant session isolation, cross-tenant cache leakage, or auth redirection failures will not be detected prior to deployment.  
**Recommendation**:  
1. Add a `webServer` block to `playwright.config.ts` (e.g. running `pnpm --filter web dev` or `pnpm --filter web start`).
2. Add a Playwright E2E step to `ci.yml` under `web-quality-gates` or a separate job with Chromium headless dependencies installed.

---

### K-05: Secret Handling, Fork PR Isolation, and Direct SSH Deployment — RISK
**Severity**: P2  
**File**: `.github/workflows/production-remediation-ci.yml:12-13`, `.github/workflows/deploy.yml:80-86`  
**Observed**:  
1. **Fork PR & Secret Exposure**:
   - `production-remediation-ci.yml` defines `DATABASE_URL: ${{ secrets.DATABASE_URL }}` at workflow root level on both `push` and `pull_request`.
   - On fork PRs, GitHub Actions does not supply repository secrets, resulting in `DATABASE_URL=""`. Consequently, step `Validate Prisma schema` (`prisma validate`) will fail on every fork PR.
   - For internal PRs, passing a live secret `DATABASE_URL` into a CI runner without service container isolation creates risks of accidental data corruption or credential leakage.
2. **Deployment Topology**:
   - `deploy.yml` connects directly to a live EC2 server via `appleboy/ssh-action@v1.0.3` using `secrets.EC2_HOST`, `secrets.EC2_USERNAME`, `secrets.EC2_SSH_KEY`.
   - The deployment executes mutating commands (`git reset --hard`, `pnpm install`, `prisma migrate deploy`, `pm2 restart`) directly on the production host without blue-green staging, canary rollback, or network bastion fencing.
3. **Good Controls Verified**:
   - No workflow uses `pull_request_target`.
   - No workflow uses `actions/upload-artifact` to export artifacts containing secrets.
   - No workflow echoes secrets or sensitive environment variables.  
**Expected**:  
CI workflows running on PRs must use isolated test containers (as done in `ci.yml`). Deployments should rely on containerized image releases (GHCR/ECR) rather than remote git-pull and in-situ compilation on production servers.  
**Evidence**:  
`.github/workflows/production-remediation-ci.yml`:
```yaml
12: env:
13:   DATABASE_URL: ${{ secrets.DATABASE_URL }}
```
`.github/workflows/deploy.yml`:
```yaml
80: - name: Deploy to EC2 via SSH
81:   uses: appleboy/ssh-action@v1.0.3
82:   with:
83:     host: ${{ secrets.EC2_HOST }}
84:     username: ${{ secrets.EC2_USERNAME }}
85:     key: ${{ secrets.EC2_SSH_KEY }}
```
**Impact**:  
Broken fork PR workflows, exposure of environment secrets, and high-risk in-place production deployment outages.  
**Recommendation**:  
1. Remove `secrets.DATABASE_URL` from `production-remediation-ci.yml` and use containerized PostgreSQL as configured in `ci.yml`.
2. Migrate EC2 SSH deployment to GitHub Actions OIDC + AWS SSM / ECS / container deployment pipeline.

---

### K-06: Verification & Governance Script Inventory — FAIL
**Severity**: P1  
**File**: `scripts/check-tenant-scoping.js`, `scripts/check-production-mock-data.js`, `scripts/verify-certification-validity.js`, `scripts/verify-api-contracts.ts`, `certification/RELEASE_CERTIFICATE_PRODUCTION.json`  
**Observed**:  
Analysis of the five key verification scripts revealed major discrepancies:

1. **`check:tenancy` (`scripts/check-tenant-scoping.js`)**:
   - Scope: Only scans NestJS controllers (`.controller.ts`) under `apps/api/src`.
   - Logic: Simple regex scanning for `this.prisma.<entity>.(findMany|findFirst|count|updateMany|deleteMany)` across 14 entity names, checking for presence of `companyId` / `actorCompanyId`.
   - Limitation: It does NOT inspect services or repositories where all actual database logic resides!
   - Note: In contrast, `scripts/analyze-tenant-security.ts` is an AST scanner covering 15 operations and 21 models with exemption validation, but `analyze-tenant-security.ts` is only called in `pr-checks.yml` and `deploy.yml`, not in `ci.yml`.

2. **`check:mock-data` (`scripts/check-production-mock-data.js`)**:
   - Scans production files in `apps/web/src` and `apps/api/src`.
   - Prohibited patterns: `setTimeout` with `Math.random()`, `MOCK_DATA|DEMO_DATA|MOCK_QUOTES|FAKE_LEADS`, `generatePdfStub`, and sensitive `localStorage` keys (`quotation|policy|lead|branch|financial|payment|claim|auth_token`).
   - LocalStorage Exclusion: The Zustand auth store `jest-auth-storage` persists UI identity (`user`, `isAuthenticated`), and removes tokens via `localStorage.removeItem('jest-auth-storage')`. Because the key does not match the restricted list, it passes the check. However, `check-production-mock-data.js` omits the `workflow` pattern that was added to `production-remediation-ci.yml:92`.

3. **`check:certification` (`scripts/verify-certification-validity.js`)**:
   - **CURRENT STATUS: FAILS WITH EXIT CODE 1**.
   - `certification/RELEASE_CERTIFICATE_PRODUCTION.json` contains:
     ```json
     "releaseStatus": "WITHDRAWN",
     "evidenceValidity": "WITHDRAWN",
     "withdrawalReason": "The binding production exit criteria still have G16-G20 and final release sign-off unchecked. This historical certificate is not valid evidence of current production readiness."
     ```
   - Running `node scripts/verify-certification-validity.js` fails with:
     ```text
     ❌ RELEASE BLOCKED: Certificate status is WITHDRAWN, not PRODUCTION_READY.
     ❌ INVALID GATES: Gate records do not match the claimed all-pass certification matrix.
     ❌ INVALID CERTIFICATE: Current HEAD (294cfee2...) and recent ancestors do not match Certified Commit (d7737a28...). Certificate is stale.
     ❌ INVALID SCHEMA: Schema hash mismatch! Schema has mutated without recertification.
     ```
   - Because `deploy.yml:69` runs `node scripts/verify-certification-validity.js`, all deployment runs are currently blocked.

4. **`check:api-contracts` (`scripts/verify-api-contracts.ts`)**:
   - Does NOT compare against OpenAPI or Swagger.
   - It performs source code regex parsing between `apiClient.(get|post|put|patch|delete)` calls in `apps/web` and `@Controller()`, `@Get()`, `@Post()` decorators in `apps/api`.
   - It is never executed in ANY CI workflow.  
**Expected**:  
CI should execute comprehensive AST tenant security analysis (`analyze-tenant-security.ts`), enforce OpenAPI contract validation, and certification must be actively valid before production deployment.  
**Impact**:  
Automated deployments are 100% blocked by the withdrawn certificate. Multi-tenant checks in `ci.yml` provide false assurance because they only check controller files.  
**Recommendation**:  
1. Replace `check:tenancy` in `ci.yml` with `analyze-tenant-security.ts`.
2. Generate and sign an updated `RELEASE_CERTIFICATE_PRODUCTION.json` with current HEAD SHA and schema hash once all gates G16-G20 pass.
3. Integrate `check:api-contracts` into the CI quality gate or migrate to OpenAPI schema comparison.

---

### K-07: Dependency Supply Chain Overrides, CVE Exceptions, and Audit Gate Failures — FAIL
**Severity**: P1  
**File**: `package.json:30-53`, `pnpm-lock.yaml`  
**Observed**:  
1. **15 `pnpm.overrides` Configured**:
   ```json
   "fast-uri": ">=3.1.4",
   "brace-expansion": ">=5.0.9",
   "js-yaml": ">=4.3.2",
   "nanoid": ">=3.3.18",
   "browserslist": ">=4.28.7",
   "multer": ">=2.3.0",
   "undici": ">=7.29.0",
   "ip-address": ">=10.3.1",
   "effect": ">=3.20.0",
   "postcss": ">=8.5.12",
   "vitest": "^3.2.7",
   "sharp": ">=0.35.0",
   "deepmerge-ts": ">=8.0.0",
   "next": ">=16.2.11",
   "joi": ">=18.2.6"
   ```
2. **Undocumented Audit Ignore for `CVE-2026-53571`**:
   `package.json` specifies:
   ```json
   "auditConfig": {
     "ignoreCves": [
       "CVE-2026-53571"
     ]
   }
   ```
   A comprehensive search across the repository returned zero references, documentation, security exception forms, owner sign-offs, or review dates for `CVE-2026-53571`.
3. **Failing Audit Gates in CI**:
   Running `pnpm audit --audit-level=high` reports **63 vulnerabilities** across 1,686 dependencies:
   - **5 Critical**
   - **14 High (1 ignored: CVE-2026-53571)**
   - **41 Moderate**
   - **3 Low**
   Unresolved high/critical issues include:
   - `GHSA-cjq9-62q9-8jv4` (Next.js SSRF in Image Optimization, requires Next >=16.3.8)
   - `CVE-2026-96889` / `GHSA-wq5f-xc86-pv6w` (sharp librsvg vulnerability, requires sharp >=0.35.5)
   - `GHSA-6qxp-vccf-f47h` (MCP SDK OAuth client credential vulnerability)
   - `GHSA-68fv-2mgg-jv7q` (source-map-js vulnerability)
   Because `pr-checks.yml:40` and `deploy.yml:66` run `pnpm audit --audit-level=high`, CI jobs executing this step fail immediately.  
**Expected**:  
1. All ignored CVEs must be accompanied by an approved risk acceptance record with an assigned owner, compensating controls, and expiration date.
2. High and critical dependencies must be patched to ensure clean audit gate execution.  
**Evidence**:  
Command output of `pnpm audit --audit-level=high`:
```text
63 vulnerabilities found
Severity: 3 low | 41 moderate | 14 high (1 ignored) | 5 critical
```
Search output for `CVE-2026-53571`:
```text
package.json:        "CVE-2026-53571"
(No documentation or risk acceptance file exists).
```
**Impact**:  
High and Critical vulnerabilities exist in production dependencies; CI gates in `pr-checks.yml` and `deploy.yml` fail.  
**Recommendation**:  
1. Update `package.json` overrides:
   - `"next": ">=16.3.8"`
   - `"sharp": ">=0.35.5"`
2. Document `CVE-2026-53571` in `docs/security/risk-decisions/CVE-2026-53571.md` with owner, justification, and quarterly review date, or remove the ignore if no longer applicable.

---

### K-08: Lockfile Integrity & Reproducible Builds — PASS
**Severity**: PASS  
**File**: `pnpm-lock.yaml`, `.github/workflows/ci.yml:58,170`, `.github/workflows/deploy.yml:51,96`, `.github/workflows/pr-checks.yml:56`, `.github/workflows/production-remediation-ci.yml:41`  
**Observed**:  
- `pnpm-lock.yaml` is tracked in git (`git ls-files pnpm-lock.yaml` returns `pnpm-lock.yaml`).
- All GitHub Actions workflows enforce `pnpm install --frozen-lockfile`.
- Pnpm version is explicitly pinned across all workflows and `package.json` to `10.34.4`.  
**Expected**:  
Lockfile committed and frozen lockfile strictly required in CI to ensure reproducible builds.  
**Evidence**:  
`git ls-files pnpm-lock.yaml`:
```text
pnpm-lock.yaml
```
Workflow inspection confirmed `--frozen-lockfile` in every install step.  
**Impact**:  
No risk of non-deterministic package resolution or upstream silent updates.  
**Recommendation**:  
Maintain current practice.

---

### K-09: Node.js Runtime Version Consistency — RISK
**Severity**: P3  
**File**: `.nvmrc`, `.node-version`, `package.json`, `apps/api/package.json`, `apps/web/package.json`, `.github/workflows/*.yml`  
**Observed**:  
- `.nvmrc` specifies `24.18.0`.
- `.node-version` specifies `24`.
- All GitHub Actions workflows configure `node-version: '24'`.
- Root `package.json`, `apps/api/package.json`, and `apps/web/package.json` **lack an `engines` field**.
- There is no `.npmrc` enforcing `engine-strict=true`.  
**Expected**:  
Exact version parity between `.nvmrc`, `.node-version`, package `engines`, and CI runners.  
**Evidence**:  
`.nvmrc`: `24.18.0`  
`.node-version`: `24`  
`package.json`: lacks `"engines"` definition.  
**Impact**:  
Developers using older Node versions (e.g. Node 18 or 20) locally may introduce incompatible code or dependency lockfile shifts that only fail when pushed to CI.  
**Recommendation**:  
1. Set `"engines": { "node": ">=24.18.0 <25.0.0", "pnpm": ">=10.34.4" }` in root `package.json`, `apps/api/package.json`, and `apps/web/package.json`.
2. Add `engine-strict=true` to `.npmrc`.
3. Standardize `.node-version` to `24.18.0`.

---

### K-10: Cold-Deployment PM2 Crash & Broken CodeQL Action Version — FAIL
**Severity**: P1  
**File**: `.github/workflows/deploy.yml:102` and `.github/workflows/codeql.yml:60`  
**Observed**:  
Two severe syntax and configuration defects were identified in workflow files:
1. **Missing Root `start` Script in `deploy.yml`**:
   In `deploy.yml` line 102:
   ```bash
   pm2 restart all || pm2 start pnpm --name "jest-app" -- run start
   ```
   If PM2 is not already running (first deployment, reboot, or cleared daemon), it executes `pnpm run start` from the repository root. Running `pnpm run start` from root fails immediately with:
   ```text
   ERR_PNPM_NO_SCRIPT_OR_SERVER Missing script start or file server.js
   ```
   Root `package.json` has `build`, `test`, `lint`, `dev`, but NO `start` script! The actual start script is `pnpm --filter api run start:prod`.
2. **Non-Existent Action Version in `codeql.yml`**:
   In `codeql.yml` line 60:
   ```yaml
   - name: Checkout repository
     uses: actions/checkout@v7
   ```
   Official `actions/checkout` only exists up to `v4`. GitHub Actions runner will immediately fail the workflow with `Unable to resolve action actions/checkout@v7`.  
**Expected**:  
All workflow actions must reference valid releases, and deployment commands must reference valid package scripts.  
**Evidence**:  
Root execution of `pnpm run start`:
```text
ERR_PNPM_NO_SCRIPT_OR_SERVER  Missing script start or file server.js
```
`codeql.yml`:
```yaml
60: uses: actions/checkout@v7
```
**Impact**:  
Deployments crash on fresh server deployments; CodeQL security analysis fails to run.  
**Recommendation**:  
1. In `deploy.yml`, change line 102 to:
   ```bash
   pm2 restart all || pm2 start pnpm --name "jest-app" -- --filter api run start:prod
   ```
2. In `codeql.yml`, change line 60 to:
   ```yaml
   uses: actions/checkout@v4
   ```

---

## Domain K Summary Matrix

| ID | Title | Status | Severity | Primary File |
|---|---|---|---|---|
| K-01 | GitHub Actions Workflow Inventory | RISK | P2 | `.github/workflows/*.yml` |
| K-02 | ESLint `--fix` in CI Pipeline | FAIL | P1 | `apps/api/package.json:19`, `deploy.yml:57` |
| K-03 | Test Isolation: Redundant `--runInBand` | RISK | P3 | `production-remediation-ci.yml:67` |
| K-04 | Playwright Browser E2E Gate Omitted | FAIL | P2 | `playwright.config.ts`, `package.json:12` |
| K-05 | Secret Handling & Deployment Topology | RISK | P2 | `production-remediation-ci.yml:12`, `deploy.yml:80` |
| K-06 | Verification & Governance Scripts (Cert WITHDRAWN) | FAIL | P1 | `scripts/*`, `RELEASE_CERTIFICATE_PRODUCTION.json` |
| K-07 | Dependency Overrides & Unpatched Supply Chain CVEs | FAIL | P1 | `package.json:30-53` |
| K-08 | Lockfile Integrity & Frozen Lockfile | PASS | Pass | `pnpm-lock.yaml`, all workflows |
| K-09 | Node.js Runtime Version Consistency | RISK | P3 | `.nvmrc`, `package.json` |
| K-10 | PM2 Startup Crash & Broken CodeQL Action Version | FAIL | P1 | `deploy.yml:102`, `codeql.yml:60` |
