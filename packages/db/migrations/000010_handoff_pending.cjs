exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE action_receipts DROP CONSTRAINT IF EXISTS action_receipts_state_check;
    ALTER TABLE action_receipts ADD CONSTRAINT action_receipts_state_check
      CHECK (state IN ('PUBLISHED','HANDOFF_PENDING','HANDOFF_CONFIRMED','FAILED','UNKNOWN'));
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE action_receipts DROP CONSTRAINT IF EXISTS action_receipts_state_check;
    ALTER TABLE action_receipts ADD CONSTRAINT action_receipts_state_check
      CHECK (state IN ('PUBLISHED','HANDOFF_CONFIRMED','FAILED','UNKNOWN'));
  `);
};
