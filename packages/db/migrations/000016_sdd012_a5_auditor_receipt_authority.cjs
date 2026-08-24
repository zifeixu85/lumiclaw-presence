exports.up = (pgm) => {
  pgm.addConstraint('mission_runs_v1','mission_runs_v1_audit_exact_source_unique',{unique:['owner_profile_id','id','bundle_id','bundle_digest']});
  pgm.addConstraint('mission_jobs_v1','mission_jobs_v1_audit_exact_authority_unique',{unique:['owner_profile_id','run_id','id','task_contract_id','input_digest','skill_lock_digest','schema_ref','accepted_attempt_id','accepted_output_digest','runtime_task_id','state']});
  pgm.addConstraint('agent_task_attempts_v1','agent_task_attempts_v1_audit_exact_authority_unique',{unique:['owner_profile_id','run_id','job_id','id','attempt_number','role_id','runtime_task_id','runtime_actor_id','input_digest','skill_lock_digest','schema_ref','output_digest','state']});
  pgm.addConstraint('runtime_bindings_v1','runtime_bindings_v1_audit_exact_authority_unique',{unique:['owner_profile_id','run_id','runtime_instance_id','runtime_project_id','team_profile_version','team_profile_digest','runtime_version','runtime_digest','state']});
  pgm.addConstraint('runtime_events_v1','runtime_events_v1_audit_completion_unique',{unique:['owner_profile_id','run_id','job_id','attempt_id','id','type']});
  pgm.addConstraint('runtime_materialization_batches_v1','runtime_materialization_batches_v1_audit_exact_authority_unique',{unique:['owner_profile_id','run_id','job_id','attempt_id','id','output_digest','accepted_output_ref','batch_digest','state']});

  pgm.createTable('media_audit_requests_v1',{
    owner_profile_id:{type:'uuid',notNull:true},id:{type:'text',notNull:true},artifact_revision_id:{type:'text',notNull:true},artifact_revision_digest:{type:'char(64)',notNull:true},
    source_run_id:{type:'text',notNull:true},source_bundle_id:{type:'text',notNull:true},source_bundle_digest:{type:'char(64)',notNull:true},audit_run_id:{type:'text',notNull:true},audit_job_id:{type:'text',notNull:true},audit_task_id:{type:'text',notNull:true},
    task_contract_digest:{type:'char(64)',notNull:true},input_projection_digest:{type:'char(64)',notNull:true},output_schema_digest:{type:'char(64)',notNull:true},generation:{type:'integer',notNull:true,check:'generation > 0'},canonical_digest:{type:'char(64)',notNull:true},payload:{type:'jsonb',notNull:true},created_at:{type:'timestamptz',notNull:true}
  },{constraints:{primaryKey:['owner_profile_id','id'],unique:['owner_profile_id','artifact_revision_id']}});
  pgm.addConstraint('media_audit_requests_v1','media_audit_request_revision_fk',{foreignKeys:{columns:['owner_profile_id','artifact_revision_id','artifact_revision_digest'],references:'artifact_revisions_v4(owner_profile_id,id,canonical_digest)',onDelete:'RESTRICT'}});
  pgm.addConstraint('media_audit_requests_v1','media_audit_request_source_run_fk',{foreignKeys:{columns:['owner_profile_id','source_run_id','source_bundle_id','source_bundle_digest'],references:'mission_runs_v1(owner_profile_id,id,bundle_id,bundle_digest)',onDelete:'RESTRICT'}});
  pgm.addConstraint('media_audit_requests_v1','media_audit_request_job_fk',{foreignKeys:{columns:['owner_profile_id','audit_run_id','audit_job_id','audit_task_id'],references:'mission_jobs_v1(owner_profile_id,run_id,id,task_contract_id)',onDelete:'RESTRICT'}});
  pgm.addConstraint('media_audit_requests_v1','media_audit_requests_v1_exact_receipt_source_unique',{unique:['owner_profile_id','id','artifact_revision_id','artifact_revision_digest','audit_run_id','audit_job_id','audit_task_id','task_contract_digest']});

  pgm.createTable('media_runtime_audit_receipts_v1',{
    owner_profile_id:{type:'uuid',notNull:true},id:{type:'text',notNull:true},request_id:{type:'text',notNull:true},artifact_revision_id:{type:'text',notNull:true},artifact_revision_digest:{type:'char(64)',notNull:true},source_run_id:{type:'text',notNull:true},
    run_id:{type:'text',notNull:true},job_id:{type:'text',notNull:true},task_id:{type:'text',notNull:true},task_contract_digest:{type:'char(64)',notNull:true},attempt_id:{type:'text',notNull:true},attempt_number:{type:'integer',notNull:true},
    runtime_task_id:{type:'text',notNull:true},runtime_actor_id:{type:'text',notNull:true},role_id:{type:'text',notNull:true,check:"role_id='independent-auditor'"},auditor_role:{type:'text',notNull:true,check:"auditor_role='A5_INDEPENDENT_AUDITOR'"},
    input_projection_digest:{type:'char(64)',notNull:true},skill_lock_digest:{type:'char(64)',notNull:true},output_schema:{type:'text',notNull:true,check:"output_schema='lumiclaw.media-audit-output.v4'"},output_schema_digest:{type:'char(64)',notNull:true},output_digest:{type:'char(64)',notNull:true},accepted_output_ref:{type:'text',notNull:true},media_canary_receipt_digest:{type:'char(64)',notNull:true},media_gate_fingerprint_digest:{type:'char(64)',notNull:true},
    runtime_instance_id:{type:'text',notNull:true},runtime_project_id:{type:'text',notNull:true},team_profile_version:{type:'text',notNull:true},team_profile_digest:{type:'char(64)',notNull:true},runtime_version:{type:'text',notNull:true},runtime_digest:{type:'char(64)',notNull:true},binding_state:{type:'text',notNull:true,check:"binding_state='BOUND'"},
    materialization_batch_id:{type:'text',notNull:true},materialization_batch_digest:{type:'char(64)',notNull:true},batch_state:{type:'text',notNull:true,check:"batch_state='COMMITTED'"},completion_event_id:{type:'text',notNull:true},completion_event_type:{type:'text',notNull:true,check:"completion_event_type='RUNTIME_COMPLETION_CONFIRMED'"},
    job_state:{type:'text',notNull:true,check:"job_state='ACCEPTED'"},attempt_state:{type:'text',notNull:true,check:"attempt_state='ACCEPTED'"},result:{type:'text',notNull:true,check:"result IN ('PASS','FAIL','ESCALATE')"},evidence_maturity:{type:'text',notNull:true,check:"evidence_maturity='AGENTTEAMS_RUNTIME'"},agentteams_executed:{type:'boolean',notNull:true,check:'agentteams_executed=true'},controlled_provider:{type:'boolean',notNull:true,check:'controlled_provider=false'},authoritative_for_operations:{type:'boolean',notNull:true,check:'authoritative_for_operations=true'},
    canonical_digest:{type:'char(64)',notNull:true},payload:{type:'jsonb',notNull:true},created_at:{type:'timestamptz',notNull:true}
  },{constraints:{primaryKey:['owner_profile_id','id'],unique:['owner_profile_id','artifact_revision_id']}});
  pgm.addConstraint('media_runtime_audit_receipts_v1','media_runtime_audit_request_fk',{foreignKeys:{columns:['owner_profile_id','request_id','artifact_revision_id','artifact_revision_digest','run_id','job_id','task_id','task_contract_digest'],references:'media_audit_requests_v1(owner_profile_id,id,artifact_revision_id,artifact_revision_digest,audit_run_id,audit_job_id,audit_task_id,task_contract_digest)',onDelete:'RESTRICT'}});
  pgm.addConstraint('media_runtime_audit_receipts_v1','media_runtime_audit_source_run_fk',{foreignKeys:{columns:['owner_profile_id','source_run_id'],references:'mission_runs_v1(owner_profile_id,id)',onDelete:'RESTRICT'}});
  pgm.addConstraint('media_runtime_audit_receipts_v1','media_runtime_audit_accepted_job_fk',{foreignKeys:{columns:['owner_profile_id','run_id','job_id','task_id','input_projection_digest','skill_lock_digest','output_schema','attempt_id','output_digest','runtime_task_id','job_state'],references:'mission_jobs_v1(owner_profile_id,run_id,id,task_contract_id,input_digest,skill_lock_digest,schema_ref,accepted_attempt_id,accepted_output_digest,runtime_task_id,state)',onDelete:'RESTRICT'}});
  pgm.addConstraint('media_runtime_audit_receipts_v1','media_runtime_audit_accepted_attempt_fk',{foreignKeys:{columns:['owner_profile_id','run_id','job_id','attempt_id','attempt_number','role_id','runtime_task_id','runtime_actor_id','input_projection_digest','skill_lock_digest','output_schema','output_digest','attempt_state'],references:'agent_task_attempts_v1(owner_profile_id,run_id,job_id,id,attempt_number,role_id,runtime_task_id,runtime_actor_id,input_digest,skill_lock_digest,schema_ref,output_digest,state)',onDelete:'RESTRICT'}});
  pgm.addConstraint('media_runtime_audit_receipts_v1','media_runtime_audit_binding_fk',{foreignKeys:{columns:['owner_profile_id','run_id','runtime_instance_id','runtime_project_id','team_profile_version','team_profile_digest','runtime_version','runtime_digest','binding_state'],references:'runtime_bindings_v1(owner_profile_id,run_id,runtime_instance_id,runtime_project_id,team_profile_version,team_profile_digest,runtime_version,runtime_digest,state)',onDelete:'RESTRICT'}});
  pgm.addConstraint('media_runtime_audit_receipts_v1','media_runtime_audit_batch_fk',{foreignKeys:{columns:['owner_profile_id','run_id','job_id','attempt_id','materialization_batch_id','output_digest','accepted_output_ref','materialization_batch_digest','batch_state'],references:'runtime_materialization_batches_v1(owner_profile_id,run_id,job_id,attempt_id,id,output_digest,accepted_output_ref,batch_digest,state)',onDelete:'RESTRICT'}});
  pgm.addConstraint('media_runtime_audit_receipts_v1','media_runtime_audit_completion_fk',{foreignKeys:{columns:['owner_profile_id','run_id','job_id','attempt_id','completion_event_id','completion_event_type'],references:'runtime_events_v1(owner_profile_id,run_id,job_id,attempt_id,id,type)',onDelete:'RESTRICT'}});
  pgm.addConstraint('media_runtime_audit_receipts_v1','media_runtime_audit_canary_fk',{foreignKeys:{columns:['owner_profile_id','media_canary_receipt_digest'],references:'media_provider_canary_receipts_v1(owner_profile_id,canonical_digest)',onDelete:'RESTRICT'}});
  pgm.addConstraint('media_runtime_audit_receipts_v1','media_runtime_audit_receipts_v1_exact_audit_fk_unique',{unique:['owner_profile_id','artifact_revision_id','canonical_digest']});

  pgm.sql(`
    DO $$ DECLARE constraint_row record; BEGIN
      FOR constraint_row IN SELECT conname FROM pg_constraint WHERE conrelid='artifact_audit_decisions_v4'::regclass AND contype='c' LOOP EXECUTE format('ALTER TABLE artifact_audit_decisions_v4 DROP CONSTRAINT %I',constraint_row.conname); END LOOP;
      FOR constraint_row IN SELECT pc.conname FROM pg_constraint pc WHERE pc.conrelid='artifact_audit_decisions_v4'::regclass AND pc.contype='u' AND ARRAY(SELECT pa.attname::text FROM unnest(pc.conkey) WITH ORDINALITY AS key_column(attnum,ordinality) JOIN pg_attribute pa ON pa.attrelid=pc.conrelid AND pa.attnum=key_column.attnum ORDER BY key_column.ordinality)=ARRAY['owner_profile_id','artifact_revision_id']::text[] LOOP EXECUTE format('ALTER TABLE artifact_audit_decisions_v4 DROP CONSTRAINT %I',constraint_row.conname); END LOOP;
    END $$;
    ALTER TABLE artifact_audit_decisions_v4 ADD CONSTRAINT artifact_audit_v4_role_check CHECK (auditor_role='A5_INDEPENDENT_AUDITOR');
    ALTER TABLE artifact_audit_decisions_v4 ADD CONSTRAINT artifact_audit_v4_result_check CHECK (result IN ('PASS','FAIL','ESCALATE'));
    ALTER TABLE artifact_audit_decisions_v4 ADD CONSTRAINT artifact_audit_v4_authority_shape CHECK (
      (auditor_identity_id='controlled-a5-media-auditor' AND evidence_maturity='CONTROLLED_FIXTURE' AND agentteams_executed=false AND authoritative_for_operations=false AND runtime_receipt_digest IS NULL)
      OR
      (auditor_identity_id<>'controlled-a5-media-auditor' AND evidence_maturity='AGENTTEAMS_RUNTIME' AND agentteams_executed=true AND authoritative_for_operations=true AND runtime_receipt_digest IS NOT NULL)
    );
    CREATE UNIQUE INDEX artifact_audit_v4_one_controlled ON artifact_audit_decisions_v4(owner_profile_id,artifact_revision_id) WHERE evidence_maturity='CONTROLLED_FIXTURE';
    CREATE UNIQUE INDEX artifact_audit_v4_one_runtime ON artifact_audit_decisions_v4(owner_profile_id,artifact_revision_id) WHERE evidence_maturity='AGENTTEAMS_RUNTIME';
  `);
  pgm.addConstraint('artifact_audit_decisions_v4','artifact_audit_v4_exact_runtime_receipt_fk',{foreignKeys:[{columns:['owner_profile_id','artifact_revision_id','runtime_receipt_digest'],references:'media_runtime_audit_receipts_v1(owner_profile_id,artifact_revision_id,canonical_digest)',onDelete:'RESTRICT'}]});
  pgm.sql(`
    CREATE TRIGGER media_audit_requests_v1_immutable BEFORE UPDATE OR DELETE ON media_audit_requests_v1 FOR EACH ROW EXECUTE FUNCTION reject_sdd012_media_authority_mutation();
    CREATE TRIGGER media_runtime_audit_receipts_v1_immutable BEFORE UPDATE OR DELETE ON media_runtime_audit_receipts_v1 FOR EACH ROW EXECUTE FUNCTION reject_sdd012_media_authority_mutation();
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DO $$ BEGIN IF (SELECT count(*) FROM media_audit_requests_v1)+(SELECT count(*) FROM media_runtime_audit_receipts_v1)+(SELECT count(*) FROM artifact_audit_decisions_v4 WHERE evidence_maturity='AGENTTEAMS_RUNTIME') > 0 THEN RAISE EXCEPTION 'SDD012_A5_RECEIPT_DOWN_BLOCKED_EXPORT_AND_FORWARD_FIX_REQUIRED'; END IF; END $$;`);
  pgm.dropConstraint('artifact_audit_decisions_v4','artifact_audit_v4_exact_runtime_receipt_fk');
  pgm.sql(`
    DROP INDEX IF EXISTS artifact_audit_v4_one_runtime; DROP INDEX IF EXISTS artifact_audit_v4_one_controlled;
    ALTER TABLE artifact_audit_decisions_v4 DROP CONSTRAINT artifact_audit_v4_authority_shape;
    ALTER TABLE artifact_audit_decisions_v4 DROP CONSTRAINT artifact_audit_v4_result_check;
    ALTER TABLE artifact_audit_decisions_v4 DROP CONSTRAINT artifact_audit_v4_role_check;
    ALTER TABLE artifact_audit_decisions_v4 ADD CONSTRAINT artifact_audit_decisions_v4_auditor_role_check CHECK (auditor_role='A5_INDEPENDENT_AUDITOR');
    ALTER TABLE artifact_audit_decisions_v4 ADD CONSTRAINT artifact_audit_decisions_v4_auditor_identity_id_check CHECK (auditor_identity_id='controlled-a5-media-auditor');
    ALTER TABLE artifact_audit_decisions_v4 ADD CONSTRAINT artifact_audit_decisions_v4_evidence_maturity_check CHECK (evidence_maturity='CONTROLLED_FIXTURE');
    ALTER TABLE artifact_audit_decisions_v4 ADD CONSTRAINT artifact_audit_decisions_v4_agentteams_executed_check CHECK (agentteams_executed=false);
    ALTER TABLE artifact_audit_decisions_v4 ADD CONSTRAINT artifact_audit_decisions_v4_authoritative_for_operations_check CHECK (authoritative_for_operations=false);
    ALTER TABLE artifact_audit_decisions_v4 ADD CONSTRAINT artifact_audit_decisions_v4_runtime_receipt_digest_check CHECK (runtime_receipt_digest is null);
    ALTER TABLE artifact_audit_decisions_v4 ADD CONSTRAINT artifact_audit_decisions_v4_result_check CHECK (result IN ('PASS','FAIL','ESCALATE'));
    ALTER TABLE artifact_audit_decisions_v4 ADD CONSTRAINT artifact_audit_decisions_v4_owner_profile_id_artifact_revision_id_key UNIQUE(owner_profile_id,artifact_revision_id);
  `);
  pgm.sql('DROP TRIGGER IF EXISTS media_runtime_audit_receipts_v1_immutable ON media_runtime_audit_receipts_v1');
  pgm.sql('DROP TRIGGER IF EXISTS media_audit_requests_v1_immutable ON media_audit_requests_v1');
  pgm.dropTable('media_runtime_audit_receipts_v1');pgm.dropTable('media_audit_requests_v1');
  for(const [table,constraint] of [
    ['runtime_materialization_batches_v1','runtime_materialization_batches_v1_audit_exact_authority_unique'],['runtime_events_v1','runtime_events_v1_audit_completion_unique'],['runtime_bindings_v1','runtime_bindings_v1_audit_exact_authority_unique'],['agent_task_attempts_v1','agent_task_attempts_v1_audit_exact_authority_unique'],['mission_jobs_v1','mission_jobs_v1_audit_exact_authority_unique'],['mission_runs_v1','mission_runs_v1_audit_exact_source_unique']
  ])pgm.dropConstraint(table,constraint);
};
