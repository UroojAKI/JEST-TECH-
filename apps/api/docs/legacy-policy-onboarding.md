# Legacy policy onboarding (Option A)

This feature stores already-issued historical policies independently from the standard `Policy` lifecycle.

## API

All endpoints require a JWT and the `AGENT` role.

- `POST /legacy-policies`
- `GET /legacy-policies`
- `GET /legacy-policies/:id`
- `GET /legacy-policies/renewals/upcoming`

Create body:

```json
{
  "customerId": "customer UUID OR contactId": "contact UUID",
  "insurerName": "INSURER NAME",
  "insurerPolicyNumber": "INSURER POLICY NUMBER",
  "productType": "MOTOR",
  "coverageDescription": "Coverage summary",
  "premiumAmount": 12345.67,
  "policyStartDate": "2025-01-01",
  "policyExpiryDate": "2026-01-01",
  "issueDate": "2024-12-30",
  "evidenceDocumentId": "document UUID",
  "agentDeclaration": true
}
```

Exactly one of `customerId` or `contactId` must be supplied. Evidence must be an active document uploaded by the authenticated agent and already associated with that customer/contact. The insurer-issued policy number is normalized and duplicate-checked within the company.

## Lifecycle and safeguards

- Status is calculated from policy dates at registration; already-expired records are stored as `EXPIRED`.
- Renewal reminder obligations are persisted independently at offsets 45, 30, 15, 7, 0 and -1 days.
- Legacy records do not create or mutate normal `Policy`, `Quotation`, payment, inspection, or issuance entities.
- A legacy record does not carry an inspection waiver into a later renewal. Renewal conversion to a new policy must use the existing normal quotation, eligibility, inspection and issuance workflow.
- The uploaded document is evidence that the insurer-issued policy exists; it is not represented as proof that an inspection occurred.
- Registration, reminders and audit-log insertion are committed in one database transaction.

## Integration note

The legacy records have a dedicated API/read model because the current standard policy and renewal tables require a quotation-backed `Policy`. The frontend policy/customer views still need to consume these endpoints to render a unified timeline. Reminder rows are persisted and exposed by the upcoming endpoint; a delivery worker/notification channel is a separate integration task.
