-- Create trigger function to ensure AuditLog immutability
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog records are append-only and strictly immutable under IRDAI regulations (G023). UPDATE and DELETE operations are forbidden.';
END;
$$ LANGUAGE plpgsql;

-- Apply trigger before UPDATE or DELETE on audit_logs
DROP TRIGGER IF EXISTS trg_audit_log_immutable ON "audit_logs";
CREATE TRIGGER trg_audit_log_immutable
BEFORE UPDATE OR DELETE ON "audit_logs"
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_log_modification();
