exports.up = (pgm) => {
  pgm.createTable('campaigns', {
    organization_id: {type: 'uuid', notNull: true}, id: {type: 'uuid', notNull: true},
    version: {type: 'integer', notNull: true, check: 'version >= 1'},
    digest: {type: 'char(64)', notNull: true}, etag: {type: 'text', notNull: true},
    readiness: {type: 'text', notNull: true, check: "readiness IN ('SAVED','BLOCKED','NEEDS_OWNER')"},
    gap_codes: {type: 'jsonb', notNull: true, default: '[]'},
    document: {type: 'jsonb', notNull: true},
    created_at: {type: 'timestamptz', notNull: true}, updated_at: {type: 'timestamptz', notNull: true}
  }, {constraints: {primaryKey: ['organization_id', 'id'], foreignKeys: [{columns: 'organization_id', references: 'organizations', onDelete: 'CASCADE'}]}});

  pgm.createTable('campaign_snapshots', {
    organization_id: {type: 'uuid', notNull: true}, campaign_id: {type: 'uuid', notNull: true}, version: {type: 'integer', notNull: true},
    digest: {type: 'char(64)', notNull: true}, document: {type: 'jsonb', notNull: true}, created_at: {type: 'timestamptz', notNull: true}
  }, {constraints: {primaryKey: ['organization_id', 'campaign_id', 'version'], foreignKeys: [{columns: ['organization_id', 'campaign_id'], references: 'campaigns(organization_id,id)', onDelete: 'CASCADE'}]}});

  pgm.createTable('evidence_refs', {
    organization_id: {type: 'uuid', notNull: true}, id: {type: 'uuid', notNull: true}, campaign_id: {type: 'uuid', notNull: true},
    content_digest: {type: 'char(64)', notNull: true}, payload: {type: 'jsonb', notNull: true}, created_at: {type: 'timestamptz', notNull: true}
  }, {constraints: {primaryKey: ['organization_id', 'id'], foreignKeys: [{columns: ['organization_id', 'campaign_id'], references: 'campaigns(organization_id,id)', onDelete: 'CASCADE'}]}});

  pgm.createTable('claims', {
    organization_id: {type: 'uuid', notNull: true}, id: {type: 'uuid', notNull: true}, campaign_id: {type: 'uuid', notNull: true},
    version: {type: 'integer', notNull: true}, status: {type: 'text', notNull: true, check: "status IN ('DRAFT','APPROVED','STALE','REVOKED')"},
    subject_id: {type: 'uuid', notNull: true}, effective_from: {type: 'timestamptz', notNull: true}, effective_until: {type: 'timestamptz', notNull: true},
    payload: {type: 'jsonb', notNull: true}, created_at: {type: 'timestamptz', notNull: true}
  }, {constraints: {primaryKey: ['organization_id', 'id', 'version'], check: 'effective_until > effective_from', foreignKeys: [
    {columns: ['organization_id', 'campaign_id'], references: 'campaigns(organization_id,id)', onDelete: 'CASCADE'},
    {columns: ['organization_id', 'subject_id'], references: 'products(organization_id,id)'}
  ]}});

  pgm.createTable('capability_snapshots', {
    organization_id: {type: 'uuid', notNull: true}, id: {type: 'uuid', notNull: true}, campaign_id: {type: 'uuid', notNull: true},
    channel_account_id: {type: 'uuid', notNull: true}, platform: {type: 'text', notNull: true}, captured_at: {type: 'timestamptz', notNull: true},
    expires_at: {type: 'timestamptz', notNull: true}, payload: {type: 'jsonb', notNull: true}
  }, {constraints: {primaryKey: ['organization_id', 'id'], check: 'expires_at > captured_at', foreignKeys: [
    {columns: ['organization_id', 'campaign_id'], references: 'campaigns(organization_id,id)', onDelete: 'CASCADE'},
    {columns: ['organization_id', 'channel_account_id'], references: 'channel_accounts(organization_id,id)'}
  ]}});

  pgm.createTable('artifact_revisions', {
    organization_id: {type: 'uuid', notNull: true}, id: {type: 'uuid', notNull: true}, campaign_id: {type: 'uuid', notNull: true},
    activation_unit_id: {type: 'uuid', notNull: true}, platform: {type: 'text', notNull: true}, revision: {type: 'integer', notNull: true, check: 'revision >= 1'},
    digest: {type: 'char(64)', notNull: true}, payload: {type: 'jsonb', notNull: true}, created_at: {type: 'timestamptz', notNull: true}
  }, {constraints: {primaryKey: ['organization_id', 'id'], foreignKeys: [
    {columns: ['organization_id', 'campaign_id'], references: 'campaigns(organization_id,id)', onDelete: 'CASCADE'}
  ]}});
  pgm.addConstraint('artifact_revisions', 'artifact_revision_unit_version_unique', {unique: ['organization_id', 'campaign_id', 'activation_unit_id', 'revision']});

  pgm.createTable('idempotency_records', {
    organization_id: {type: 'uuid', notNull: true}, method: {type: 'text', notNull: true}, route: {type: 'text', notNull: true},
    idempotency_key: {type: 'text', notNull: true}, request_digest: {type: 'char(64)', notNull: true},
    status_code: {type: 'integer', notNull: true}, response_body: {type: 'jsonb', notNull: true}, response_etag: {type: 'text'},
    created_at: {type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp')}, expires_at: {type: 'timestamptz', notNull: true}
  }, {constraints: {primaryKey: ['organization_id', 'method', 'route', 'idempotency_key'], foreignKeys: [{columns: 'organization_id', references: 'organizations', onDelete: 'CASCADE'}]}});
  pgm.createIndex('idempotency_records', ['expires_at']);
};

exports.down = (pgm) => {
  pgm.dropTable('idempotency_records');
  pgm.dropTable('artifact_revisions');
  pgm.dropTable('capability_snapshots');
  pgm.dropTable('claims');
  pgm.dropTable('evidence_refs');
  pgm.dropTable('campaign_snapshots');
  pgm.dropTable('campaigns');
};
