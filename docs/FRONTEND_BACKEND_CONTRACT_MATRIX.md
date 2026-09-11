# FRONTEND-BACKEND CONTRACT MATRIX — JEST POLICY CRM

**Version:** 4.0  
**Baseline Git HEAD:** `ef337f39e286dbb11452ee0273d2ca3845903321`  
**Status:** Canonical Reference

---

## 1. Global Standards

- **Pagination**: Standard query params `page` (default 1, min 1), `limit` (default 25, min 1, max 100). Standard envelope `{ data: T[], meta: { total, page, limit, totalPages, hasNextPage, hasPreviousPage } }`.
- **Response Wrapper**: Automated global unwrap in `api-client.ts` unpacking `{ success: true, data: ... }`.
- **Idempotency**: Critical mutations (`/payments`, `/policies/issue`, `/quotations/:id/finalize`, `/leads/:id/convert`) enforce `Idempotency-Key` header.
- **Tenancy**: Authenticated user JWT actor drives all scoping. `organizationId` and `branchId` must be derived from token, not client request payload.

---

## 2. Feature Endpoint & DTO Matrix

| Feature | HTTP Method & Path | Request DTO / Payload | Expected Response | Error Responses |
|---|---|---|---|---|
| **Contact Create** | `POST /contacts` | `CreateContactDto` (`firstName`, `lastName`, `phone`, `type`, `branchId?`, ...) | `ContactResponseDto` with `contactCode` | `400 Bad Request`, `409 Conflict` (Duplicate) |
| **Contact List** | `GET /contacts` | Query: `PaginationDto` (`page`, `limit`, `search`, `sortBy`) | `PaginatedResponseDto<ContactResponseDto>` | `401 Unauthorized`, `403 Forbidden` |
| **Customer 360** | `GET /customer-360/:id` | Path parameter: `id` (UUID) | Complete Customer 360 bundle (contact, policies, quotes, claims, leads, documents, timeline) | `404 Not Found`, `403 Forbidden` |
| **Lead Create** | `POST /leads` | `CreateLeadDto` (`title`, `contactId`, `estimatedValue`, `source`, ...) | `LeadResponseDto` with `leadCode` | `400 Bad Request` |
| **Quotation Create** | `POST /quotations` | `CreateQuotationDto` (core fields: proposer, mobile, category, draft values) | `QuotationResponseDto` with `quotationNumber` | `400 Bad Request` |
| **Quotation Completion** | `GET /quotations/:id/completion` | Path parameter: `id` | `CompletionResult` (percentage, missingFields, applicableFields) | `404 Not Found` |
| **Quotation Update Details** | `PATCH /quotations/:id/details` | `UpdateQuotationDetailsDto` (key-value updates for missing fields) | Recalculated completion & quote details | `400 Bad Request`, `404 Not Found` |
| **Tariff Lookup** | `GET /motor/tariff/lookup` | `vehicleCategory`, `policyType`, `engineCc?`, `seatingCapacity?`, `gvwKg?` | `TariffResult` (annualPremium, isVerified, version) | `400 Bad Request` |
| **Back Office Queue** | `GET /policies/back-office/queue` | Query: `PaginationDto`, `status?` | `PaginatedResponseDto<BackOfficeQueueItem>` | `403 Forbidden` |
| **Underwriter Approve** | `POST /quotations/:id/approve` | `ApproveQuotationDto` (`notes?`) | Updated Quotation (`APPROVED` status) | `403 Forbidden` (non-underwriter/self-approval) |
| **Underwriter Reject** | `POST /quotations/:id/reject` | `RejectQuotationDto` (`reason`) | Updated Quotation (`REJECTED` status) | `403 Forbidden` |
| **Policy Issuance** | `POST /policies/issue` | `IssuePolicyDto` (`quotationId`, `paymentTransactionId`, ...) | `PolicyResponseDto` with `policyNumber`, renewal schedule | `400 Bad Request` (Gate failure) |
| **Claim Submission** | `POST /claims` | `CreateClaimDto` (`policyId`, `incidentDate`, `claimAmount`, `description`) | `ClaimResponseDto` with `claimNumber` | `400 Bad Request` (Inactive/expired policy) |
