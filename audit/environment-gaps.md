# JEST Policy CRM — Environment, Credentials & Operational Gaps

**Audit Date:** October 15, 2026  
**Auditor Roles:** Principal SRE, Cloud Infrastructure Architect, DevOps Specialist  
**Disposition:** **LOCAL TESTING OPERATIONAL; STAGING & PRODUCTION GAPS CONFIRMED**  

---

## 1. Unavailable External Credentials & Third-Party Dependencies

The audit was executed entirely within a local developer environment. The following external production systems and cloud accounts were not provided and remain **UNVERIFIED**:

| External Integration | Target System | Local Test State | Production Status / Gap |
| :--- | :--- | :--- | :--- |
| **Razorpay Payment Gateway** | `api.razorpay.com` | Sandbox HMAC simulated | Live payment capture, refunds, and bank webhook callbacks unverified |
| **MinIO / AWS S3** | Cloud Object Storage | Local filesystem / Mock MinIO | Bucket versioning, IAM role restrictions, and lifecycle retention policies unverified |
| **Twilio SMS Gateway** | `api.twilio.com` | Notification worker mocked | Outbound SMS delivery, DND filtering, and delivery receipts unverified |
| **Corporate SMTP Server** | Transactional Mail Relay | Local Mailhog | Outbound email deliverability, SPF/DKIM records, and bounce tracking unverified |
| **Insurer B2B Gateways** | Insurer Rating APIs | IRDAI Tariff Rule Engine | Direct insurer API quote fetching and policy submission unverified |
| **Dedicated E2E DB** | PostgreSQL E2E DB | Local dev database on 5432 | `E2E_DATABASE_URL` not configured; `test:inspection:db` test skipped |

---

## 2. Infrastructure & Deployment Gaps

### 2.1 Release Governance & Certification Hash Mismatch (DEF-002)
- Running `pnpm run check:certification` reports:
  `❌ RELEASE BLOCKED: Certificate status is WITHDRAWN, not PRODUCTION_READY.`
  `❌ INVALID SCHEMA: Schema hash mismatch! Schema has mutated without recertification.`
- The project's formal exit criteria (G16 through G20 in `docs/PRODUCTION_EXIT_CRITERIA.md`) remain unchecked:
  - Staging deployment smoke tests
  - Production database migration dry-run and upgrade rehearsal
  - 16-persona User Acceptance Testing (UAT)
  - Backup and restore drill verification
  - Rollback procedure testing
  - Operations runbook verification

### 2.2 Unauthenticated Redis Host Exposure (DEF-001)
- `docker-compose.yml:29` and `infrastructure/docker/docker-compose.yml:33` publish Redis port `6380:6379` to the host network without requiring password authentication or an ACL.
- While the host port is bound to `127.0.0.1`, any process on the Docker host can access cache and queue data.

### 2.3 Automated Deployment Script Lacks Health Verification & Rollback (JEST-AUDIT-0003)
- In `.github/workflows/deploy.yml`, deployments execute via an SSH script that performs `git reset --hard`, applies Prisma migrations, and restarts PM2 (`pm2 restart all`).
- The workflow lacks:
  - Pre-deployment backup verification
  - Post-deployment HTTP readiness probe or smoke test
  - Automated rollback trigger upon migration or startup failure
  - GitHub Environment protection and manual sign-off gate

### 2.4 Node.js Runtime Version Inconsistency (DEF-012)
- `.github/workflows/ci.yml` runs on **Node.js 20**.
- `.github/workflows/deploy.yml` and `.github/workflows/production-remediation-ci.yml` run on **Node.js 24**.
- `apps/api/Dockerfile` uses `node:20-alpine`.
- *Risk:* Dependencies or native modules compiled and tested under Node 20 in CI may experience subtle runtime regressions when executed under Node 24 in production.

### 2.5 Backup and Disaster Recovery (DR) Rehearsal Gap
- While `docs/DEPLOYMENT_GUIDE.md` documents manual `pg_dump` and `pg_restore` commands, no scheduled automated backup script or verified recovery drill has been executed or audited against a realistic data volume.
