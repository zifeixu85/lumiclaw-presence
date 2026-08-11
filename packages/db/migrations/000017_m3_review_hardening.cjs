exports.up = (pgm) => {
  pgm.createTable('owner_decisions', {
    organization_id: {type: 'uuid', notNull: true}, id: {type: 'uuid', notNull: true},
    campaign_id: {type: 'uuid', notNull: true}, platform: {type: 'text', notNull: true},
    execution_mode: {type: 'text', notNull: true}, schedule_occurrence_id: {type: 'uuid', notNull: true},
    artifact_revision_id: {type: 'uuid', notNull: true}, activation_unit_id: {type: 'uuid', notNull: true},
    channel_account_id: {type: 'uuid', notNull: true}, capability_snapshot_id: {type: 'uuid', notNull: true},
    payload: {type: 'jsonb', notNull: true}, decided_at: {type: 'timestamptz', notNull: true},
  }, {constraints: {primaryKey: ['organization_id', 'id'], foreignKeys: [
    {columns: ['organization_id', 'campaign_id'], references: 'campaigns(organization_id,id)', onDelete: 'RESTRICT'},
  ]}});
  pgm.sql(`
    ALTER TABLE action_grants DROP CONSTRAINT IF EXISTS action_grants_status_check;
    ALTER TABLE action_grants ADD CONSTRAINT action_grants_status_check
      CHECK (status IN ('ISSUED','EXECUTING','CONSUMED','EXPIRED','REVOKED'));
    ALTER TABLE action_receipts DROP CONSTRAINT IF EXISTS action_receipts_state_check;
    ALTER TABLE action_receipts ADD CONSTRAINT action_receipts_state_check
      CHECK (state IN ('PUBLISHED','HANDOFF_PENDING','HANDOFF_CONFIRMED','FAILED','NOT_EXECUTED','UNKNOWN'));
    CREATE UNIQUE INDEX action_receipts_one_successor ON action_receipts(organization_id, previous_receipt_id)
      WHERE previous_receipt_id IS NOT NULL;
    CREATE UNIQUE INDEX outbox_one_action_attempt ON outbox(organization_id, aggregate_id)
      WHERE aggregate_type = 'ACTION_GRANT';
  `);
};
exports.down = (pgm) => {
  pgm.sql(`DROP INDEX IF EXISTS outbox_one_action_attempt;
    DROP INDEX IF EXISTS action_receipts_one_successor;
    ALTER TABLE action_receipts DROP CONSTRAINT IF EXISTS action_receipts_state_check;
    ALTER TABLE action_receipts ADD CONSTRAINT action_receipts_state_check
      CHECK (state IN ('PUBLISHED','HANDOFF_PENDING','HANDOFF_CONFIRMED','FAILED','UNKNOWN'));
    ALTER TABLE action_grants DROP CONSTRAINT IF EXISTS action_grants_status_check;
    ALTER TABLE action_grants ADD CONSTRAINT action_grants_status_check CHECK (status IN ('ISSUED','CONSUMED','EXPIRED','REVOKED'));`);
  pgm.dropTable('owner_decisions');
};
