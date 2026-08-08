exports.up = (pgm) => {
  // --- action_grants ---
  pgm.createTable('action_grants', {
    organization_id: {type: 'uuid', notNull: true},
    id: {type: 'uuid', notNull: true},
    campaign_id: {type: 'uuid', notNull: true},
    schedule_occurrence_id: {type: 'uuid', notNull: true},
    artifact_revision_id: {type: 'uuid', notNull: true},
    activation_unit_id: {type: 'uuid', notNull: true},
    schema_version: {type: 'integer', notNull: true, check: 'schema_version = 1'},
    platform: {type: 'text', notNull: true},
    execution_mode: {type: 'text', notNull: true, check: "execution_mode IN ('DIRECT','NATIVE_HANDOFF')"},
    status: {type: 'text', notNull: true, check: "status IN ('ISSUED','CONSUMED','EXPIRED','REVOKED')"},
    issued_at: {type: 'timestamptz', notNull: true},
    expires_at: {type: 'timestamptz', notNull: true, check: 'expires_at > issued_at'},
    consumed_at: {type: 'timestamptz'},
    revocation_reason: {type: 'text'},
    grant_digest: {type: 'char(64)', notNull: true},
    payload: {type: 'jsonb', notNull: true},
    created_at: {type: 'timestamptz', notNull: true}
  }, {constraints: {primaryKey: ['organization_id', 'id'], foreignKeys: [
    {columns: ['organization_id', 'campaign_id'], references: 'campaigns(organization_id,id)', onDelete: 'CASCADE'},
    {columns: ['organization_id', 'schedule_occurrence_id'], references: 'schedule_occurrences(organization_id,id)', onDelete: 'RESTRICT'},
    {columns: ['organization_id', 'artifact_revision_id'], references: 'artifact_revisions(organization_id,id)', onDelete: 'RESTRICT'}
  ]}});

  // --- outbox ---
  pgm.createTable('outbox', {
    organization_id: {type: 'uuid', notNull: true},
    id: {type: 'uuid', notNull: true},
    aggregate_type: {type: 'text', notNull: true, check: "aggregate_type = 'ACTION_GRANT'"},
    aggregate_id: {type: 'uuid', notNull: true},
    schema_version: {type: 'integer', notNull: true, check: 'schema_version = 1'},
    payload: {type: 'jsonb', notNull: true},
    state: {type: 'text', notNull: true, default: 'PENDING', check: "state IN ('PENDING','PROCESSING','COMPLETED','FAILED')"},
    locked_by: {type: 'text'},
    locked_at: {type: 'timestamptz'},
    attempts: {type: 'integer', notNull: true, default: 0, check: 'attempts >= 0'},
    created_at: {type: 'timestamptz', notNull: true}
  }, {constraints: {primaryKey: ['organization_id', 'id']}});

  // Partial index — only covers PENDING rows the consumer actually polls.
  pgm.createIndex('outbox', ['state', 'created_at'], {where: "state = 'PENDING'", name: 'outbox_consumer_next'});

  // --- action_receipts ---
  pgm.createTable('action_receipts', {
    organization_id: {type: 'uuid', notNull: true},
    id: {type: 'uuid', notNull: true},
    action_grant_id: {type: 'uuid', notNull: true},
    schema_version: {type: 'integer', notNull: true, check: 'schema_version = 1'},
    platform: {type: 'text', notNull: true},
    execution_mode: {type: 'text', notNull: true, check: "execution_mode IN ('DIRECT','NATIVE_HANDOFF')"},
    state: {type: 'text', notNull: true, check: "state IN ('PUBLISHED','HANDOFF_CONFIRMED','FAILED','UNKNOWN')"},
    platform_uri: {type: 'text'},
    platform_cid: {type: 'text'},
    handoff_steps: {type: 'jsonb'},
    unknown_reason: {type: 'text'},
    reconciled_at: {type: 'timestamptz'},
    reconciliation_method: {type: 'text', check: "reconciliation_method IN ('PLATFORM_QUERY','OWNER_MANUAL')"},
    created_at: {type: 'timestamptz', notNull: true}
  }, {constraints: {primaryKey: ['organization_id', 'id'], foreignKeys: [
    {columns: ['organization_id', 'action_grant_id'], references: 'action_grants(organization_id,id)', onDelete: 'RESTRICT'}
  ]}});

  // --- immutable trigger on receipts only (grants support revocation) ---
  pgm.sql(`CREATE TRIGGER action_receipts_immutable BEFORE UPDATE OR DELETE ON action_receipts FOR EACH ROW EXECUTE FUNCTION reject_governed_history_mutation()`);
};

exports.down = (pgm) => {
  pgm.sql('DROP TRIGGER IF EXISTS action_receipts_immutable ON action_receipts');
  pgm.dropTable('action_receipts');
  pgm.dropTable('outbox');
  pgm.dropTable('action_grants');
};
