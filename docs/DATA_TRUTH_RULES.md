# Data Truth Rules

1. **Contact Identity**: Contact is the single customer identity across the system.
2. **Lead Relation**: Lead must reference a Contact (`Lead.contactId` REQUIRED).
3. **Quote Relation**: Quote must reference a Contact (`Quote.contactId` REQUIRED).
4. **Policy Lineage**: Policy must originate from a valid Quote.
5. **Vehicle Registration**: Vehicle registration is stored as normalized uppercase without spaces.
6. **PII Data**: PII data (PAN, Aadhaar) is encrypted at rest using `EncryptionUtil` only.
7. **Agent Identity**: Agent identity comes from the User record (no free text).
8. **Branch Assignment**: Branch is assigned by admin or user's authorized branch.
9. **Previous Claims**: Use NONE/AVAILABLE/NOT_AVAILABLE states, never interpret null as zero.
10. **Renewal Date**: Renewal date = MIN(actual OD expiry, actual TP expiry) from insurer-confirmed dates.
11. **Currency**: All monetary amounts are stored in paise (integer) and displayed as rupees.
12. **Pagination**: All lists use server-side pagination (page, limit, total).
13. **Idempotency**: Idempotency keys are required for all payment and webhook operations.
14. **Audit**: Audit log is required for every state transition.
