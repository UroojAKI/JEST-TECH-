# Domain C+D+E — Authentication, Authorization, API Security Audit

**Target System**: JEST Policy CRM (`apps/api`)  
**Audit Commit**: `5a0f8b8cb7a62e2662682490681d1dd24662834f`  
**Auditor**: Antigravity Security Audit Agent  
**Date**: October 19, 2026  
**Status**: CONDITIONAL PASS (1 High / P1 defect requiring remediation before general release; 2 Medium / P2 defects)

---

## Executive Summary

A comprehensive source-level and architectural security audit was conducted covering **Domain C (Authentication & Session Security)**, **Domain D (Authorization, RBAC & Cross-Tenant Isolation)**, and **Domain E (API Security, Validation & Integration Controls)** for the JEST Policy CRM backend.

The platform exhibits an exceptionally mature defensive posture in core enterprise domains:
1. **Robust Authentication Architecture**: Argon2id password hashing, strict timing-safe constant-time error responses, fail-closed JWT configuration validation (`env.schema.ts` and `main.ts`), session invalidation via DB-backed `authVersion`, SHA-256 indexed refresh token storage, and proactive refresh token replay detection with immediate multi-session termination.
2. **Fail-Closed RBAC & Guard Coverage**: Universal application of `@UseGuards(JwtAuthGuard, RolesGuard)` across 55+ controllers. Zero unauthenticated business routes. Public endpoints are strictly restricted to login, refresh, health check, and signature-verified webhooks.
3. **Hardened API Gateway & Mass Assignment Defense**: Global `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true`, global `CustomThrottlerGuard` with route-level throttles on auth endpoints, Helmet security headers, and an immaculate `GlobalExceptionFilter` suppressing stack traces and internal Prisma errors.
4. **Authoritative Certification Suite**: All **17 security & certification test suites (252 individual tests)** pass without regression (`pnpm --filter api run test:cert`).

However, **one critical tenant isolation vulnerability (P1)** was identified:
- **`SEC-CDE-01`**: `DashboardAnalyticsController` (`apps/api/src/modules/bi/dashboards/services/dashboard-analytics/dashboard-analytics.controller.ts`) omits `req.user.companyId` when invoking `DashboardAnalyticsService`. Specifically, `getRenewalMetrics()` aggregates policy renewal metrics (`expiring30d`, `renewed`, `lapsed`) across **the entire database without tenant scoping**, leaking aggregate policy metrics across distinct tenant organizations.

---

## C.1 Authentication System

### C.1.1 Authentication Flows
The authentication domain is implemented under `apps/api/src/modules/auth/` and `apps/api/src/modules/users/`:

1. **Login Flow (`POST /api/v1/auth/login`)**:
   - **Endpoint & Rate Limiting**: Decorated with `@Public()` and `@Throttle({ default: { ttl: 60000, limit: 20 } })` (20 attempts per minute).
   - **Timing-Safe Constant-Time Rejection**: A unified error message `UnauthorizedException('Invalid email or password')` is returned for all failure modes (user not found, lockout triggered, password mismatch, or inactive status). This prevents user enumeration and account-state discovery.
   - **Account Lockout Control**: Queries `prisma.auditLog` for failed logins (`action: LOGIN, module: 'AUTH_FAILED'`) within a 15-minute sliding window. If >= 5 failures occur, the request is rejected immediately.
   - **Password Verification**: Evaluated via `argon2.verify(user.passwordHash, dto.password)` before status checks to eliminate timing differences.
   - **Token Generation**: Generates an Access Token and a Refresh Token using `TokenService`.
   - **Refresh Token Storage**: Hashes the refresh token using SHA-256 before inserting it into the `RefreshToken` table. This avoids O(N) CPU-exhaustion DoS during token lookup compared to legacy Argon2 hashing.
   - **Cookie Transport**: Auth tokens are stored in `HttpOnly`, `SameSite=lax` cookies. Access and refresh tokens are **deliberately withheld from response JSON bodies**, eliminating XSS credential harvesting from browser memory.
   - **CSRF Token Generation**: Issues a cryptographically random 32-byte hex token in a client-readable `csrf_token` cookie for double-submit verification.

2. **Refresh Flow (`POST /api/v1/auth/refresh`)**:
   - **Endpoint & Rate Limiting**: Decorated with `@Public()` and `@Throttle({ default: { ttl: 60000, limit: 30 } })`.
   - **Replay Attack Detection (SEC-010)**: Looks up tokens by SHA-256 hash across all tokens including revoked records. If a token record is found with `revokedAt !== null`, a replay attack is flagged. The system executes an atomic transaction that:
     1. Revokes all active refresh tokens for the user (`revokedAt = new Date()`).
     2. Increments `user.authVersion`, instantly invalidating any outstanding JWT access tokens.
     3. Emits an audit log entry (`AuditAction.LOGIN, metadata: { reason: 'REFRESH_TOKEN_REPLAY_DETECTED' }`).
     4. Throws `UnauthorizedException('Security alert: Refresh token replay detected. All sessions terminated.')`.
   - **Atomic Token Rotation**: Revokes the current token and inserts a newly minted refresh token within a single `prisma.$transaction`, mitigating concurrent race conditions.

3. **Logout Flow (`POST /api/v1/auth/logout`)**:
   - **Endpoint & Rate Limiting**: `@Throttle({ default: { ttl: 60000, limit: 30 } })`. Does not require `@UseGuards(JwtAuthGuard)` to ensure clients with expired access tokens can cleanly terminate sessions.
   - **Token Invalidation**: Resolves user identity via `req.user`, `refresh_token` hash, or bearer header; calls `usersService.revokeAllUserRefreshTokens()` and increments `user.authVersion`.
   - **Cookie Purge**: Explicitly clears `access_token`, `refresh_token`, and `csrf_token` with `path: '/'`.

4. **Password Reset Flows**:
   - **Self-Service (`POST /api/v1/users/change-password`)**: Decorated with `@AnyAuthenticatedRole()`. Requires `currentPassword` (verified via `argon2.verify`), enforces `newPassword.length >= 6`, hashes the new password with Argon2, revokes all user refresh tokens, and increments `user.authVersion`.
   - **Administrator Reset (`POST /api/v1/users/:id/reset-password`)**: Decorated with `@Roles(RoleType.ADMIN)`. Enforces tenant boundary (`findById` verifies `actor.companyId === user.companyId`). Generates a 32-character random alphanumeric password or applies the provided one, hashes via Argon2, revokes all user refresh tokens, and increments `user.authVersion`.

### C.1.2 Seed Accounts & Default Credentials
- **File**: `apps/api/prisma/seed.ts`
- **Observed**: The seeding script defines 15 canonical persona accounts (`superadmin@jest.com`, `admin@jest.com`, `manager@jest.com`, `agent@jest.com`, `underwriter@jest.com`, `claims@jest.com`, `finance@jest.com`, etc.) with a hardcoded password: `Password@123`.
- **Production Gate (`AUTH-004`)**: Line 9 enforces a fail-closed startup check:
  ```typescript
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_PRODUCTION_SEED) {
    throw new Error('FATAL: Seed execution prohibited in production environment (AUTH-004).');
  }
```
- **Release Decision**: The production guard is effective. However, operations must ensure that development/staging database snapshots are never restored directly to production without running a credential purge script.

---

## C.2 Password & Session Security

### C.2.1 Password Hashing Scheme
- **Algorithm**: Argon2id (`argon2` npm package v0.44.0).
- **Evaluation**: Argon2id is the OWASP and NIST gold standard password hashing function, combining high resistance to side-channel cache attacks with memory-hardness against GPU/ASIC cracking.

### C.2.2 Session Cookie Configuration
- **Settings** (`auth.controller.ts:94-125`):
  | Cookie | `HttpOnly` | `Secure` | `SameSite` | `MaxAge` | `Path` |
  |---|---|---|---|---|---|
  | `access_token` | `true` | `isSecure` | `lax` | 15 minutes (`900,000ms`) | `/` |
  | `refresh_token` | `true` | `isSecure` | `lax` | 30 days (`2,592,000,000ms`) | `/` |
  | `csrf_token` | `false` | `isSecure` | `lax` | 15 minutes (`900,000ms`) | `/` |

- **Secure Flag Evaluation**:
  ```typescript
  const isSecure = process.env.NODE_ENV === 'production' && process.env.SECURE_COOKIES !== 'false';
  ```
  In production, cookies are transmitted strictly over TLS. Setting `sameSite: 'lax'` prevents cross-site POST/state-changing requests from sending session cookies, providing native CSRF defense in modern browsers.

### C.2.3 Token Security & Expiry
- **Access Token Expiry**: Configured via `JWT_EXPIRES_IN`, defaulting to `15m` (meeting the enterprise standard of `< 30 minutes`).
- **Refresh Token Expiry Discrepancy**:
  - `env.schema.ts:47` defines `JWT_REFRESH_EXPIRES_IN` default as `7d`.
  - `auth.service.ts:203, 345` fall back to `30d`.
  - `auth.controller.ts:113` hardcodes cookie `maxAge` to 30 days.
  - *Recommendation*: Harmonize the refresh token lifetime to 7 days across the schema, service, and cookie headers.
- **Revocation Mechanisms**:
  1. Refresh tokens are tracked in the database and explicitly marked `revokedAt`.
  2. Access tokens are invalidated immediately upon status change, role change, logout, or password reset via the DB-backed `authVersion` check on every incoming request in `JwtStrategy`.

### C.2.4 JWT Signing Secret Entropy
- **Validation**: Enforced at startup by `main.ts:validateJwtSecrets()` and `env.schema.ts:60-107`.
  - Requires `JWT_SECRET.length >= 32` characters.
  - Requires `JWT_REFRESH_SECRET.length >= 32` characters.
  - Prohibits known placeholder strings (`super-secret`, `changeme`, `dummy`, `your-secret`, etc.).
  - Prohibits `JWT_SECRET === JWT_REFRESH_SECRET`.
  - Application crashes on startup (`throw new Error(...)`) if weak secrets are detected in production.

---

## D.1 RBAC & Guard Coverage

### D.1.1 Guard Architecture
The API employs a multi-tiered guard framework:
1. **`JwtAuthGuard` (`apps/api/src/modules/auth/guards/jwt-auth.guard.ts`)**:
   - Respects `@Public()`.
   - Delegates session authentication to Passport (`jwt` strategy).
   - Validates CSRF double-submit token on state-mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`).
   - Verifies `payload.authVersion` against `AuthorizationVersionService`.
2. **`RolesGuard` (`apps/api/src/modules/auth/guards/roles.guard.ts`)**:
   - **Fail-Closed by Design**: If an endpoint has `RolesGuard` but neither `@Roles(...)` nor `@AnyAuthenticatedRole()`, it immediately throws:
     `ForbiddenException('This endpoint does not declare required roles. Apply @Roles(...) or @AnyAuthenticatedRole() explicitly.')`
   - **Role Matching**: Strictly matches user roles against declared allowed roles.
   - **Administrator Bypass**: `RoleType.ADMIN` serves as the system administrative role.
3. **`PermissionsGuard` (`apps/api/src/modules/auth/guards/permissions.guard.ts`)**:
   - Supports granular, permission-based RBAC (used in `ReportsController`).
   - Normalizes and verifies permission codes and operational aliases (e.g., `REPORT_VIEW` <-> `report:read`).

### D.1.2 Controller Audit (5 Random Controllers + Full Scan)
Every controller across `apps/api/src` was examined:

1. **`ClaimsController` (`apps/api/src/modules/claims/controllers/claims.controller.ts`)**:
   - Class-level: `@UseGuards(JwtAuthGuard, RolesGuard)`
   - Methods: All 12 endpoints declare explicit `@Roles(...)`. Operations like `report`, `assign-surveyor`, `approve`, `settle` require `[ADMIN, BACK_OFFICE]`. Read and document upload routes allow `[ADMIN, BACK_OFFICE, AGENT]`.
2. **`PoliciesController` (`apps/api/src/modules/policies/controllers/policies.controller.ts`)**:
   - Class-level: `@UseGuards(JwtAuthGuard, RolesGuard)`
   - Methods: All 15 endpoints declare explicit `@Roles(...)`. Underwriting and cancellation routes require `[ADMIN, BACK_OFFICE]`. Direct issuance enforces issuance gates.
3. **`ContactsController` (`apps/api/src/modules/contacts/controllers/contacts.controller.ts`)**:
   - Class-level: `@UseGuards(JwtAuthGuard, RolesGuard)`
   - Methods: All 8 endpoints declare explicit `@Roles(...)`. PII unmasking (`POST /contacts/:id/unmask`) strictly requires `[ADMIN, BACK_OFFICE]`. Contact deletion requires `ADMIN`.
4. **`MotorCalculationController` (`apps/api/src/modules/motor/controllers/motor-calculation.controller.ts`)**:
   - Class-level: `@UseGuards(JwtAuthGuard, RolesGuard)`
   - Methods: Standard quote calculation allows `[ADMIN, BACK_OFFICE, AGENT]`. Tax and tariff override route (`POST /motor/calculate/override`) is strictly restricted to `[ADMIN, BACK_OFFICE]`. Agents receive 403 Forbidden.
5. **`CustomersController` (`apps/api/src/modules/customers/customers.controller.ts`)**:
   - Class-level: `@UseGuards(JwtAuthGuard, RolesGuard)`
   - Methods: All 10 endpoints declare explicit `@Roles(...)`. Primary agent assignment (`POST /customers/:id/assign-agent`) requires `[ADMIN, BACK_OFFICE]`.

**Full Scan Results**:
- Over 55 controllers were inspected.
- Only 4 endpoints in the entire API are publicly accessible, each with justified purpose:
  - `POST /api/v1/auth/login` (`@Public()`)
  - `POST /api/v1/auth/refresh` (`@Public()`)
  - `GET /api/v1/health` (`@Public()`, Terminus health check)
  - `POST /api/v1/webhooks/:provider` (`@Public()`, verifies cryptographic HMAC SHA-256 signature)
- `GET /api/v1/` (`AppController`) is unauthenticated and returns basic application metadata (`{ app: 'JEST Policy CRM API', version: '1.0' }`).
- `GET /api/v1/metrics` (`MetricsController`) is protected by `MetricsAuthGuard` requiring a scrape token or Admin JWT.

### D.1.3 Adversarial Test Paths
1. **Can a user change their own role via `PATCH /api/v1/users/:id`?**
   - **Result: NO (Blocked)**.
   - `users.controller.ts:118` restricts `PATCH /users/:id` to `@Roles(RoleType.ADMIN)`. Non-admin users receive 403 Forbidden.
   - For administrators, `usersService.findById(id, actor)` verifies that the target user belongs to the administrator's company (`actorCompanyId === user.companyId`).
2. **Is `companyId` in the JWT payload or derived server-side?**
   - **Result: Authoritatively Derived Server-Side**.
   - During login, `organizationId` is derived from the user's active database record (`requireOrganization(user)`).
   - On every request, `JwtStrategy.validate()` performs an authoritative lookup in `prisma.user` and extracts `companyId = user.companyId || user.branch?.zone?.region?.company?.id`.
3. **Is `companyId` from request bodies ever trusted for tenant scoping?**
   - **Result: NO (Validated or Overridden)**.
   - In `LeadsService.create()` and `UsersService.create()`, if a client supplies `dto.companyId` that differs from the authenticated actor's company, a `ForbiddenException('Cross-organization ... is strictly prohibited')` is thrown.

---

## D.2 Cross-Tenant Isolation (CRITICAL)

### D.2.1 Global Search Module (`apps/api/src/modules/platform/search/`)
- **Controller**: `SearchController.search()` extracts `companyId = user.companyId || user.organizationId`.
- **Service**: `SearchService.search(query, companyId)`:
  - Line 27: Enforces fail-closed validation:
    ```typescript
    if (!companyId) {
      throw new ForbiddenException('Tenant context is required for search');
    }
    ```
  - **Query Tracing**:
    - `contact.findMany`: `where: { companyId, deletedAt: null, ... }` — **PASS**
    - `lead.findMany`: `where: { companyId, deletedAt: null, ... }` — **PASS**
    - `policy.findMany`: `where: { companyId, deletedAt: null, ... }` — **PASS**
    - `claim.findMany`: `where: { companyId, deletedAt: null, ... }` — **PASS**
    - `proposal.findMany`: `where: { quotation: { companyId }, ... }` — **PASS**

### D.2.2 Business Intelligence Module (`apps/api/src/modules/business-intelligence/`)
- **Controller**: `BiController` implements `getActorCompanyId(user)` which throws `ForbiddenException('Tenant organizational context is required')` if missing.
- **Service**: `BiService`:
  - `getConversionMetrics(companyId)`: Scopes leads, proposals, and policies to `companyWhere` or `{ quotation: { companyId } }`.
  - `getRevenueMetrics(companyId)`: Scopes `policyPayment` to `{ policy: { companyId } }` and `motorPaymentRecord` to `{ quotation: { companyId } }`.
  - `getLossRatioMetrics(companyId)`: Scopes claims to `companyId` and payments to `{ policy: { companyId } }`.
  - `getRenewalMetrics(companyId)`: Scopes policies to `companyId` and renewals to `{ policy: { companyId } }`.
  - `getSalesMetrics(companyId)`: Scopes policies to `companyId`.
  - `getGrowthMetrics(companyId)`: Scopes policies, contacts, and leads to `companyId`.
  - `getKpiValues(companyId)`: Scoped metrics registry passed to formula engine.
- **KPI Management**: `updateKpi()` and `deleteKpi()` verify `kpi.createdBy.companyId === companyId`, preventing cross-tenant modifications.

### D.2.3 Dashboard Analytics BI Module (`apps/api/src/modules/bi/dashboards/`) — **DEFECT DETECTED**
- **Location**: `apps/api/src/modules/bi/dashboards/services/dashboard-analytics/dashboard-analytics.controller.ts`
- **Observed Defect (`SEC-CDE-01`)**:
  - In `DashboardAnalyticsController`:
    - Line 16: `getSalesDashboard(@Req() req)` invokes `this.dashboardService.getSalesMetrics(req.user.id)` without passing `req.user.companyId`.
    - Line 22: `getSalesManagerDashboard(@Req() req)` invokes `this.dashboardService.getSalesManagerMetrics(req.user.id, req.user.branchId)` without passing `companyId`.
    - Line 31: `getRenewalDashboard(@Req() req)` invokes `this.dashboardService.getRenewalMetrics(req.user.id)` without passing `companyId`.
  - In `DashboardAnalyticsService` (`dashboard-analytics.service.ts:167-202`):
    ```typescript
    async getRenewalMetrics(userId: string, companyId?: string) {
      // ...
      const [expiring30d, renewed, lapsed] = await Promise.all([
        this.prisma.policy.count({
          where: {
            expiryDate: { gte: today, lte: in30Days },
            status: { in: ['ACTIVE', 'PENDING_RENEWAL'] },
            ...(companyId ? { companyId } : {}),
          },
        }),
        this.prisma.policy.count({
          where: {
            status: 'RENEWED',
            ...(companyId ? { companyId } : {}),
          },
        }),
        this.prisma.policy.count({
          where: {
            status: 'LAPSED',
            ...(companyId ? { companyId } : {}),
          },
        }),
      ]);
      // ...
    }
    ```
  - **Impact**: Because `companyId` is omitted by the controller, `...(companyId ? { companyId } : {})` resolves to an empty object. The counts for `expiring30d`, `renewed`, and `lapsed` policies are computed **across all tenant organizations in the database**.

### D.2.4 Reporting Module (`apps/api/src/modules/platform/reporting/`)
- **Isolation Enforcement**:
  - `ReportsController`: All CRUD, schedule, export, and preview endpoints extract `companyId` from `CurrentUser`.
  - Cross-tenant checks in `updateReport`, `deleteReport`, `getReport`, `updateSchedule`, `deleteSchedule`, and `previewReport`:
    ```typescript
    if (companyId && report.companyId && report.companyId !== companyId) {
      throw new ForbiddenException('Cross-organization report access is strictly prohibited');
    }
    ```
  - `ExecuteReportCommand` / `ReportCommandsService`: Validates `command.companyId === report.companyId` and passes `companyId` into `buildReportData()`.

### D.2.5 Finance Module (`apps/api/src/modules/finance/`)
- **Dashboard**: `FinanceController.getDashboardMetrics()` throws `ForbiddenException('Company context is required for finance')` if `actor.companyId` is absent. Customers, receipts, monthly GWP, and outstanding invoices are strictly scoped to `companyId`.
- **Ledger**: `getLedgerEntries()` and `postJournalEntry()` pass `companyId` directly to `LedgerService`.
- **Commissions**: `getCommissions()` queries `where: { OR: [{ companyId }, { user: { companyId } }] }`. Payout approval (`POST /finance/commissions/:id/approve`) verifies `commission.user.companyId === companyId`.
- **Settlements**: `getSettlements()` filters by `companyId` or claim batch numbers belonging to the company. `createSettlementBatch()` requires `companyId`.
- **Invoices & Payments**: `getOutstandingInvoices()` scopes to `policy.companyId === companyId`. `processInvoicePayment()` verifies within an atomic transaction that `invoice.entityId` links to a policy belonging to `companyId`.

### D.2.6 Main Dashboard Module (`apps/api/src/modules/dashboard/`)
- `DashboardController`: Every endpoint extracts `companyId = user.companyId || user.organizationId`.
- `DashboardAnalyticsService.getDashboardData()`: Guarantees tenant scoping by resolving `effectiveCompanyId` from the database if absent, prefixes Redis cache keys with `tenant:${effectiveCompanyId}:`, and passes the scoped actor down to all analytics sub-services.

---

## D.3 Object-Level Authorization (BOLA / IDOR)

### D.3.1 Central Resource Authorization Service
- **Service**: `ResourceAuthorizationService` (`apps/api/src/common/services/resource-authorization.service.ts`).
- **Policy Enforcement**: Policies exist for `LeadPolicy`, `ContactPolicy`, `QuotationPolicy`, `PolicyPolicy`, `ClaimPolicy`, `DocumentPolicy`, `CommissionPolicy`, and `UsersPolicy`.
- **Enforcement Pattern**: Controllers resolve records using composite tenant criteria (`findById(id, companyId)`) and invoke:
  ```typescript
  this.authzService.authorize(user, 'CLAIM', 'UPDATE', claim);
  ```
  This verifies tenant tenancy, branch hierarchy, ownership, and role permissions, preventing Broken Object-Level Authorization (BOLA/IDOR).

---

## E.1 API Validation & Mass Assignment

### E.1.1 Global Validation Pipe Configuration
- **File**: `apps/api/src/main.ts:145-154`
- **Configuration**:
  ```typescript
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  ```
- **Evaluation**:
  - `whitelist: true`: Automatically strips unknown, non-whitelisted properties from request bodies.
  - `forbidNonWhitelisted: true`: Automatically rejects requests containing undeclared fields with an immediate `400 Bad Request`, preventing mass assignment, parameter tampering, and unintended object manipulation.
  - `transform: true`: Automatically transforms incoming payloads into typed DTO instances.

---

## E.2 Rate Limiting & Abuse Controls

### E.2.1 Throttling Architecture
- **Module**: `RateLimitingModule` (`apps/api/src/modules/platform/rate-limiting/rate-limiting.module.ts`).
- **Global Guard**: `CustomThrottlerGuard` is registered globally as an `APP_GUARD`.
- **Storage**: Backed by Redis via `ThrottlerStorageRedisService` when `REDIS_ENABLED === 'true'`; cleanly falls back to memory in test environments.
- **Tiers**:
  - `default`: 1,000 requests / 60 seconds
  - `authentication`: 30 requests / 60 seconds
  - `login`: 20 requests / 60 seconds
  - `upload`: 200 requests / 3,600 seconds
  - `report`: 100 requests / 3,600 seconds
- **Proxy Trust**: `main.ts:94` sets `trust proxy = 1`, ensuring rate limiters read the real client IP from `X-Forwarded-For` when behind Nginx or AWS ALB.

### E.2.2 CSRF Defense
- **Implementation**: Double-Submit Cookie pattern enforced in `JwtAuthGuard:59-69`.
- **Enforcement**: State-mutating HTTP methods (`POST`, `PUT`, `PATCH`, `DELETE`) require `x-csrf-token` header to match `csrf_token` cookie.
- **Architectural Note**: Programmatic non-browser clients must pass this header or utilize dedicated webhook/API service channels.

---

## E.3 Webhook & Integration Security

### E.3.1 Webhook Gateway
- **File**: `apps/api/src/modules/platform/integrations/webhooks/controllers/webhook-gateway/webhook-gateway.controller.ts`
- **Routing**: `POST /api/v1/webhooks/:provider`
- **Supported Providers**: Strictly rejects unsupported providers (`provider !== 'razorpay'` -> `400 BadRequestException`).

### E.3.2 Cryptographic Signature Verification
- **HMAC Calculation**: Computes HMAC-SHA256 of raw request payload against `RAZORPAY_WEBHOOK_SECRET`.
- **Raw Body Handling**: Utilizes `req?.rawBody` enabled via `NestFactory.create(AppModule, { rawBody: true })` in `main.ts:90`.
- **Timing Attack Prevention**: Employs `crypto.timingSafeEqual`:
  ```typescript
  if (
    signature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    )
  ) {
    throw new UnauthorizedException('Invalid webhook signature');
  }
  ```

### E.3.3 Replay Protection & Idempotency
- **Timestamp Replay Check**: Compares `x-razorpay-timestamp` against server time; rejects events with timestamp skew `> 5 minutes` (`MAX_AGE_MS = 5 * 60 * 1000`).
- **3-Case Idempotency Semantics**:
  - **Case A (New Event)**: Dispatches asynchronously via EventEmitter2 and records an entry in `webhookAuditLog`.
  - **Case B (Exact Duplicate Payload)**: Matches event ID and SHA-256 payload hash; returns `200 OK` `{ status: 'ignored', idempotent: true }` without re-dispatching.
  - **Case C (Payload Conflict / Tampering)**: Reuses event ID with conflicting payload; records a security alert in `AuditLog` (`action: REJECT, module: 'INTEGRATIONS'`) and throws `409 Conflict ('PAYMENT_TRANSACTION_CONFLICT')`.

---

## Summary Findings

| Finding ID | Severity | Title | Affected File / Line | Impact | Release Decision |
|---|---|---|---|---|---|
| **SEC-CDE-01** | **P1 (High)** | Cross-Tenant Aggregate Leak in BI Renewal Metrics | `apps/api/src/modules/bi/dashboards/services/dashboard-analytics/dashboard-analytics.controller.ts:16, 22, 31` | `getRenewalMetrics()` aggregates policy renewal metrics across all database tenants without filtering. | **BLOCKER**: Must patch controller to pass `req.user.companyId` before release. |
| **SEC-CDE-02** | **P2 (Medium)** | Hardcoded Default Credentials in Seed Script | `apps/api/prisma/seed.ts:394-412` | 15 persona accounts seeded with `Password@123`. Production guard prevents direct execution, but DB restoration poses risk. | **MONITOR / OPERATIONAL GATE**: Ensure production bootstrap scripts enforce credential purge. |
| **SEC-CDE-03** | **P2 (Medium)** | Webhook Signature JSON Stringify Fallback | `apps/api/src/modules/platform/integrations/webhooks/controllers/webhook-gateway/webhook-gateway.controller.ts:228-232` | If `rawBody` is undefined, fallback to `JSON.stringify` could cause signature mismatch. | **NON-BLOCKING**: `main.ts` configures `rawBody: true`. Harden fallback to reject if rawBody is missing. |
| **SEC-CDE-04** | **P3 (Low)** | Refresh Token Expiry Configuration Discrepancy | `apps/api/src/modules/platform/configuration/env.schema.ts:47` vs `auth.service.ts:203` | Schema sets 7 days, auth service falls back to 30 days, cookie sets 30 days. | **CLEANUP**: Standardize on 7 days across schema, service, and cookies. |
| **SEC-CDE-05** | **P3 (Informational)** | Missing Explicit JWT Issuer/Audience Claims | `apps/api/src/modules/auth/auth.module.ts:26-31` | Tokens lack explicit `iss` and `aud` claim verification. | **ADVISORY**: Add issuer/audience validation in next minor release. |

---

## Detailed Finding Cards

### SEC-CDE-01 | Severity: P1 (High) | Cross-Tenant Aggregate Leak in BI Renewal Metrics
- **File/Line**: `apps/api/src/modules/bi/dashboards/services/dashboard-analytics/dashboard-analytics.controller.ts:16, 22, 31`
- **Observed**:
  ```typescript
  // apps/api/src/modules/bi/dashboards/services/dashboard-analytics/dashboard-analytics.controller.ts
  @Get('renewals')
  @Roles(RoleType.BACK_OFFICE, RoleType.ADMIN)
  async getRenewalDashboard(@Req() req) {
    return this.dashboardService.getRenewalMetrics(req.user.id);
  }
  ```
  `this.dashboardService.getRenewalMetrics` has signature `(userId: string, companyId?: string)`. Because the controller passes only `req.user.id`, `companyId` is `undefined`. Inside `dashboard-analytics.service.ts:167-202`:
  ```typescript
  async getRenewalMetrics(userId: string, companyId?: string) {
    // ...
    const [expiring30d, renewed, lapsed] = await Promise.all([
      this.prisma.policy.count({
        where: {
          expiryDate: { gte: today, lte: in30Days },
          status: { in: ['ACTIVE', 'PENDING_RENEWAL'] },
          ...(companyId ? { companyId } : {}),
        },
      }),
      // ...
    ]);
  }
  ```
- **Expected**:
  `DashboardAnalyticsController` must extract `companyId = req.user.companyId || req.user.organizationId` and pass it to `getRenewalMetrics(req.user.id, companyId)`. Furthermore, `getSalesMetrics` and `getSalesManagerMetrics` must similarly receive `companyId`.
- **Impact**:
  A user with `BACK_OFFICE` or `ADMIN` role in Organization A calling `GET /api/v1/dashboards/renewals` receives policy counts (`expiring30d`, `renewed`, `lapsed`) aggregated across **all tenants in the entire system**, violating multi-tenant confidentiality.
- **Release Decision**:
  **BLOCKER**. Remediate in `dashboard-analytics.controller.ts` prior to production release.

---

### SEC-CDE-02 | Severity: P2 (Medium) | Hardcoded Default Credentials in Non-Production Seed Script
- **File/Line**: `apps/api/prisma/seed.ts:394-412`
- **Observed**:
  ```typescript
  const passwordHash = await argon2.hash("Password@123");
  const users = [
    { email: "superadmin@jest.com", fn: "Super", ln: "Administrator", role: "ADMIN", jr: "ADMIN" },
    { email: "admin@jest.com", fn: "System", ln: "Administrator", role: "ADMIN", jr: "ADMIN" },
    // ... 13 additional personas
  ];
  ```
- **Expected**:
  Seed passwords should either be randomly generated per environment or the seed script must guarantee that seeded records cannot persist into production.
- **Impact**:
  Although `seed.ts` has a safety guard on line 9 blocking execution when `NODE_ENV === 'production'`, database clones or staging migrations transferred to production would contain well-known accounts with default credentials.
- **Release Decision**:
  **OPERATIONAL GATE**. Validate that production deployment procedures explicitly forbid restoring staging databases and include an automated credential validation check.

---

### SEC-CDE-03 | Severity: P2 (Medium) | Webhook Signature JSON Stringify Fallback
- **File/Line**: `apps/api/src/modules/platform/integrations/webhooks/controllers/webhook-gateway/webhook-gateway.controller.ts:228-232`
- **Observed**:
  ```typescript
  const rawPayload = rawBody
    ? rawBody.toString('utf8')
    : typeof payload === 'string'
      ? payload
      : JSON.stringify(payload || {});
  ```
- **Expected**:
  Webhook signature verification must strictly enforce the presence of `rawBody`. If `rawBody` is missing, the request should fail-closed (`throw new BadRequestException('Raw body buffer required for signature verification')`).
- **Impact**:
  `JSON.stringify` does not guarantee original key order or spacing. If `rawBody` were ever unpopulated (e.g., misconfigured reverse proxy or middleware), signature checks would unpredictably fail or potentially allow malformed verification.
- **Release Decision**:
  **NON-BLOCKING**. Mitigated by `NestFactory.create(AppModule, { rawBody: true })` in `main.ts:90`. Harden in next release.

---

### SEC-CDE-04 | Severity: P3 (Low) | Refresh Token Expiry Configuration Discrepancy
- **File/Line**: `apps/api/src/modules/platform/configuration/env.schema.ts:47` vs `auth.service.ts:203`
- **Observed**:
  `envSchema` sets `JWT_REFRESH_EXPIRES_IN` default to `'7d'`. `auth.service.ts` uses `this.config.get<string>('jwt.refreshExpiresIn') ?? '30d'`, and `auth.controller.ts` sets cookie `maxAge` to 30 days (`30 * 24 * 60 * 60 * 1000`).
- **Expected**:
  A single authoritative configuration key should govern both database token lifetime and cookie `maxAge`.
- **Impact**:
  Tokens remain valid in the database and browser cookies for 30 days even if the environment intended a 7-day rotation cycle.
- **Release Decision**:
  **CLEANUP**. Harmonize configuration to 7 days.

---

### SEC-CDE-05 | Severity: P3 (Informational) | Missing Explicit JWT Issuer/Audience Claims
- **File/Line**: `apps/api/src/modules/auth/auth.module.ts:26-31`
- **Observed**:
  JWT tokens are signed and verified without `issuer` (`iss`) and `audience` (`aud`) claims.
- **Expected**:
  `JwtModule` should configure `issuer: 'jest-policy-crm'` and `audience: 'jest-policy-api'`.
- **Impact**:
  In a multi-service or microservice environment, tokens issued for one service might be accepted by another if secrets are shared. In the current monolithic architecture, this is low risk.
- **Release Decision**:
  **ADVISORY**. Implement in next architectural iteration.

---

## Security Test Evidence

The authoritative test suite was executed:
```bash
pnpm --filter api run test:cert
```

**Results**:
- **Test Suites**: **17 passed, 17 total**
- **Tests**: **252 passed, 252 total**
- **Execution Time**: 33.015 seconds
- **Pass Rate**: **100%**

### Key Security Scenarios Certified:
1. `test/security/round2-adversarial-audit.spec.ts`: Passes adversarial role escalation, forged tokens, and boundary bypasses.
2. `test/security/financial-tamper.spec.ts`: Passes ledger balance tampering, negative payment allocation, and invoice fraud vectors.
3. `test/security/http-route-security.spec.ts`: Passes unauthenticated route rejection, CSRF header enforcement, and scrape token validation.
4. `test/security/bola.spec.ts` & `test/security/bola-matrix.spec.ts`: Passes cross-agent and cross-tenant direct object access rejection.
5. `test/security/branch-isolation.spec.ts`: Passes branch hierarchy isolation tests.
6. `test/certification/tenant-isolation.spec.ts`: Passes multi-tenant entity segregation.
7. `test/certification/user-status-fsm.spec.ts`: Passes user status state-machine invariant validation.
8. `test/certification/concurrency-contracts.spec.ts`: Passes race-condition and optimistic lock verification.
