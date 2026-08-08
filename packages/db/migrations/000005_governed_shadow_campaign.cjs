exports.up = (pgm) => {
  pgm.createTable('missions', {
    organization_id: {type: 'uuid', notNull: true}, id: {type: 'uuid', notNull: true}, campaign_id: {type: 'uuid', notNull: true},
    source_campaign_version: {type: 'integer', notNull: true}, source_campaign_digest: {type: 'char(64)', notNull: true},
    runtime: {type: 'text', notNull: true, check: "runtime = 'agentteams'"}, runtime_version: {type: 'text', notNull: true, check: "runtime_version = 'v1.2.0'"}, runtime_project_id: {type: 'text', notNull: true},
    state: {type: 'text', notNull: true}, version: {type: 'integer', notNull: true}, etag: {type: 'text', notNull: true}, payload: {type: 'jsonb', notNull: true},
    live: {type: 'boolean', notNull: true, default: false, check: 'live = false'}, external_action_allowed: {type: 'boolean', notNull: true, default: false, check: 'external_action_allowed = false'},
    created_at: {type: 'timestamptz', notNull: true}, updated_at: {type: 'timestamptz', notNull: true}
  }, {constraints: {primaryKey: ['organization_id', 'id'], foreignKeys: [{columns: ['organization_id', 'campaign_id'], references: 'campaigns(organization_id,id)', onDelete: 'CASCADE'}]}});
  pgm.addConstraint('missions', 'mission_campaign_digest_unique', {unique: ['organization_id', 'campaign_id', 'source_campaign_digest']});

  pgm.createTable('agent_runs', {
    organization_id: {type: 'uuid', notNull: true}, mission_id: {type: 'uuid', notNull: true}, role_id: {type: 'text', notNull: true}, identity_id: {type: 'uuid', notNull: true},
    context_digest: {type: 'char(64)', notNull: true}, permissions: {type: 'jsonb', notNull: true}, payload: {type: 'jsonb', notNull: true}, created_at: {type: 'timestamptz', notNull: true}
  }, {constraints: {primaryKey: ['organization_id', 'mission_id', 'role_id'], foreignKeys: [{columns: ['organization_id', 'mission_id'], references: 'missions(organization_id,id)', onDelete: 'CASCADE'}]}});

  pgm.createTable('skill_locks', {
    organization_id: {type: 'uuid', notNull: true}, mission_id: {type: 'uuid', notNull: true}, id: {type: 'uuid', notNull: true}, name: {type: 'text', notNull: true}, version: {type: 'text', notNull: true}, digest: {type: 'char(64)', notNull: true}, payload: {type: 'jsonb', notNull: true}
  }, {constraints: {primaryKey: ['organization_id', 'mission_id', 'id'], foreignKeys: [{columns: ['organization_id', 'mission_id'], references: 'missions(organization_id,id)', onDelete: 'CASCADE'}]}});

  pgm.createTable('agent_tasks', {
    organization_id: {type: 'uuid', notNull: true}, mission_id: {type: 'uuid', notNull: true}, id: {type: 'uuid', notNull: true}, role_id: {type: 'text', notNull: true},
    input_digest: {type: 'char(64)', notNull: true}, skill_lock_digest: {type: 'char(64)', notNull: true}, state: {type: 'text', notNull: true}, attempt: {type: 'integer', notNull: true},
    accepted_output_digest: {type: 'char(64)'}, payload: {type: 'jsonb', notNull: true}, updated_at: {type: 'timestamptz', notNull: true}
  }, {constraints: {primaryKey: ['organization_id', 'mission_id', 'id'], foreignKeys: [{columns: ['organization_id', 'mission_id'], references: 'missions(organization_id,id)', onDelete: 'CASCADE'}]}});

  pgm.createTable('governed_artifact_revisions', {
    organization_id: {type: 'uuid', notNull: true}, mission_id: {type: 'uuid', notNull: true}, campaign_id: {type: 'uuid', notNull: true}, id: {type: 'uuid', notNull: true}, activation_unit_id: {type: 'uuid', notNull: true},
    platform: {type: 'text', notNull: true}, revision: {type: 'integer', notNull: true}, digest: {type: 'char(64)', notNull: true}, parent_revision_id: {type: 'uuid'}, producer_role_id: {type: 'text', notNull: true}, payload: {type: 'jsonb', notNull: true}, created_at: {type: 'timestamptz', notNull: true}
  }, {constraints: {primaryKey: ['organization_id', 'id'], foreignKeys: [{columns: ['organization_id', 'mission_id'], references: 'missions(organization_id,id)', onDelete: 'CASCADE'}]}});
  pgm.addConstraint('governed_artifact_revisions', 'governed_revision_version_unique', {unique: ['organization_id', 'mission_id', 'activation_unit_id', 'revision']});

  pgm.createTable('audit_decisions', {
    organization_id: {type: 'uuid', notNull: true}, mission_id: {type: 'uuid', notNull: true}, id: {type: 'uuid', notNull: true}, revision_id: {type: 'uuid', notNull: true}, revision_digest: {type: 'char(64)', notNull: true},
    auditor_identity_id: {type: 'uuid', notNull: true}, outcome: {type: 'text', notNull: true, check: "outcome IN ('PASS','FAIL','ESCALATE')"}, status: {type: 'text', notNull: true}, digest: {type: 'char(64)', notNull: true}, payload: {type: 'jsonb', notNull: true}, created_at: {type: 'timestamptz', notNull: true}
  }, {constraints: {primaryKey: ['organization_id', 'id'], foreignKeys: [{columns: ['organization_id', 'revision_id'], references: 'governed_artifact_revisions(organization_id,id)', onDelete: 'RESTRICT'}]}});

  pgm.createTable('owner_reviews', {
    organization_id: {type: 'uuid', notNull: true}, mission_id: {type: 'uuid', notNull: true}, id: {type: 'uuid', notNull: true}, revision_id: {type: 'uuid', notNull: true}, revision_digest: {type: 'char(64)', notNull: true},
    decision: {type: 'text', notNull: true}, authority: {type: 'text', notNull: true, check: "authority = 'NON_EXECUTABLE_OWNER_REVIEW'"}, creates_action_grant: {type: 'boolean', notNull: true, default: false, check: 'creates_action_grant = false'}, payload: {type: 'jsonb', notNull: true}, created_at: {type: 'timestamptz', notNull: true}
  }, {constraints: {primaryKey: ['organization_id', 'id'], unique: [['organization_id', 'revision_id']], foreignKeys: [{columns: ['organization_id', 'revision_id'], references: 'governed_artifact_revisions(organization_id,id)', onDelete: 'RESTRICT'}]}});

  pgm.createTable('trace_events', {
    organization_id: {type: 'uuid', notNull: true}, mission_id: {type: 'uuid', notNull: true}, id: {type: 'uuid', notNull: true}, sequence: {type: 'integer', notNull: true}, kind: {type: 'text', notNull: true}, payload: {type: 'jsonb', notNull: true}, created_at: {type: 'timestamptz', notNull: true}
  }, {constraints: {primaryKey: ['organization_id', 'id'], unique: [['organization_id', 'mission_id', 'sequence']], foreignKeys: [{columns: ['organization_id', 'mission_id'], references: 'missions(organization_id,id)', onDelete: 'CASCADE'}]}});
  pgm.createTable('ledger_entries', {
    organization_id: {type: 'uuid', notNull: true}, mission_id: {type: 'uuid', notNull: true}, id: {type: 'uuid', notNull: true}, sequence: {type: 'integer', notNull: true}, entry_digest: {type: 'char(64)', notNull: true}, previous_entry_digest: {type: 'char(64)'}, payload: {type: 'jsonb', notNull: true}, created_at: {type: 'timestamptz', notNull: true}
  }, {constraints: {primaryKey: ['organization_id', 'id'], unique: [['organization_id', 'mission_id', 'sequence']], foreignKeys: [{columns: ['organization_id', 'mission_id'], references: 'missions(organization_id,id)', onDelete: 'CASCADE'}]}});
  pgm.createTable('model_calls', {
    organization_id: {type: 'uuid', notNull: true}, mission_id: {type: 'uuid', notNull: true}, id: {type: 'uuid', notNull: true}, provider: {type: 'text', notNull: true}, model: {type: 'text', notNull: true}, input_digest: {type: 'char(64)', notNull: true}, output_digest: {type: 'char(64)'}, payload: {type: 'jsonb', notNull: true}, created_at: {type: 'timestamptz', notNull: true}
  }, {constraints: {primaryKey: ['organization_id', 'id'], foreignKeys: [{columns: ['organization_id', 'mission_id'], references: 'missions(organization_id,id)', onDelete: 'CASCADE'}]}});
  pgm.createTable('media_assets', {
    organization_id: {type: 'uuid', notNull: true}, mission_id: {type: 'uuid', notNull: true}, id: {type: 'uuid', notNull: true}, content_digest: {type: 'char(64)', notNull: true}, provider: {type: 'text', notNull: true}, approval_state: {type: 'text', notNull: true, check: "approval_state = 'UNREVIEWED'"}, payload: {type: 'jsonb', notNull: true}, created_at: {type: 'timestamptz', notNull: true}
  }, {constraints: {primaryKey: ['organization_id', 'id'], unique: [['organization_id', 'content_digest']], foreignKeys: [{columns: ['organization_id', 'mission_id'], references: 'missions(organization_id,id)', onDelete: 'CASCADE'}]}});
  pgm.createTable('shadow_idempotency', {
    organization_id: {type: 'uuid', notNull: true}, route: {type: 'text', notNull: true}, idempotency_key: {type: 'text', notNull: true}, request_digest: {type: 'char(64)', notNull: true}, mission_id: {type: 'uuid', notNull: true}, response_version: {type: 'integer', notNull: true}, response_etag: {type: 'text', notNull: true}, response_code: {type: 'text', notNull: true, default: 'MISSION_CHECKPOINT'}, created_at: {type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp')}
  }, {constraints: {primaryKey: ['organization_id', 'route', 'idempotency_key'], foreignKeys: [{columns: ['organization_id', 'mission_id'], references: 'missions(organization_id,id)', onDelete: 'CASCADE'}]}});

  pgm.sql(`CREATE FUNCTION reject_governed_history_mutation() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'GOVERNED_HISTORY_IMMUTABLE'; END; $$ LANGUAGE plpgsql`);
  for (const table of ['governed_artifact_revisions', 'audit_decisions', 'trace_events', 'ledger_entries', 'owner_reviews', 'shadow_idempotency']) pgm.sql(`CREATE TRIGGER ${table}_immutable BEFORE UPDATE OR DELETE ON ${table} FOR EACH ROW EXECUTE FUNCTION reject_governed_history_mutation()`);
};

exports.down = (pgm) => {
  for (const table of ['shadow_idempotency', 'owner_reviews', 'ledger_entries', 'trace_events', 'audit_decisions', 'governed_artifact_revisions']) pgm.sql(`DROP TRIGGER IF EXISTS ${table}_immutable ON ${table}`);
  pgm.dropFunction('reject_governed_history_mutation', [], {ifExists: true});
  for (const table of ['shadow_idempotency', 'media_assets', 'model_calls', 'ledger_entries', 'trace_events', 'owner_reviews', 'audit_decisions', 'governed_artifact_revisions', 'agent_tasks', 'skill_locks', 'agent_runs', 'missions']) pgm.dropTable(table, {ifExists: true});
};
