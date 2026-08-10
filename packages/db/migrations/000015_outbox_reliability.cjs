exports.up = (pgm) => {
  // --- outbox: add max_attempts ---
  pgm.sql(`
    ALTER TABLE outbox ADD COLUMN max_attempts INTEGER NOT NULL DEFAULT 3;
  `);

  // --- outbox: add DEAD_LETTER to state check ---
  pgm.sql(`
    ALTER TABLE outbox DROP CONSTRAINT IF EXISTS outbox_state_check;
    ALTER TABLE outbox ADD CONSTRAINT outbox_state_check
      CHECK (state IN ('PENDING','PROCESSING','COMPLETED','FAILED','CANCELLED','DEAD_LETTER'));
  `);

  // --- outbox: lease recovery index (PROCESSING rows sorted by lock time) ---
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS outbox_lease_recovery
      ON outbox(state, locked_at)
      WHERE state = 'PROCESSING';
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP INDEX IF EXISTS outbox_lease_recovery`);

  pgm.sql(`
    ALTER TABLE outbox DROP CONSTRAINT IF EXISTS outbox_state_check;
    ALTER TABLE outbox ADD CONSTRAINT outbox_state_check
      CHECK (state IN ('PENDING','PROCESSING','COMPLETED','FAILED','CANCELLED'));
  `);

  pgm.sql(`
    ALTER TABLE outbox DROP COLUMN IF EXISTS max_attempts;
  `);
};
