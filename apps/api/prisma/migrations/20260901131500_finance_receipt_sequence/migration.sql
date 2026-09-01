-- Production hardening: receipt numbers must be generated atomically.
CREATE SEQUENCE IF NOT EXISTS receipt_number_seq START 1 INCREMENT 1;
