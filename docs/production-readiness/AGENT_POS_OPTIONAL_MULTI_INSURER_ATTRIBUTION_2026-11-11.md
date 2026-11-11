# Agent POS — Optional Multi-Insurer Attribution

## Admin master

- The POS Partner record is the Agent POS master record.
- An Agent POS can exist without an insurer registration.
- One Agent POS may have multiple insurer-specific registrations.
- Each insurer registration stores the insurer master ID, Partner Code at Insurer, Insurer POS ID, effective dates and active state.
- Duplicate registrations for the same Agent POS and insurer are rejected; registrations for different insurers are allowed.
- Contact/mobile and email remain on the Agent POS master record.

## Policy issuance

- Agent POS selection is optional for motor and non-motor policy issuance.
- When an Agent POS is selected, the API validates that the Agent POS is active and has an active, effective mapping for the policy's insurer.
- When no Agent POS is selected, policy issuance continues with `distributionChannel = DIRECT`.
- Selected Agent POS and insurer-side identifiers are copied to issuance-time policy snapshot fields. Later edits to the Agent POS master do not rewrite those policy snapshots.
- Existing policy records are not rewritten by this change.

## Admin Excel export

The Admin POS Partner page provides an Export Excel action. The workbook is generated from current tenant-scoped records and contains:

1. **Agent POS Master** — Agent POS code/name, contact, email, status, each insurer mapping, Partner Code at Insurer and Insurer POS ID.
2. **Policy Attribution** — issued/persisted policy IDs and numbers, status, insurer snapshots, customer contact, premium and policy dates.
3. **POS Activity** — audit events for the Agent POS and its linked policies, including mapping events keyed by the Agent POS ID.

The export is generated on demand; it is not a separate source of truth. The underlying database records and audit trail remain authoritative.

## Migration

Migration `20261111130000_agent_pos_multi_insurer_optional_attribution` removes the unique constraint on `posPartnerId`, adds a unique constraint on `(posPartnerId, insurerId)`, and adds the two issuance snapshot columns. Apply it only through the normal deployment migration pipeline.
