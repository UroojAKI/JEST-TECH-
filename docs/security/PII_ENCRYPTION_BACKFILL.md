# PAN/Aadhaar encryption backfill

This is a controlled data migration. Do not run it against production until a verified database backup exists and the deployment owner has approved the maintenance window.

## Deployment order

1. Deploy the schema migrations that add PAN blind-index columns and login-lockout fields.
2. Confirm `PII_ENCRYPTION_KEY` is set in the API runtime and migration environment. It must be at least 32 characters. Use the same key for every API instance and future backfill run. Never commit the key.
3. Deploy the API version with Prisma delegate wrapping before accepting new writes.
4. Run `pnpm --filter api pii:backfill` with the production database URL and exact production `PII_ENCRYPTION_KEY`.
5. Verify only ciphertext format and blind-index presence; never print PAN/Aadhaar values into logs or CI output.
6. Run duplicate-detection, contact/customer/account read, health quotation, motor quotation, lead, customer-360, and policy issuance smoke tests.
7. Confirm backup restoration and key recovery procedures before closing the change.

The script is restartable and processes bounded batches. It discovers Prisma models and recursively encrypts direct PAN/Aadhaar fields and matching PII keys inside Prisma JSON columns, including historical quotation/case snapshots. It computes stable PAN blind indexes wherever the model has a `panNumberHash` field. It never logs identity values.

## Important constraints

- AES-GCM encryption is randomized; PAN equality lookups must use `panNumberHash`, not ciphertext equality.
- The blind index is a keyed HMAC derived from `PII_ENCRYPTION_KEY` with domain separation. Changing that key requires coordinated decrypt/re-encrypt and blind-index rebuild; do not rotate it by simply replacing the environment variable.
- The Prisma delegate wrappers also wrap interactive transaction clients. Raw SQL, external data stores, object storage, exports, and integrations are outside Prisma and must be separately inventoried and protected.
- Do not run the script concurrently from multiple deployment jobs.
