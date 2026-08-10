exports.up = (pgm) => {
  // --- action_receipts: add previous_receipt_id for append-only chains ---
  pgm.sql(`
    ALTER TABLE action_receipts
      ADD COLUMN previous_receipt_id UUID;
  `);

  // --- outbox: add CANCELLED state ---
  pgm.sql(`
    ALTER TABLE outbox DROP CONSTRAINT IF EXISTS outbox_state_check;
    ALTER TABLE outbox ADD CONSTRAINT outbox_state_check
      CHECK (state IN ('PENDING','PROCESSING','COMPLETED','FAILED','CANCELLED'));
  `);

  // --- Restore fully immutable trigger on action_receipts ---
  // The handoff confirmation and reconciliation now INSERT new rows
  // (previous_receipt_id chains) instead of UPDATE-ing existing ones,
  // so the guard can be fully rigid.
  pgm.sql(`
    DROP TRIGGER IF EXISTS action_receipts_immutable ON action_receipts;
    DROP FUNCTION IF EXISTS action_receipts_guard();

    CREATE TRIGGER action_receipts_immutable
      BEFORE UPDATE OR DELETE ON action_receipts
      FOR EACH ROW
      EXECUTE FUNCTION reject_governed_history_mutation();
  `);
};

exports.down = (pgm) => {
  // Restore the permissive HANDOFF_PENDING → HANDOFF_CONFIRMED trigger
  pgm.sql(`
    DROP TRIGGER IF EXISTS action_receipts_immutable ON action_receipts;
    DROP FUNCTION IF EXISTS action_receipts_guard();

    CREATE OR REPLACE FUNCTION action_receipts_guard()
    RETURNS TRIGGER AS $$
    BEGIN
      IF TG_OP = 'UPDATE'
         AND OLD.state = 'HANDOFF_PENDING'
         AND NEW.state = 'HANDOFF_CONFIRMED'
         AND OLD.platform_uri IS NULL
         AND NEW.platform_uri IS NOT NULL
         AND OLD.id = NEW.id
         AND OLD.organization_id = NEW.organization_id
         AND OLD.action_grant_id = NEW.action_grant_id
         AND OLD.schema_version = NEW.schema_version
         AND OLD.platform = NEW.platform
         AND OLD.execution_mode = NEW.execution_mode
         AND OLD.created_at = NEW.created_at
         AND (OLD.handoff_steps IS NOT DISTINCT FROM NEW.handoff_steps)
         AND (OLD.platform_cid IS NOT DISTINCT FROM NEW.platform_cid
              OR (OLD.platform_cid IS NULL AND NEW.platform_cid IS NOT NULL))
         AND (OLD.unknown_reason IS NOT DISTINCT FROM NEW.unknown_reason)
         AND (OLD.reconciled_at IS NOT DISTINCT FROM NEW.reconciled_at)
         AND (OLD.reconciliation_method IS NOT DISTINCT FROM NEW.reconciliation_method)
      THEN
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'GOVERNED_HISTORY_IMMUTABLE';
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER action_receipts_immutable
      BEFORE UPDATE OR DELETE ON action_receipts
      FOR EACH ROW
      EXECUTE FUNCTION action_receipts_guard();
  `);

  // Revert outbox state check
  pgm.sql(`
    ALTER TABLE outbox DROP CONSTRAINT IF EXISTS outbox_state_check;
    ALTER TABLE outbox ADD CONSTRAINT outbox_state_check
      CHECK (state IN ('PENDING','PROCESSING','COMPLETED','FAILED'));
  `);

  pgm.sql(`
    ALTER TABLE action_receipts DROP COLUMN IF EXISTS previous_receipt_id;
  `);
};
