exports.up = (pgm) => {
  pgm.createTable('knowledge_snapshot_context_bindings_v2', {
    owner_profile_id:{type:'uuid',notNull:true},snapshot_id:{type:'uuid',notNull:true},schema_version:{type:'integer',notNull:true,default:2,check:'schema_version = 2'},target_market:{type:'text',notNull:true},content_locale:{type:'text',notNull:true},time_zone:{type:'text',notNull:true},context_digest:{type:'char(64)',notNull:true,check:"context_digest ~ '^[a-f0-9]{64}$'"},created_at:{type:'timestamptz',notNull:true}
  }, {constraints:{primaryKey:['owner_profile_id','snapshot_id'],foreignKeys:[{columns:['owner_profile_id','snapshot_id'],references:'knowledge_snapshots(owner_profile_id,id)',onDelete:'RESTRICT'}]}});
  pgm.createTable('knowledge_snapshot_supersession_outbox_v2', {
    owner_profile_id:{type:'uuid',notNull:true},event_id:{type:'text',notNull:true},superseded_snapshot_id:{type:'uuid',notNull:true},superseded_snapshot_digest:{type:'char(64)',notNull:true},approved_snapshot_id:{type:'uuid',notNull:true},approved_snapshot_digest:{type:'char(64)',notNull:true},created_at:{type:'timestamptz',notNull:true}
  }, {constraints:{primaryKey:['owner_profile_id','event_id'],unique:['owner_profile_id','superseded_snapshot_id','approved_snapshot_id'],foreignKeys:[{columns:['owner_profile_id','superseded_snapshot_id'],references:'knowledge_snapshots(owner_profile_id,id)',onDelete:'RESTRICT'},{columns:['owner_profile_id','approved_snapshot_id'],references:'knowledge_snapshots(owner_profile_id,id)',onDelete:'RESTRICT'}]}});
  pgm.createTable('knowledge_snapshot_supersession_receipts_v2', {
    owner_profile_id:{type:'uuid',notNull:true},event_id:{type:'text',notNull:true},delivered_at:{type:'timestamptz',notNull:true}
  }, {constraints:{primaryKey:['owner_profile_id','event_id'],foreignKeys:[{columns:['owner_profile_id','event_id'],references:'knowledge_snapshot_supersession_outbox_v2(owner_profile_id,event_id)',onDelete:'RESTRICT'}]}});
  pgm.createTable('operating_goal_revisions', {
    owner_profile_id: {type:'uuid',notNull:true,references:'local_owner_profiles',onDelete:'RESTRICT'},
    goal_id: {type:'text',notNull:true}, revision: {type:'integer',notNull:true,check:'revision > 0'},
    state: {type:'text',notNull:true,check:"state IN ('DRAFT','ACTIVE','PAUSED','SUPERSEDED')"},
    canonical_digest: {type:'char(64)',notNull:true,check:"canonical_digest ~ '^[a-f0-9]{64}$'"},
    parent_digest: {type:'char(64)'}, knowledge_snapshot_id: {type:'uuid',notNull:true}, knowledge_snapshot_digest: {type:'char(64)',notNull:true},
    selected_account_ids: {type:'jsonb',notNull:true}, payload: {type:'jsonb',notNull:true}, created_at: {type:'timestamptz',notNull:true}
  }, {constraints:{primaryKey:['owner_profile_id','goal_id','revision'],unique:['owner_profile_id','goal_id','canonical_digest'],foreignKeys:[{columns:['owner_profile_id','knowledge_snapshot_id'],references:'knowledge_snapshots(owner_profile_id,id)',onDelete:'RESTRICT'}]}});
  pgm.addConstraint('operating_goal_revisions','operating_goal_revision_parent_shape',{check:'(revision = 1 AND parent_digest IS NULL) OR (revision > 1 AND parent_digest IS NOT NULL)'});

  pgm.createTable('operating_goal_heads', {
    owner_profile_id:{type:'uuid',notNull:true,references:'local_owner_profiles',onDelete:'RESTRICT'},goal_id:{type:'text',notNull:true},current_revision:{type:'integer',notNull:true,check:'current_revision > 0'},current_digest:{type:'char(64)',notNull:true},row_version:{type:'integer',notNull:true,check:'row_version > 0'},state:{type:'text',notNull:true,check:"state IN ('DRAFT','ACTIVE','PAUSED','SUPERSEDED')"},updated_at:{type:'timestamptz',notNull:true}
  }, {constraints:{primaryKey:['owner_profile_id','goal_id'],foreignKeys:[{columns:['owner_profile_id','goal_id','current_revision'],references:'operating_goal_revisions(owner_profile_id,goal_id,revision)',onDelete:'RESTRICT'}]}});

  pgm.createTable('operating_goal_account_bindings', {
    owner_profile_id:{type:'uuid',notNull:true},goal_id:{type:'text',notNull:true},goal_revision:{type:'integer',notNull:true},account_profile_revision_id:{type:'uuid',notNull:true},profile_digest:{type:'char(64)',notNull:true,check:"profile_digest ~ '^[a-f0-9]{64}$'"},platform_code:{type:'text',notNull:true,check:"platform_code IN ('X','XIAOHONGSHU')"},producer_mandates:{type:'jsonb',notNull:true}
  }, {constraints:{primaryKey:['owner_profile_id','goal_id','goal_revision','account_profile_revision_id'],foreignKeys:[{columns:['owner_profile_id','goal_id','goal_revision'],references:'operating_goal_revisions(owner_profile_id,goal_id,revision)',onDelete:'RESTRICT'},{columns:['owner_profile_id','account_profile_revision_id'],references:'knowledge_profile_revisions(owner_profile_id,id)',onDelete:'RESTRICT'}]}});

  pgm.createTable('content_plan_revisions_v2', {
    owner_profile_id:{type:'uuid',notNull:true,references:'local_owner_profiles',onDelete:'RESTRICT'},plan_id:{type:'text',notNull:true},revision:{type:'integer',notNull:true,check:'revision > 0'},goal_id:{type:'text',notNull:true},goal_revision:{type:'integer',notNull:true},mission_intent_id:{type:'text',notNull:true},intent_bundle_id:{type:'text',notNull:true},state:{type:'text',notNull:true,check:"state IN ('DRAFT','NEEDS_OWNER','APPROVED','INVALIDATED')"},canonical_digest:{type:'char(64)',notNull:true},parent_digest:{type:'char(64)'},payload:{type:'jsonb',notNull:true},created_at:{type:'timestamptz',notNull:true}
  }, {constraints:{primaryKey:['owner_profile_id','plan_id','revision'],unique:['owner_profile_id','plan_id','canonical_digest'],foreignKeys:[{columns:['owner_profile_id','goal_id','goal_revision'],references:'operating_goal_revisions(owner_profile_id,goal_id,revision)',onDelete:'RESTRICT'}]}});
  pgm.addConstraint('content_plan_revisions_v2','content_plan_revision_parent_shape',{check:'(revision = 1 AND parent_digest IS NULL) OR (revision > 1 AND parent_digest IS NOT NULL)'});

  pgm.createTable('content_plan_heads_v2', {
    owner_profile_id:{type:'uuid',notNull:true,references:'local_owner_profiles',onDelete:'RESTRICT'},plan_id:{type:'text',notNull:true},current_revision:{type:'integer',notNull:true},current_digest:{type:'char(64)',notNull:true},row_version:{type:'integer',notNull:true,check:'row_version > 0'},state:{type:'text',notNull:true,check:"state IN ('DRAFT','NEEDS_OWNER','APPROVED','INVALIDATED')"},updated_at:{type:'timestamptz',notNull:true}
  }, {constraints:{primaryKey:['owner_profile_id','plan_id'],foreignKeys:[{columns:['owner_profile_id','plan_id','current_revision'],references:'content_plan_revisions_v2(owner_profile_id,plan_id,revision)',onDelete:'RESTRICT'}]}});

  pgm.createTable('mission_bundle_generations_v2', {
    owner_profile_id:{type:'uuid',notNull:true,references:'local_owner_profiles',onDelete:'RESTRICT'},bundle_id:{type:'text',notNull:true},mission_intent_id:{type:'text',notNull:true},generation:{type:'integer',notNull:true,check:'generation > 0'},kind:{type:'text',notNull:true,check:"kind IN ('MISSION_INTENT','MISSION_EXECUTION')"},canonical_digest:{type:'char(64)',notNull:true},compiler_version:{type:'text',notNull:true},parent_bundle_id:{type:'text'},goal_id:{type:'text',notNull:true},goal_revision:{type:'integer',notNull:true},goal_digest:{type:'char(64)',notNull:true},plan_id:{type:'text'},plan_revision:{type:'integer'},plan_digest:{type:'char(64)'},payload:{type:'jsonb',notNull:true},created_at:{type:'timestamptz',notNull:true}
  }, {constraints:{primaryKey:['owner_profile_id','bundle_id'],unique:['owner_profile_id','mission_intent_id','generation'],foreignKeys:[{columns:['owner_profile_id','goal_id','goal_revision'],references:'operating_goal_revisions(owner_profile_id,goal_id,revision)',onDelete:'RESTRICT'}]}});
  pgm.addConstraint('mission_bundle_generations_v2','mission_bundle_generation_shape',{check:"(kind = 'MISSION_INTENT' AND ((generation = 1 AND parent_bundle_id IS NULL) OR (generation > 1 AND parent_bundle_id IS NOT NULL)) AND plan_id IS NULL AND plan_revision IS NULL AND plan_digest IS NULL) OR (kind = 'MISSION_EXECUTION' AND generation >= 2 AND parent_bundle_id IS NOT NULL AND plan_id IS NOT NULL AND plan_revision IS NOT NULL AND plan_digest IS NOT NULL)"});

  pgm.createTable('mission_bundle_status_events_v2', {
    owner_profile_id:{type:'uuid',notNull:true},event_id:{type:'text',notNull:true},bundle_id:{type:'text',notNull:true},state:{type:'text',notNull:true,check:"state IN ('INVALIDATED','BLOCKED')"},reason_code:{type:'text',notNull:true,check:"reason_code IN ('KNOWLEDGE_SNAPSHOT_CHANGED','GOAL_REVISION_CHANGED','PLAN_REVISION_CHANGED','ACCOUNT_PROFILE_CHANGED','MISSION_INPUT_CHANGED')"},previous_digest:{type:'char(64)',notNull:true},current_digest:{type:'char(64)',notNull:true},recovery_action:{type:'text',notNull:true,check:"recovery_action = 'REVIEW_AND_COMPILE_NEW_GENERATION'"},created_at:{type:'timestamptz',notNull:true}
  }, {constraints:{primaryKey:['owner_profile_id','event_id'],foreignKeys:[{columns:['owner_profile_id','bundle_id'],references:'mission_bundle_generations_v2(owner_profile_id,bundle_id)',onDelete:'RESTRICT'}]}});
  pgm.createIndex('mission_bundle_status_events_v2',['owner_profile_id','bundle_id','created_at']);

  pgm.createTable('goal_plan_idempotency_records_v2', {
    owner_profile_id:{type:'uuid',notNull:true,references:'local_owner_profiles',onDelete:'RESTRICT'},route:{type:'text',notNull:true},idempotency_key:{type:'text',notNull:true},request_digest:{type:'char(64)',notNull:true},response_body:{type:'jsonb',notNull:true},created_at:{type:'timestamptz',notNull:true}
  }, {constraints:{primaryKey:['owner_profile_id','route','idempotency_key']}});

  pgm.sql(`
    CREATE FUNCTION reject_sdd009_authority_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'SDD009_APPEND_ONLY_AUTHORITY'; END $$;
    CREATE TRIGGER operating_goal_revisions_immutable BEFORE UPDATE OR DELETE ON operating_goal_revisions FOR EACH ROW EXECUTE FUNCTION reject_sdd009_authority_mutation();
    CREATE TRIGGER operating_goal_account_bindings_immutable BEFORE UPDATE OR DELETE ON operating_goal_account_bindings FOR EACH ROW EXECUTE FUNCTION reject_sdd009_authority_mutation();
    CREATE TRIGGER content_plan_revisions_v2_immutable BEFORE UPDATE OR DELETE ON content_plan_revisions_v2 FOR EACH ROW EXECUTE FUNCTION reject_sdd009_authority_mutation();
    CREATE TRIGGER mission_bundle_generations_v2_immutable BEFORE UPDATE OR DELETE ON mission_bundle_generations_v2 FOR EACH ROW EXECUTE FUNCTION reject_sdd009_authority_mutation();
    CREATE TRIGGER mission_bundle_status_events_v2_immutable BEFORE UPDATE OR DELETE ON mission_bundle_status_events_v2 FOR EACH ROW EXECUTE FUNCTION reject_sdd009_authority_mutation();
    CREATE TRIGGER knowledge_snapshot_context_bindings_v2_immutable BEFORE UPDATE OR DELETE ON knowledge_snapshot_context_bindings_v2 FOR EACH ROW EXECUTE FUNCTION reject_sdd009_authority_mutation();
    CREATE TRIGGER knowledge_snapshot_supersession_outbox_v2_immutable BEFORE UPDATE OR DELETE ON knowledge_snapshot_supersession_outbox_v2 FOR EACH ROW EXECUTE FUNCTION reject_sdd009_authority_mutation();
    CREATE TRIGGER knowledge_snapshot_supersession_receipts_v2_immutable BEFORE UPDATE OR DELETE ON knowledge_snapshot_supersession_receipts_v2 FOR EACH ROW EXECUTE FUNCTION reject_sdd009_authority_mutation();
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DO $$ BEGIN
      IF (SELECT (SELECT count(*) FROM operating_goal_revisions)+(SELECT count(*) FROM operating_goal_account_bindings)+(SELECT count(*) FROM content_plan_revisions_v2)+(SELECT count(*) FROM mission_bundle_generations_v2)+(SELECT count(*) FROM mission_bundle_status_events_v2)+(SELECT count(*) FROM goal_plan_idempotency_records_v2)+(SELECT count(*) FROM knowledge_snapshot_context_bindings_v2)+(SELECT count(*) FROM knowledge_snapshot_supersession_outbox_v2)+(SELECT count(*) FROM knowledge_snapshot_supersession_receipts_v2)) > 0 THEN
        RAISE EXCEPTION 'SDD009_DOWN_BLOCKED_DATA_EXPORT_AND_OWNER_DECISION_REQUIRED';
      END IF;
    END $$;
    DROP TRIGGER IF EXISTS mission_bundle_status_events_v2_immutable ON mission_bundle_status_events_v2;
    DROP TRIGGER IF EXISTS mission_bundle_generations_v2_immutable ON mission_bundle_generations_v2;
    DROP TRIGGER IF EXISTS content_plan_revisions_v2_immutable ON content_plan_revisions_v2;
    DROP TRIGGER IF EXISTS operating_goal_account_bindings_immutable ON operating_goal_account_bindings;
    DROP TRIGGER IF EXISTS operating_goal_revisions_immutable ON operating_goal_revisions;
    DROP TRIGGER IF EXISTS knowledge_snapshot_context_bindings_v2_immutable ON knowledge_snapshot_context_bindings_v2;
    DROP TRIGGER IF EXISTS knowledge_snapshot_supersession_outbox_v2_immutable ON knowledge_snapshot_supersession_outbox_v2;
    DROP TRIGGER IF EXISTS knowledge_snapshot_supersession_receipts_v2_immutable ON knowledge_snapshot_supersession_receipts_v2;
    DROP FUNCTION IF EXISTS reject_sdd009_authority_mutation();
  `);
  pgm.dropTable('goal_plan_idempotency_records_v2');
  pgm.dropTable('mission_bundle_status_events_v2');
  pgm.dropTable('mission_bundle_generations_v2');
  pgm.dropTable('content_plan_heads_v2');
  pgm.dropTable('content_plan_revisions_v2');
  pgm.dropTable('operating_goal_account_bindings');
  pgm.dropTable('operating_goal_heads');
  pgm.dropTable('operating_goal_revisions');
  pgm.dropTable('knowledge_snapshot_supersession_receipts_v2');
  pgm.dropTable('knowledge_snapshot_supersession_outbox_v2');
  pgm.dropTable('knowledge_snapshot_context_bindings_v2');
};
