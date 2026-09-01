-- Production hardening: journal entry numbers must be generated atomically.
-- This avoids collisions caused by timestamp + random-number generation under concurrency.
CREATE SEQUENCE IF NOT EXISTS journal_entry_number_seq START 1 INCREMENT 1;
