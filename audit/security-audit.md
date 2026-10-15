# JEST Policy CRM — Security, Authorization & Tenancy Audit

**Audit Date:** October 15, 2026  
**Auditor Roles:** Senior Application Security Engineer, Penetration Tester, Cloud Security Architect  
**Scope:** Whole-repository security evaluation against OWASP Top 10 (2021/2026), Multi-Tenant Isolation, and RBAC Boundaries  
**Security Posture Verdict:** **SIGNIFICANT HARDENING VERIFIED; CRITICAL DEFECTS IN WEBHOOKS, REDIS & CLAIMS REMAIN OPEN**  

---

## 1. Multi-Tenant Isolation & Canonical Security Model

### 1.1 Canonical Tenancy Architecture
The codebase enforces the fundamental tenancy invariant:
```text
SYSTEM
└── Company A (Tenant A)
    ├── Branch A1
    └── Branch A2
└── Company B (Tenant B)
    └── Branch B1
```
- **ADMIN Role Policy:** An authenticated user with `role === ADMIN` is strictly bounded to their assigned `companyId`. **ADMIN never implies global platform-wide access.**
- **PostgreSQL Composite Referential Integrity:** Migration `20260924000001_cross_tenant_composite_fks` established composite unique keys and composite foreign keys:
  - `leads(companyId, contactId)` $\to$ `contacts(companyId, id)`
  - `quotations(companyId, contactId)` $\to$ `contacts(companyId, id)`
  - `quotations(companyId, leadId)` $\to$ `leads(companyId, id)`
  - `policies(companyId, quotationId)` $\to$ `quotations(companyId, id)`
  It is physically impossible at the PostgreSQL storage engine level to attach a Quotation or Policy of Company A to a Contact or Lead of Company B.

### 1.2 Remediated Attack Surface (Round 2 Audit Verification)
All 15 vulnerabilities identified in Round 2 Adversarial Testing were verified as remediated via `test/security/round2-adversarial-audit.spec.ts` (18/18 tests passed):
- **Global Search Service (R2-001):** Mandatory `companyId` enforced in `SearchService.search`. Cross-tenant PII enumeration is blocked.
- **Reporting Pipeline (R2-002 & R2-006):** Fail-closed tenant scoping enforced across all 6 warehouse methods in `WarehouseService`.
- **Customer & Agent Scoping (R2-003, R2-004, R2-008, R2-010):** Enforced base filter `{ companyId, deletedAt: null }` across `findAll` and `findById` for all roles. Removed arbitrary fallback.
- **Customer 360 (R2-005):** Scoped all nested sub-resources (policies, quotes, claims, leads, documents) by `companyId` and `agentId`.
- **Document Verification (R2-007 & R2-009):** Agents are strictly prohibited from reviewing or verifying documents. Cross-company verification rejected.
- **Endorsement Financial Floor (R2-014):** Underwriting floor of ₹100 enforced. Authoritative server-side pro-rata recalculation prevents tampering.
- **Renewal Engine Context (R2-015):** Neutralized synthetic actor context bypass. Bounded all renewal queries to `companyId`.

---

## 2. Confirmed Vulnerabilities & Active Security Defect Register

### 2.1 DEF-001: Unauthenticated Host-Published Redis (Severity: CRITICAL)
- **Location:** `docker-compose.yml:29`, `infrastructure/docker/docker-compose.yml:33`
- **Vulnerability:** Both Compose manifests publish Redis port `6380:6379` to the host without password or ACL configuration (`command: redis-server --appendonly yes`).
- **Exploitation:** Any process or client on the host network can connect to Redis, inspect cached customer profile keys (`customer360:*`), poison session tokens, or publish forged BullMQ jobs.
- **Remediation:** Remove host port publication where unnecessary. Bind strictly to loopback and configure `requirepass` or ACLs in both Docker Compose files and application configuration.

### 2.2 DEF-003: Claims Terminal State Financial Manipulation (Severity: CRITICAL)
- **Location:** `apps/api/src/modules/claims/controllers/claims.controller.ts:115`
- **Vulnerability:** The generic `PATCH /api/v1/claims/:id` endpoint accepts an `UpdateClaimDto` with `approvedAmount`, `surveyorName`, and `surveyorDetails`. It directly executes `prisma.claim.update` without validating against `ClaimStateMachine`.
- **Exploitation:** An authenticated Back Office or Admin user can arbitrarily modify the `approvedAmount` on a claim that has already reached `SETTLED` or `CLOSED` status, creating discrepancies between claims records and the financial general ledger.
- **Remediation:** Remove direct field mutations. Route all claim updates through a domain command that verifies the claim is in a non-terminal state and records audit history.

### 2.3 DEF-004: Unauthenticated Webhook Provider Event Injection (Severity: CRITICAL)
- **Location:** `apps/api/src/modules/platform/integrations/webhooks/controllers/webhook-gateway/webhook-gateway.controller.ts:160`
- **Vulnerability:** The webhook gateway is `@Public()` and handles `POST /api/v1/webhooks/:provider`. The `validateSignature` method only evaluates signatures when `provider === 'razorpay'`. For any other provider string (e.g., `/webhooks/twilio` or `/webhooks/custom`), the function returns without error, accepts the payload, records an idempotency key, and emits domain events onto the event bus.
- **Exploitation:** An unauthenticated external attacker can inject arbitrary provider events into internal asynchronous queues.
- **Remediation:** Implement an explicit allow-list of configured providers and enforce signature verification on every incoming request. Reject unknown providers with 401 Unauthorized.

### 2.4 DEF-015: Claims Repository Unscoped Read Before Authorization (Severity: MEDIUM)
- **Location:** `apps/api/src/modules/claims/repositories/claim.repository.ts:42`
- **Vulnerability:** `claimRepository.findById` executes a database lookup using only `{ id, deletedAt: null }` and hydrates sensitive related PII (policy, contact, account, documents, communications) into memory before `ResourceAuthorizationService` executes tenant matching in the controller.
- **Exploitation:** While the controller correctly returns 403 Forbidden to unauthorized callers, the application server materializes sensitive cross-tenant PII in memory, creating a potential timing oracle.
- **Remediation:** Push `companyId` into the repository query predicate: `where: { id, companyId, deletedAt: null }`.

---

## 3. OWASP Top 10 (2021/2026) Compliance Evaluation

| OWASP Risk Category | Evaluation against JEST CRM Architecture | Result |
| :--- | :--- | :--- |
| **A01: Broken Access Control** | RolesGuard fail-closed; companyId scoping enforced; R2 findings remediated; generic claim PATCH open (DEF-003) | **FAIL (DEF-003)** |
| **A02: Cryptographic Failures** | AES-256-GCM PII encryption with mandatory 32-char key; HTTPS enforced; Redis unauthenticated (DEF-001) | **FAIL (DEF-001)** |
| **A03: Injection** | Parameterized Prisma queries; CSV sanitizer strips formula prefixes; raw SQL queries avoided | **PASS** |
| **A04: Insecure Design** | Separation of duties between Agent and Back Office; state machines protect quotes/policies; webhook unverified (DEF-004) | **FAIL (DEF-004)** |
| **A05: Security Misconfiguration** | Strict Zod environment schema prevents weak credentials; Redis port published without password | **FAIL (DEF-001)** |
| **A06: Vulnerable Components** | `pnpm audit` shows 0 high/critical vulnerabilities; dependencies pinned | **PASS** |
| **A07: Identification & Auth** | JWT access tokens (15m) + refresh token rotation (7d); bcrypt password hashing | **PASS** |
| **A08: Software & Data Integrity** | Webhooks lack universal signature enforcement; outbox pattern ensures transaction/event consistency | **FAIL (DEF-004)** |
| **A09: Security Logging & Monitoring** | Immutable `AuditLog` table records state transitions; Prometheus metrics endpoint operational | **PASS** |
| **A10: Server-Side Request Forgery** | `IntegrationHttpService` validates outbound URLs against provider registry; direct user URLs disallowed | **PASS** |
