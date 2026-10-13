-- Create sequence for settlement batch numbers (safe concurrent allocation)
CREATE SEQUENCE IF NOT EXISTS settlement_batch_seq START 1;
