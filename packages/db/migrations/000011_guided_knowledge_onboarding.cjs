exports.up = (pgm) => {
  pgm.addColumns('local_onboarding_sessions', {
    knowledge_state: {type: 'text', notNull: true, default: 'DRAFT'},
    current_step: {type: 'text', notNull: true, default: 'PERSONA'},
    row_version: {type: 'integer', notNull: true, default: 1},
    target_market: {type: 'text'},
    knowledge_content_locale: {type: 'text'},
    knowledge_time_zone: {type: 'text'},
    current_knowledge_snapshot_id: {type: 'uuid'},
    current_knowledge_snapshot_digest: {type: 'char(64)'}
  });
  pgm.addConstraint('local_onboarding_sessions', 'local_onboarding_knowledge_state_check', {check: "knowledge_state IN ('DRAFT','NEEDS_OWNER_DECISION','READY_FOR_APPROVAL','KNOWLEDGE_APPROVED_NEEDS_GOAL')"});
  pgm.addConstraint('local_onboarding_sessions', 'local_onboarding_current_step_check', {check: "current_step IN ('PERSONA','ORGANIZATION_PRODUCT','SOURCES','X_ACCOUNT','XIAOHONGSHU_ACCOUNT','MARKET_CONTEXT','REVIEW')"});
  pgm.addConstraint('local_onboarding_sessions', 'local_onboarding_row_version_check', {check: 'row_version > 0'});
  pgm.addConstraint('local_onboarding_sessions', 'local_onboarding_current_snapshot_pair', {check: '(current_knowledge_snapshot_id IS NULL) = (current_knowledge_snapshot_digest IS NULL)'});

  pgm.createTable('source_documents', {
    owner_profile_id: {type: 'uuid', notNull: true, references: 'local_owner_profiles', onDelete: 'RESTRICT'},
    id: {type: 'uuid', notNull: true},
    source_kind: {type: 'text', notNull: true, check: "source_kind IN ('UPLOADED_FILE','OWNER_AUTHORED_TEXT','LEGACY_LOCAL_MATERIAL','PUBLIC_SAFE_EXAMPLE')"},
    label: {type: 'text', notNull: true},
    sensitivity: {type: 'text', notNull: true, check: "sensitivity IN ('LOCAL_PRIVATE','PUBLIC_SAFE')"},
    created_at: {type: 'timestamptz', notNull: true},
    deleted_at: {type: 'timestamptz'}
  }, {constraints: {primaryKey: ['owner_profile_id', 'id']}});

  pgm.createTable('source_document_revisions', {
    owner_profile_id: {type: 'uuid', notNull: true},
    id: {type: 'uuid', notNull: true},
    document_id: {type: 'uuid', notNull: true},
    version: {type: 'integer', notNull: true, check: 'version > 0'},
    source_kind: {type: 'text', notNull: true, check: "source_kind IN ('UPLOADED_FILE','OWNER_AUTHORED_TEXT','LEGACY_LOCAL_MATERIAL','PUBLIC_SAFE_EXAMPLE')"},
    label: {type: 'text', notNull: true},
    file_name: {type: 'text'},
    media_type: {type: 'text', notNull: true, check: "media_type IN ('text/markdown','text/plain')"},
    byte_size: {type: 'integer', notNull: true, check: 'byte_size > 0 AND byte_size <= 2097152'},
    blob_digest: {type: 'char(64)', notNull: true, check: "blob_digest ~ '^[a-f0-9]{64}$'"},
    blob_ref: {type: 'jsonb', notNull: true},
    extracted_text_digest: {type: 'char(64)', notNull: true, check: "extracted_text_digest ~ '^[a-f0-9]{64}$'"},
    extracted_text: {type: 'text', notNull: true},
    candidate_items: {type: 'jsonb', notNull: true, default: '[]'},
    status: {type: 'text', notNull: true, check: "status IN ('READY','LEGACY_NEEDS_REVIEW','BLOB_MISSING')"},
    sensitivity: {type: 'text', notNull: true, check: "sensitivity IN ('LOCAL_PRIVATE','PUBLIC_SAFE')"},
    created_at: {type: 'timestamptz', notNull: true}
  }, {constraints: {primaryKey: ['owner_profile_id', 'id'], unique: ['owner_profile_id', 'document_id', 'version'], foreignKeys: [{columns: ['owner_profile_id', 'document_id'], references: 'source_documents(owner_profile_id,id)', onDelete: 'RESTRICT'}]}});
  pgm.createIndex('source_document_revisions', ['owner_profile_id', 'document_id', 'version']);

  pgm.createTable('knowledge_profile_revisions', {
    owner_profile_id: {type: 'uuid', notNull: true, references: 'local_owner_profiles', onDelete: 'RESTRICT'},
    id: {type: 'uuid', notNull: true},
    kind: {type: 'text', notNull: true, check: "kind IN ('PERSONA','ORGANIZATION','PRODUCT','ACCOUNT')"},
    platform_code: {type: 'text', check: "platform_code IS NULL OR platform_code IN ('X','XIAOHONGSHU')"},
    version: {type: 'integer', notNull: true, check: 'version > 0'},
    digest: {type: 'char(64)', notNull: true, check: "digest ~ '^[a-f0-9]{64}$'"},
    payload: {type: 'jsonb', notNull: true},
    created_at: {type: 'timestamptz', notNull: true}
  }, {constraints: {primaryKey: ['owner_profile_id', 'id']}});
  pgm.addConstraint('knowledge_profile_revisions', 'knowledge_profile_platform_shape', {check: "(kind = 'ACCOUNT' AND platform_code IS NOT NULL) OR (kind <> 'ACCOUNT' AND platform_code IS NULL)"});
  pgm.createIndex('knowledge_profile_revisions', ['owner_profile_id', 'kind', 'platform_code', 'version'], {unique: true});

  pgm.createTable('knowledge_items', {
    owner_profile_id: {type: 'uuid', notNull: true, references: 'local_owner_profiles', onDelete: 'RESTRICT'},
    id: {type: 'uuid', notNull: true},
    kind: {type: 'text', notNull: true, check: "kind IN ('PERSONA','ORGANIZATION_FACT','PRODUCT_FACT','CLAIM','EVIDENCE','ACCOUNT_PROFILE','SOURCE_EXCERPT')"},
    normalized_value: {type: 'text', notNull: true},
    source_revision_id: {type: 'uuid'},
    profile_revision_id: {type: 'uuid'},
    owner_authority: {type: 'text', notNull: true, check: "owner_authority IN ('CAMPAIGN_EXPLICIT','ORGANIZATION_APPROVED_PRIVATE','PUBLIC_MARKET_PACK','MODEL_PRIOR_SUGGESTION')"},
    sensitivity: {type: 'text', notNull: true, check: "sensitivity IN ('LOCAL_PRIVATE','PUBLIC_SAFE')"},
    created_at: {type: 'timestamptz', notNull: true}
  }, {constraints: {primaryKey: ['owner_profile_id', 'id']}});
  pgm.addConstraint('knowledge_items', 'knowledge_item_binding_required', {check: '(source_revision_id IS NOT NULL) <> (profile_revision_id IS NOT NULL)'});
  pgm.addConstraint('knowledge_items', 'knowledge_item_source_revision_fk', {foreignKeys: {columns: ['owner_profile_id', 'source_revision_id'], references: 'source_document_revisions(owner_profile_id,id)', onDelete: 'RESTRICT'}});
  pgm.addConstraint('knowledge_items', 'knowledge_item_profile_revision_fk', {foreignKeys: {columns: ['owner_profile_id', 'profile_revision_id'], references: 'knowledge_profile_revisions(owner_profile_id,id)', onDelete: 'RESTRICT'}});

  pgm.createTable('knowledge_item_source_bindings', {
    owner_profile_id: {type: 'uuid', notNull: true},
    knowledge_item_id: {type: 'uuid', notNull: true},
    source_revision_id: {type: 'uuid', notNull: true}
  }, {constraints: {primaryKey: ['owner_profile_id', 'knowledge_item_id', 'source_revision_id'], foreignKeys: [{columns: ['owner_profile_id', 'knowledge_item_id'], references: 'knowledge_items(owner_profile_id,id)', onDelete: 'RESTRICT'}, {columns: ['owner_profile_id', 'source_revision_id'], references: 'source_document_revisions(owner_profile_id,id)', onDelete: 'RESTRICT'}]}});

  pgm.createTable('knowledge_conflict_resolutions', {
    owner_profile_id: {type: 'uuid', notNull: true, references: 'local_owner_profiles', onDelete: 'RESTRICT'},
    conflict_key: {type: 'char(64)', notNull: true, check: "conflict_key ~ '^[a-f0-9]{64}$'"},
    selected_item_id: {type: 'uuid', notNull: true},
    note: {type: 'text', notNull: true},
    resolved_at: {type: 'timestamptz', notNull: true}
  }, {constraints: {primaryKey: ['owner_profile_id', 'conflict_key'], foreignKeys: [{columns: ['owner_profile_id', 'selected_item_id'], references: 'knowledge_items(owner_profile_id,id)', onDelete: 'RESTRICT'}]}});

  pgm.createTable('knowledge_snapshots', {
    owner_profile_id: {type: 'uuid', notNull: true, references: 'local_owner_profiles', onDelete: 'RESTRICT'},
    id: {type: 'uuid', notNull: true},
    version: {type: 'integer', notNull: true, check: 'version > 0'},
    state: {type: 'text', notNull: true, check: "state IN ('DRAFT','NEEDS_OWNER','APPROVED','SUPERSEDED')"},
    session_row_version: {type: 'integer', notNull: true, check: 'session_row_version > 0'},
    canonical_digest: {type: 'char(64)', notNull: true, check: "canonical_digest ~ '^[a-f0-9]{64}$'"},
    source_revision_digests: {type: 'jsonb', notNull: true},
    profile_revision_digests: {type: 'jsonb', notNull: true},
    item_bindings: {type: 'jsonb', notNull: true},
    conflict_decisions: {type: 'jsonb', notNull: true},
    gaps: {type: 'jsonb', notNull: true},
    approved_by: {type: 'uuid'},
    approved_at: {type: 'timestamptz'},
    created_at: {type: 'timestamptz', notNull: true}
  }, {constraints: {primaryKey: ['owner_profile_id', 'id'], unique: ['owner_profile_id', 'version']}});
  pgm.addConstraint('knowledge_snapshots', 'knowledge_snapshot_approval_shape', {check: "(state = 'APPROVED' AND approved_by IS NOT NULL AND approved_at IS NOT NULL) OR (state <> 'APPROVED')"});
  pgm.addConstraint('knowledge_snapshots', 'knowledge_snapshot_approver_fk', {foreignKeys: {columns: ['approved_by'], references: 'local_owner_profiles(id)', onDelete: 'RESTRICT'}});
  pgm.addConstraint('local_onboarding_sessions', 'local_onboarding_current_snapshot_fk', {foreignKeys: {columns: ['owner_profile_id', 'current_knowledge_snapshot_id'], references: 'knowledge_snapshots(owner_profile_id,id)', onDelete: 'RESTRICT'}});

  pgm.createTable('knowledge_snapshot_source_bindings', {
    owner_profile_id: {type: 'uuid', notNull: true},
    snapshot_id: {type: 'uuid', notNull: true},
    source_revision_id: {type: 'uuid', notNull: true},
    source_digest: {type: 'char(64)', notNull: true, check: "source_digest ~ '^[a-f0-9]{64}$'"}
  }, {constraints: {primaryKey: ['owner_profile_id', 'snapshot_id', 'source_revision_id'], foreignKeys: [{columns: ['owner_profile_id', 'snapshot_id'], references: 'knowledge_snapshots(owner_profile_id,id)', onDelete: 'RESTRICT'}, {columns: ['owner_profile_id', 'source_revision_id'], references: 'source_document_revisions(owner_profile_id,id)', onDelete: 'RESTRICT'}]}});

  pgm.createTable('knowledge_idempotency_records', {
    owner_profile_id: {type: 'uuid', notNull: true, references: 'local_owner_profiles', onDelete: 'CASCADE'},
    route: {type: 'text', notNull: true},
    idempotency_key: {type: 'text', notNull: true},
    request_digest: {type: 'char(64)', notNull: true, check: "request_digest ~ '^[a-f0-9]{64}$'"},
    response_body: {type: 'jsonb', notNull: true},
    created_at: {type: 'timestamptz', notNull: true}
  }, {constraints: {primaryKey: ['owner_profile_id', 'route', 'idempotency_key']}});

  pgm.createTable('knowledge_audit_events', {
    owner_profile_id: {type: 'uuid', notNull: true, references: 'local_owner_profiles', onDelete: 'RESTRICT'},
    id: {type: 'uuid', notNull: true},
    event_code: {type: 'text', notNull: true},
    target_type: {type: 'text', notNull: true},
    target_id: {type: 'uuid'},
    redacted_metadata: {type: 'jsonb', notNull: true, default: '{}'},
    created_at: {type: 'timestamptz', notNull: true}
  }, {constraints: {primaryKey: ['owner_profile_id', 'id']}});

  pgm.sql(`
    CREATE FUNCTION reject_knowledge_revision_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'KNOWLEDGE_REVISION_IMMUTABLE'; END $$;
    CREATE TRIGGER source_document_revisions_immutable BEFORE UPDATE OR DELETE ON source_document_revisions FOR EACH ROW EXECUTE FUNCTION reject_knowledge_revision_mutation();
    CREATE TRIGGER knowledge_profile_revisions_immutable BEFORE UPDATE OR DELETE ON knowledge_profile_revisions FOR EACH ROW EXECUTE FUNCTION reject_knowledge_revision_mutation();
    CREATE TRIGGER knowledge_snapshot_source_bindings_immutable BEFORE UPDATE OR DELETE ON knowledge_snapshot_source_bindings FOR EACH ROW EXECUTE FUNCTION reject_knowledge_revision_mutation();

    CREATE FUNCTION protect_knowledge_snapshot_payload() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'KNOWLEDGE_SNAPSHOT_IMMUTABLE';
      END IF;
      IF OLD.owner_profile_id <> NEW.owner_profile_id OR OLD.id <> NEW.id OR OLD.version <> NEW.version OR OLD.session_row_version <> NEW.session_row_version OR OLD.canonical_digest <> NEW.canonical_digest OR OLD.source_revision_digests <> NEW.source_revision_digests OR OLD.profile_revision_digests <> NEW.profile_revision_digests OR OLD.item_bindings <> NEW.item_bindings OR OLD.conflict_decisions <> NEW.conflict_decisions OR OLD.gaps <> NEW.gaps OR OLD.created_at <> NEW.created_at THEN
        RAISE EXCEPTION 'KNOWLEDGE_SNAPSHOT_PAYLOAD_IMMUTABLE';
      END IF;
      IF OLD.state IN ('DRAFT','NEEDS_OWNER') AND NEW.state = 'APPROVED' THEN
        IF NEW.approved_by IS NULL OR NEW.approved_at IS NULL THEN RAISE EXCEPTION 'KNOWLEDGE_SNAPSHOT_APPROVAL_INVALID'; END IF;
      ELSIF OLD.state IN ('DRAFT','NEEDS_OWNER') AND NEW.state = 'SUPERSEDED' THEN
        IF NEW.approved_by IS NOT NULL OR NEW.approved_at IS NOT NULL THEN RAISE EXCEPTION 'KNOWLEDGE_SNAPSHOT_APPROVAL_INVALID'; END IF;
      ELSIF OLD.state = 'APPROVED' AND NEW.state = 'SUPERSEDED' THEN
        IF NEW.approved_by IS DISTINCT FROM OLD.approved_by OR NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN RAISE EXCEPTION 'KNOWLEDGE_SNAPSHOT_APPROVAL_IMMUTABLE'; END IF;
      ELSE
        RAISE EXCEPTION 'KNOWLEDGE_SNAPSHOT_STATE_TRANSITION_INVALID';
      END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER knowledge_snapshot_payload_immutable BEFORE UPDATE OR DELETE ON knowledge_snapshots FOR EACH ROW EXECUTE FUNCTION protect_knowledge_snapshot_payload();

    INSERT INTO source_documents (owner_profile_id,id,source_kind,label,sensitivity,created_at,deleted_at)
      SELECT owner_profile_id,id,'LEGACY_LOCAL_MATERIAL',file_name,'LOCAL_PRIVATE',created_at,NULL FROM local_material_manifests
      ON CONFLICT DO NOTHING;
    INSERT INTO source_document_revisions (owner_profile_id,id,document_id,version,source_kind,label,file_name,media_type,byte_size,blob_digest,blob_ref,extracted_text_digest,extracted_text,candidate_items,status,sensitivity,created_at)
      SELECT owner_profile_id,id,id,1,'LEGACY_LOCAL_MATERIAL',file_name,file_name,media_type,byte_size,digest,blob_ref,digest,COALESCE(extracted_text,''),'[]'::jsonb,'LEGACY_NEEDS_REVIEW','LOCAL_PRIVATE',created_at
      FROM local_material_manifests WHERE state = 'READY' AND blob_ref IS NOT NULL
      ON CONFLICT DO NOTHING;
    INSERT INTO knowledge_items (owner_profile_id,id,kind,normalized_value,source_revision_id,profile_revision_id,owner_authority,sensitivity,created_at)
      SELECT owner_profile_id,id,'SOURCE_EXCERPT',extracted_text,id,NULL,'ORGANIZATION_APPROVED_PRIVATE','LOCAL_PRIVATE',created_at
      FROM local_material_manifests WHERE state = 'READY' AND blob_ref IS NOT NULL AND extracted_text IS NOT NULL
      ON CONFLICT DO NOTHING;
    INSERT INTO knowledge_item_source_bindings (owner_profile_id,knowledge_item_id,source_revision_id)
      SELECT owner_profile_id,id,id FROM local_material_manifests WHERE state = 'READY' AND blob_ref IS NOT NULL AND extracted_text IS NOT NULL
      ON CONFLICT DO NOTHING;
    UPDATE local_onboarding_sessions s SET
      current_step = CASE WHEN EXISTS (SELECT 1 FROM source_documents d WHERE d.owner_profile_id=s.owner_profile_id) THEN 'SOURCES' ELSE 'PERSONA' END,
      target_market = COALESCE((s.market_codes->>0), s.market_code),
      knowledge_content_locale = COALESCE((s.content_locales->>0), s.content_locale),
      knowledge_time_zone = COALESCE(s.default_time_zone, s.time_zone),
      knowledge_state = 'DRAFT', row_version = 1;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DO $$
    BEGIN
      IF (SELECT
        (SELECT count(*) FROM source_documents) +
        (SELECT count(*) FROM source_document_revisions) +
        (SELECT count(*) FROM knowledge_profile_revisions) +
        (SELECT count(*) FROM knowledge_items) +
        (SELECT count(*) FROM knowledge_item_source_bindings) +
        (SELECT count(*) FROM knowledge_conflict_resolutions) +
        (SELECT count(*) FROM knowledge_snapshots) +
        (SELECT count(*) FROM knowledge_snapshot_source_bindings) +
        (SELECT count(*) FROM knowledge_idempotency_records) +
        (SELECT count(*) FROM knowledge_audit_events)
      ) > 0 THEN
        RAISE EXCEPTION 'SDD008_DOWN_BLOCKED_DATA_EXPORT_AND_OWNER_DECISION_REQUIRED';
      END IF;
    END $$;
  `);
  pgm.sql('DROP TRIGGER IF EXISTS knowledge_snapshot_payload_immutable ON knowledge_snapshots; DROP FUNCTION IF EXISTS protect_knowledge_snapshot_payload(); DROP TRIGGER IF EXISTS knowledge_snapshot_source_bindings_immutable ON knowledge_snapshot_source_bindings; DROP TRIGGER IF EXISTS knowledge_profile_revisions_immutable ON knowledge_profile_revisions; DROP TRIGGER IF EXISTS source_document_revisions_immutable ON source_document_revisions; DROP FUNCTION IF EXISTS reject_knowledge_revision_mutation();');
  pgm.dropConstraint('local_onboarding_sessions', 'local_onboarding_current_snapshot_fk');
  pgm.dropTable('knowledge_audit_events');
  pgm.dropTable('knowledge_idempotency_records');
  pgm.dropTable('knowledge_snapshot_source_bindings');
  pgm.dropTable('knowledge_snapshots');
  pgm.dropTable('knowledge_conflict_resolutions');
  pgm.dropTable('knowledge_item_source_bindings');
  pgm.dropTable('knowledge_items');
  pgm.dropTable('knowledge_profile_revisions');
  pgm.dropTable('source_document_revisions');
  pgm.dropTable('source_documents');
  pgm.dropConstraint('local_onboarding_sessions', 'local_onboarding_current_snapshot_pair');
  pgm.dropConstraint('local_onboarding_sessions', 'local_onboarding_row_version_check');
  pgm.dropConstraint('local_onboarding_sessions', 'local_onboarding_current_step_check');
  pgm.dropConstraint('local_onboarding_sessions', 'local_onboarding_knowledge_state_check');
  pgm.dropColumns('local_onboarding_sessions', ['knowledge_state','current_step','row_version','target_market','knowledge_content_locale','knowledge_time_zone','current_knowledge_snapshot_id','current_knowledge_snapshot_digest']);
};
