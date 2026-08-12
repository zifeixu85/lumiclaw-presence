exports.up = (pgm) => {
  // Add campaign_id to action_receipts so SSE clients can be
  // filtered by (organization_id, campaign_id) without a join
  // through action_grants.
  pgm.sql(`
    ALTER TABLE action_receipts
      ADD COLUMN campaign_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';
  `);

  // Drop the default now that the column exists for new writes
  // (the application always supplies the real value).
  pgm.sql(`
    ALTER TABLE action_receipts
      ALTER COLUMN campaign_id DROP DEFAULT;
  `);

  // Index for the common lookup pattern
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS action_receipts_campaign_idx
      ON action_receipts(organization_id, campaign_id);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP INDEX IF EXISTS action_receipts_campaign_idx`);
  pgm.sql(`ALTER TABLE action_receipts DROP COLUMN IF EXISTS campaign_id`);
};
