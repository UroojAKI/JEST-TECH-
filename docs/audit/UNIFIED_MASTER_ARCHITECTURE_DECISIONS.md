# Unified Master Architecture Decisions

**Status:** Working decisions for implementation on `feature/health-insurance-crm`
**Updated:** 2026-11-04

These decisions reconcile the CRM plan with the existing schema and authorization model. They guide implementation; they do not claim a production migration or data reconciliation has run.

## 1. Agent identity and attribution

- `User` remains the login and employment record. `Agent` remains the canonical insurance-agent profile, scoped to `companyId`.
- External partner, insurer, broker, or legacy codes are aliases of an `Agent`, not new agent records and not replacements for `employeeCode` or `Agent.agentCode`.
- Store each alias in a dedicated external-identifier registry with a company, namespace, normalized code, status/verification state, owning `Agent`, and audit history. Enforce uniqueness on `(companyId, namespace, normalizedCode)` so identical text in separate namespaces is valid.
- Resolve identifiers to `Agent.id` before creating or attributing business records. Do not trust free-text agent codes as authorization inputs.
- Preserve origin, current owner, and servicing agent as distinct concepts. Reassignment changes current ownership and writes history; it does not rewrite the origin snapshot on old quotations, policies, or commission records.
- `Contact.agentCode` and existing `agentCodeSnapshot` values remain display/history fields. They are not authoritative identity relations.

## 2. Health case ownership and access

- Add an explicit nullable `agentId` relation from `HealthQuotationCase` to the canonical `Agent`; keep `createdById` as creator/audit metadata.
- For a new agent-created case, derive the owner from the authenticated user's Agent profile. For a case created from a lead, use the lead's canonical assigned agent. Back-office/admin users may assign an active same-company agent; an unassigned operational case remains visible only to back office/admin.
- Agent reads and writes must be scoped to their assigned `agentId` (with a narrowly defined legacy creator fallback only during migration). Back office/admin access is limited to the authenticated `companyId`.
- Backfill existing cases from the linked lead's agent first, then from the creator's Agent profile in the same company. Leave unresolved records unassigned for operations review; never guess from a matching display code.
- Verify every `familyMemberId` against the proposer's linked customer and company before creating a Health case. The same family-member ID cannot be attached across customers or tenants.
- Apply the same authorization rule to list, detail, lead lookup, payment, document, update, and mutation paths through shared authorization helpers.

## 3. PII and KYC

- Standard contact, quote, Health case, User 360, export, and log responses must not expose raw PAN or Aadhaar. KYC reveal requires an explicit permission-checked action and audit event.
- Keep one authoritative KYC value. Do not copy raw PAN/Aadhaar into quote metadata or case snapshots; snapshots may record whether a KYC item was supplied and its verification state.
- Before encrypting persisted values, map every read, write, duplicate-check, export, insurer handoff, and migration path. Use versioned authenticated ciphertext and a separately keyed deterministic lookup hash where exact duplicate lookup is required. Do not use ciphertext itself as a lookup key.
- Roll out with additive fields, dual-read compatibility, staging backfill and integrity checks, then switch reads/writes and retire plaintext only after rollback and historical-data procedures are verified. The current `EncryptionUtil` needs key/version and failure-mode review before reuse.

## 4. Payment consistency

- `MotorPaymentRecord` remains the authoritative Health payment record unless the wider finance reconciliation proves an existing shared payment entity is the proper authority.
- Payment record and quotation workflow updates must share a database transaction. The transaction re-reads the case/selected quote and scopes both to `companyId`.
- Repeated submissions for the same quotation are idempotent. A verified `PAID` record cannot be silently downgraded or have amount/reference replaced by a duplicate request. Allowed status transitions must be explicit and tested.
- Agents may submit or view their own payment evidence but cannot verify payment. Back office/admin verification remains tenant-scoped and audited.

## 5. Agent 360 and Business Intelligence

- Extend the existing `GET /users/:id/workspace` and its User 360 service/repository/page where that is the right shared surface. Use canonical `Agent.id`, verified transaction relations, and immutable source records; do not build a parallel portfolio aggregator.
- Agent 360 must separate attributed business from current service ownership and include Health and Motor through shared Quotation/Policy records where the relation is authoritative.
- `business-intelligence`, `bi/data-warehouse`, `bi/dashboards`, and `bi/forecasting` are all registered today. First map their controllers, metric definitions, and data sources. Consolidate only after proving which service owns each metric; do not add a third dashboard or metric path.
- Financial BI reads verified payments, issued policies, and commission records. It does not infer collected premium from quotation premium or create a competing financial interpretation.

## 6. Migration and release constraints

- Database changes are additive first. A staging database and isolated CI test database are required to verify migration status and backfills; the current workspace has no configured database URL and Docker is unavailable.
- No production data is read or modified during audit. No production migration, deployment, or certificate renewal is authorized by this local implementation plan alone.
- The checked-in release certificate is stale against this branch and schema. Production promotion remains blocked until required independent evidence, rollback rehearsal, and authorized release review are current.

## 7. Implementation checkpoint

- Implemented in source: nullable Health case `agentId`, additive in-company backfill migration, shared case ownership scoping, same-contact family-member validation, atomic payment/quotation updates, payment replacement/downgrade guards, and masked standard Health case/quotation responses.
- The Health case creator fallback for unassigned cases is transitional. Retire it after the migration has run and unresolved cases have been assigned or deliberately kept operations-only.
- Health updates no longer copy PAN/Aadhaar into quote metadata. Contact and Customer storage remains plaintext, historical quote metadata has not been data-cleaned, and dedicated permission-checked KYC reveal/audit behavior is not implemented in this slice.
- Focused regression tests cover the ownership predicate, family-member validation, response masking, payment transaction, verified-payment immutability, and quotation mapper masking. The migration and behavior still need isolated database/CI verification.
- External identifier registry, broader PII write/read-path migration, Agent 360, BI consolidation, full adversarial audit, staging migration rehearsal, and release certification remain open.
