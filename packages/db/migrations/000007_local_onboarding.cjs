exports.up = (pgm) => {
  pgm.createTable('local_owner_profiles', {
    id: {type: 'uuid', primaryKey: true},
    singleton_key: {type: 'boolean', notNull: true, default: true, unique: true, check: 'singleton_key = true'},
    schema_version: {type: 'integer', notNull: true, default: 1, check: 'schema_version = 1'},
    display_name: {type: 'text', notNull: true, check: 'char_length(display_name) BETWEEN 1 AND 64'},
    state: {type: 'text', notNull: true, check: "state IN ('PROFILE_READY','ONBOARDING_COMPLETE')"},
    created_at: {type: 'timestamptz', notNull: true},
    updated_at: {type: 'timestamptz', notNull: true}
  });

  pgm.createTable('local_onboarding_sessions', {
    owner_profile_id: {type: 'uuid', primaryKey: true, references: 'local_owner_profiles', onDelete: 'CASCADE'},
    schema_version: {type: 'integer', notNull: true, default: 1, check: 'schema_version = 1'},
    path: {type: 'text', notNull: true, check: "path IN ('UNSELECTED','PUBLIC_SAFE_EXAMPLE','LOCAL_MATERIALS')"},
    state: {type: 'text', notNull: true, check: "state IN ('MATERIAL_CHOICE','MATERIALS_READY','CONTEXT_READY','COMPLETED')"},
    data_mode: {type: 'text', notNull: true, check: "data_mode IN ('LOCAL_PRIVATE','PUBLIC_SAFE_EXAMPLE')"},
    organization_id: {type: 'uuid'},
    campaign_id: {type: 'uuid'},
    market_code: {type: 'text'},
    content_locale: {type: 'text'},
    platform: {type: 'text'},
    time_zone: {type: 'text'},
    material_ids: {type: 'jsonb', notNull: true, default: '[]'},
    created_at: {type: 'timestamptz', notNull: true},
    updated_at: {type: 'timestamptz', notNull: true}
  });

  pgm.addConstraint('local_onboarding_sessions', 'local_onboarding_campaign_scope_fk', {
    foreignKeys: {columns: ['organization_id', 'campaign_id'], references: 'campaigns(organization_id,id)', onDelete: 'RESTRICT'}
  });
  pgm.addConstraint('local_onboarding_sessions', 'local_onboarding_context_complete', {
    check: "state <> 'COMPLETED' OR (organization_id IS NOT NULL AND campaign_id IS NOT NULL AND market_code IS NOT NULL AND content_locale IS NOT NULL AND platform IS NOT NULL AND time_zone IS NOT NULL)"
  });

  pgm.createTable('local_material_manifests', {
    owner_profile_id: {type: 'uuid', notNull: true, references: 'local_owner_profiles', onDelete: 'CASCADE'},
    id: {type: 'uuid', notNull: true},
    schema_version: {type: 'integer', notNull: true, default: 1, check: 'schema_version = 1'},
    file_name: {type: 'text', notNull: true},
    media_type: {type: 'text', notNull: true, check: "media_type IN ('text/markdown','text/plain')"},
    byte_size: {type: 'integer', notNull: true, check: 'byte_size > 0 AND byte_size <= 2097152'},
    digest: {type: 'char(64)', notNull: true},
    state: {type: 'text', notNull: true, check: "state IN ('READY','UNSUPPORTED','REJECTED','FAILED')"},
    extracted_text: {type: 'text'},
    failure_code: {type: 'text'},
    blob_ref: {type: 'jsonb'},
    created_at: {type: 'timestamptz', notNull: true},
    updated_at: {type: 'timestamptz', notNull: true}
  }, {constraints: {primaryKey: ['owner_profile_id', 'id']}});
  pgm.addConstraint('local_material_manifests', 'local_material_owner_digest_unique', {unique: ['owner_profile_id', 'digest']});

  pgm.createTable('manual_publish_handoffs', {
    owner_profile_id: {type: 'uuid', notNull: true, references: 'local_owner_profiles', onDelete: 'CASCADE'},
    id: {type: 'uuid', notNull: true},
    schema_version: {type: 'integer', notNull: true, default: 1, check: 'schema_version = 1'},
    campaign_id: {type: 'uuid', notNull: true},
    artifact_revision_id: {type: 'uuid', notNull: true},
    platform: {type: 'text', notNull: true},
    action: {type: 'text', notNull: true, check: "action IN ('COPY_BODY','DOWNLOAD_MEDIA','OPEN_OFFICIAL_PAGE','OWNER_REPORTED_COMPLETE')"},
    state: {type: 'text', notNull: true, check: "state = 'AWAITING_RECONCILIATION'"},
    evidence_receipt_id: {type: 'uuid'},
    created_at: {type: 'timestamptz', notNull: true}
  }, {constraints: {primaryKey: ['owner_profile_id', 'id'], foreignKeys: [{columns: ['owner_profile_id'], references: 'local_owner_profiles(id)', onDelete: 'CASCADE'}]}});
  pgm.createIndex('manual_publish_handoffs', ['owner_profile_id', 'campaign_id', 'created_at']);
};

exports.down = (pgm) => {
  pgm.dropTable('manual_publish_handoffs');
  pgm.dropTable('local_material_manifests');
  pgm.dropTable('local_onboarding_sessions');
  pgm.dropTable('local_owner_profiles');
};
