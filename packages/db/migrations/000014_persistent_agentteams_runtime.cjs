exports.up = (pgm) => {
  pgm.createTable('mission_runs_v1', {
    id:{type:'text',primaryKey:true}, owner_profile_id:{type:'uuid',notNull:true,references:'local_owner_profiles',onDelete:'RESTRICT'},
    bundle_id:{type:'text',notNull:true}, bundle_digest:{type:'char(64)',notNull:true}, bundle_kind:{type:'text',notNull:true,check:"bundle_kind IN ('MISSION_INTENT','MISSION_EXECUTION')"},
    generation:{type:'integer',notNull:true,check:'generation > 0'}, runtime_requirement:{type:'jsonb',notNull:true}, bundle_payload:{type:'jsonb',notNull:true},
    state:{type:'text',notNull:true,check:"state IN ('QUEUED','DISPATCHING','RUNNING','HUMAN_GATE','BLOCKED','RECOVERING','SUCCEEDED_RUNTIME','FAILED_RUNTIME','CANCELLED')"},
    created_by:{type:'text',notNull:true}, created_at:{type:'timestamptz',notNull:true}, started_at:{type:'timestamptz'}, finished_at:{type:'timestamptz'},
    last_reconciled_at:{type:'timestamptz'}, error_code:{type:'text'}, row_version:{type:'integer',notNull:true,default:1,check:'row_version > 0'}, updated_at:{type:'timestamptz',notNull:true}
  });
  pgm.addConstraint('mission_runs_v1','mission_runs_v1_bundle_generation_unique',{unique:['owner_profile_id','bundle_id','generation']});
  pgm.addConstraint('mission_runs_v1','mission_runs_v1_exact_bundle_unique',{unique:['owner_profile_id','bundle_id','bundle_digest']});
  pgm.addConstraint('mission_runs_v1','mission_runs_v1_owner_id_unique',{unique:['owner_profile_id','id']});

  pgm.createTable('mission_jobs_v1', {
    id:{type:'text',primaryKey:true}, owner_profile_id:{type:'uuid',notNull:true,references:'local_owner_profiles',onDelete:'RESTRICT'}, run_id:{type:'text',notNull:true},
    task_contract_id:{type:'text',notNull:true}, generation:{type:'integer',notNull:true,check:'generation > 0'}, role_id:{type:'text',notNull:true}, kind:{type:'text',notNull:true}, dependency_ids:{type:'jsonb',notNull:true},
    input_digest:{type:'char(64)',notNull:true}, skill_lock_digest:{type:'char(64)',notNull:true}, schema_ref:{type:'text',notNull:true}, contract_payload:{type:'jsonb',notNull:true},
    state:{type:'text',notNull:true,check:"state IN ('WAITING_DEPENDENCY','QUEUED','LEASED','DISPATCHED','ACKNOWLEDGED','SUBMITTED','ACCEPTED','QUARANTINED','BLOCKED','CANCELLED')"},
    available_at:{type:'timestamptz',notNull:true}, lease_owner:{type:'text'}, lease_token_hash:{type:'char(64)'}, lease_expires_at:{type:'timestamptz'}, attempt_count:{type:'integer',notNull:true,default:0,check:'attempt_count >= 0'},
    accepted_attempt_id:{type:'text'}, accepted_output_ref:{type:'text'}, accepted_output_digest:{type:'char(64)'}, runtime_task_id:{type:'text'}, last_error_code:{type:'text'}, row_version:{type:'integer',notNull:true,default:1,check:'row_version > 0'},
    created_at:{type:'timestamptz',notNull:true}, updated_at:{type:'timestamptz',notNull:true}
  });
  pgm.addConstraint('mission_jobs_v1','mission_jobs_v1_task_generation_unique',{unique:['run_id','task_contract_id','generation']});
  pgm.addConstraint('mission_jobs_v1','mission_jobs_v1_owner_run_id_unique',{unique:['owner_profile_id','run_id','id']});
  pgm.addConstraint('mission_jobs_v1','mission_jobs_v1_exact_task_unique',{unique:['owner_profile_id','run_id','id','task_contract_id']});
  pgm.addConstraint('mission_jobs_v1','mission_jobs_v1_exact_run_fk',{foreignKeys:[{columns:['owner_profile_id','run_id'],references:'mission_runs_v1(owner_profile_id,id)',onDelete:'RESTRICT'}]});
  pgm.addConstraint('mission_jobs_v1','mission_jobs_v1_accepted_shape',{check:"(state = 'ACCEPTED' AND accepted_attempt_id IS NOT NULL AND accepted_output_ref IS NOT NULL AND accepted_output_digest IS NOT NULL) OR (state <> 'ACCEPTED' AND accepted_attempt_id IS NULL AND accepted_output_ref IS NULL AND accepted_output_digest IS NULL)"});
  pgm.createIndex('mission_jobs_v1',['state','available_at','lease_expires_at']);

  pgm.createTable('agent_task_attempts_v1', {
    id:{type:'text',primaryKey:true}, owner_profile_id:{type:'uuid',notNull:true,references:'local_owner_profiles',onDelete:'RESTRICT'}, run_id:{type:'text',notNull:true}, job_id:{type:'text',notNull:true}, attempt_number:{type:'integer',notNull:true,check:'attempt_number > 0'}, role_id:{type:'text',notNull:true},
    runtime_task_id:{type:'text'}, runtime_actor_id:{type:'text'}, input_digest:{type:'char(64)',notNull:true}, skill_lock_digest:{type:'char(64)',notNull:true}, schema_ref:{type:'text',notNull:true}, lease_token_hash:{type:'char(64)',notNull:true},
    state:{type:'text',notNull:true,check:"state IN ('LEASED','DISPATCHED','ACKNOWLEDGED','SUBMITTED','ACCEPTED','QUARANTINED','LEASE_LOST','UNKNOWN','FAILED')"},
    ack_at:{type:'timestamptz'}, submitted_at:{type:'timestamptz'}, output_digest:{type:'char(64)'}, output_envelope:{type:'jsonb'}, error_code:{type:'text'}, created_at:{type:'timestamptz',notNull:true}, updated_at:{type:'timestamptz',notNull:true}
  });
  pgm.addConstraint('agent_task_attempts_v1','agent_task_attempts_v1_attempt_unique',{unique:['job_id','attempt_number']});
  pgm.addConstraint('agent_task_attempts_v1','agent_task_attempts_v1_exact_id_unique',{unique:['owner_profile_id','run_id','job_id','id']});
  pgm.addConstraint('agent_task_attempts_v1','agent_task_attempts_v1_exact_job_fk',{foreignKeys:[{columns:['owner_profile_id','run_id','job_id'],references:'mission_jobs_v1(owner_profile_id,run_id,id)',onDelete:'RESTRICT'}]});
  pgm.addConstraint('agent_task_attempts_v1','agent_task_attempts_v1_state_shape',{check:"(state IN ('ACKNOWLEDGED','SUBMITTED','ACCEPTED','QUARANTINED') AND runtime_task_id IS NOT NULL AND runtime_actor_id IS NOT NULL AND ack_at IS NOT NULL OR state NOT IN ('ACKNOWLEDGED','SUBMITTED','ACCEPTED','QUARANTINED')) AND (state IN ('SUBMITTED','ACCEPTED','QUARANTINED') AND submitted_at IS NOT NULL AND output_digest IS NOT NULL AND output_envelope IS NOT NULL OR state NOT IN ('SUBMITTED','ACCEPTED','QUARANTINED','UNKNOWN') AND submitted_at IS NULL AND output_digest IS NULL AND output_envelope IS NULL OR state='UNKNOWN' AND ((submitted_at IS NULL AND output_digest IS NULL AND output_envelope IS NULL) OR (submitted_at IS NOT NULL AND output_digest IS NOT NULL AND output_envelope IS NOT NULL)))"});
  pgm.addConstraint('mission_jobs_v1','mission_jobs_v1_exact_accepted_attempt_fk',{foreignKeys:[{columns:['owner_profile_id','run_id','id','accepted_attempt_id'],references:'agent_task_attempts_v1(owner_profile_id,run_id,job_id,id)',onDelete:'RESTRICT'}]});
  pgm.sql("CREATE UNIQUE INDEX agent_task_attempts_v1_runtime_task_unique ON agent_task_attempts_v1(runtime_task_id) WHERE runtime_task_id IS NOT NULL");
  pgm.sql("CREATE UNIQUE INDEX agent_task_attempts_v1_one_accepted ON agent_task_attempts_v1(job_id) WHERE state = 'ACCEPTED'");

  pgm.createTable('runtime_bindings_v1', {
    run_id:{type:'text',primaryKey:true}, owner_profile_id:{type:'uuid',notNull:true,references:'local_owner_profiles',onDelete:'RESTRICT'}, runtime_instance_id:{type:'text',notNull:true}, runtime_project_id:{type:'text',notNull:true},
    team_profile_version:{type:'text',notNull:true}, team_profile_digest:{type:'char(64)',notNull:true}, runtime_version:{type:'text',notNull:true}, runtime_digest:{type:'char(64)',notNull:true},
    member_bindings:{type:'jsonb',notNull:true}, state:{type:'text',notNull:true,check:"state IN ('BOUND','UNKNOWN','INCOMPATIBLE')"}, bound_at:{type:'timestamptz',notNull:true}, last_observed_at:{type:'timestamptz',notNull:true}
  });
  pgm.addConstraint('runtime_bindings_v1','runtime_bindings_v1_exact_run_fk',{foreignKeys:[{columns:['owner_profile_id','run_id'],references:'mission_runs_v1(owner_profile_id,id)',onDelete:'RESTRICT'}]});

  pgm.createTable('runtime_events_v1', {
    sequence:{type:'bigserial',primaryKey:true}, id:{type:'text',notNull:true,unique:true}, owner_profile_id:{type:'uuid',notNull:true,references:'local_owner_profiles',onDelete:'RESTRICT'}, run_id:{type:'text',notNull:true},
    job_id:{type:'text'}, attempt_id:{type:'text'}, type:{type:'text',notNull:true}, stable_code:{type:'text'},
    public_payload:{type:'jsonb',notNull:true}, private_evidence_ref:{type:'text'}, occurred_at:{type:'timestamptz',notNull:true}
  });
  pgm.addConstraint('runtime_events_v1','runtime_events_v1_attempt_requires_job',{check:'attempt_id IS NULL OR job_id IS NOT NULL'});
  pgm.addConstraint('runtime_events_v1','runtime_events_v1_exact_run_fk',{foreignKeys:[{columns:['owner_profile_id','run_id'],references:'mission_runs_v1(owner_profile_id,id)',onDelete:'RESTRICT'}]});
  pgm.addConstraint('runtime_events_v1','runtime_events_v1_exact_job_fk',{foreignKeys:[{columns:['owner_profile_id','run_id','job_id'],references:'mission_jobs_v1(owner_profile_id,run_id,id)',onDelete:'RESTRICT'}]});
  pgm.addConstraint('runtime_events_v1','runtime_events_v1_exact_attempt_fk',{foreignKeys:[{columns:['owner_profile_id','run_id','job_id','attempt_id'],references:'agent_task_attempts_v1(owner_profile_id,run_id,job_id,id)',onDelete:'RESTRICT'}]});
  pgm.createIndex('runtime_events_v1',['run_id','sequence']);

  pgm.createTable('model_gateway_tickets_v1', {
    ticket_digest:{type:'char(64)',primaryKey:true}, owner_profile_id:{type:'uuid',notNull:true,references:'local_owner_profiles',onDelete:'RESTRICT'}, run_id:{type:'text',notNull:true}, job_id:{type:'text',notNull:true}, task_id:{type:'text',notNull:true}, attempt_id:{type:'text',notNull:true},attempt_number:{type:'integer',notNull:true,check:'attempt_number > 0'},runtime_task_id:{type:'text',notNull:true},runtime_actor_id:{type:'text',notNull:true},worker_id_digest:{type:'char(64)',notNull:true},lease_token_digest:{type:'char(64)',notNull:true},
    phase:{type:'text',notNull:true}, model:{type:'text',notNull:true}, policy_digest:{type:'char(64)',notNull:true},input_digest:{type:'char(64)',notNull:true},request_digest:{type:'char(64)',notNull:true},output_schema:{type:'text',notNull:true}, nonce_digest:{type:'char(64)',notNull:true,unique:true}, expires_at:{type:'timestamptz',notNull:true}, public_claims:{type:'jsonb',notNull:true}, created_at:{type:'timestamptz',notNull:true}
  });
  pgm.addConstraint('model_gateway_tickets_v1','model_gateway_tickets_v1_exact_run_fk',{foreignKeys:[{columns:['owner_profile_id','run_id'],references:'mission_runs_v1(owner_profile_id,id)',onDelete:'RESTRICT'}]});
  pgm.addConstraint('model_gateway_tickets_v1','model_gateway_tickets_v1_exact_task_fk',{foreignKeys:[{columns:['owner_profile_id','run_id','job_id','task_id'],references:'mission_jobs_v1(owner_profile_id,run_id,id,task_contract_id)',onDelete:'RESTRICT'}]});
  pgm.addConstraint('model_gateway_tickets_v1','model_gateway_tickets_v1_exact_attempt_fk',{foreignKeys:[{columns:['owner_profile_id','run_id','job_id','attempt_id'],references:'agent_task_attempts_v1(owner_profile_id,run_id,job_id,id)',onDelete:'RESTRICT'}]});
  pgm.addConstraint('model_gateway_tickets_v1','model_gateway_tickets_v1_one_per_attempt_phase',{unique:['owner_profile_id','run_id','job_id','attempt_id','phase']});
  pgm.addConstraint('model_gateway_tickets_v1','model_gateway_tickets_v1_exact_lineage_unique',{unique:['ticket_digest','owner_profile_id','run_id','job_id','task_id','attempt_id']});
  pgm.createTable('model_gateway_ticket_uses_v1', {
    sequence:{type:'bigserial',primaryKey:true}, ticket_digest:{type:'char(64)',notNull:true,references:'model_gateway_tickets_v1',onDelete:'RESTRICT'}, owner_profile_id:{type:'uuid',notNull:true}, run_id:{type:'text',notNull:true}, job_id:{type:'text',notNull:true}, task_id:{type:'text',notNull:true}, attempt_id:{type:'text',notNull:true},runtime_actor_id:{type:'text',notNull:true},
    outcome:{type:'text',notNull:true,check:"outcome IN ('USED','REPLAYED','EXPIRED','REJECTED')"}, occurred_at:{type:'timestamptz',notNull:true}, public_claims:{type:'jsonb',notNull:true}
  });
  pgm.sql("CREATE UNIQUE INDEX model_gateway_ticket_uses_v1_one_use ON model_gateway_ticket_uses_v1(ticket_digest) WHERE outcome='USED'");
  pgm.addConstraint('model_gateway_ticket_uses_v1','model_gateway_ticket_uses_v1_exact_ticket_fk',{foreignKeys:[{columns:['ticket_digest','owner_profile_id','run_id','job_id','task_id','attempt_id'],references:'model_gateway_tickets_v1(ticket_digest,owner_profile_id,run_id,job_id,task_id,attempt_id)',onDelete:'RESTRICT'}]});

  pgm.createTable('runtime_materialization_batches_v1',{
    id:{type:'text',primaryKey:true},owner_profile_id:{type:'uuid',notNull:true,references:'local_owner_profiles',onDelete:'RESTRICT'},run_id:{type:'text',notNull:true},job_id:{type:'text',notNull:true},attempt_id:{type:'text',notNull:true},output_digest:{type:'char(64)',notNull:true},accepted_output_ref:{type:'text',notNull:true},batch_digest:{type:'char(64)',notNull:true},opaque_payload:{type:'jsonb',notNull:true},state:{type:'text',notNull:true,check:"state IN ('STAGED','COMMITTED')"},created_at:{type:'timestamptz',notNull:true},committed_at:{type:'timestamptz'}
  });
  pgm.addConstraint('runtime_materialization_batches_v1','runtime_materialization_batches_v1_exact_attempt_fk',{foreignKeys:[{columns:['owner_profile_id','run_id','job_id','attempt_id'],references:'agent_task_attempts_v1(owner_profile_id,run_id,job_id,id)',onDelete:'RESTRICT'}]});
  pgm.addConstraint('runtime_materialization_batches_v1','runtime_materialization_batches_v1_one_per_attempt',{unique:['owner_profile_id','run_id','job_id','attempt_id']});
  pgm.addConstraint('runtime_materialization_batches_v1','runtime_materialization_batches_v1_state_shape',{check:"(state='STAGED' AND committed_at IS NULL) OR (state='COMMITTED' AND committed_at IS NOT NULL)"});
  pgm.createTable('runtime_materialization_items_v1',{
    batch_id:{type:'text',notNull:true,references:'runtime_materialization_batches_v1',onDelete:'RESTRICT'},item_index:{type:'integer',notNull:true,check:'item_index >= 0'},kind:{type:'text',notNull:true,check:"kind IN ('PROTOCOL','CONTENT_PLAN','ARTIFACT_REVISION','ARTIFACT_AUDIT')"},authority_id:{type:'text',notNull:true},canonical_digest:{type:'char(64)',notNull:true},opaque_candidate:{type:'jsonb',notNull:true}
  },{constraints:{primaryKey:['batch_id','item_index'],unique:['batch_id','kind','authority_id']}});

  pgm.createTable('runtime_idempotency_v1', {
    owner_profile_id:{type:'uuid',notNull:true,references:'local_owner_profiles',onDelete:'RESTRICT'}, route:{type:'text',notNull:true}, idempotency_key:{type:'text',notNull:true}, request_digest:{type:'char(64)',notNull:true}, response_body:{type:'jsonb',notNull:true}, created_at:{type:'timestamptz',notNull:true}
  },{constraints:{primaryKey:['owner_profile_id','route','idempotency_key']}});

  pgm.createTable('runtime_service_heartbeats_v1',{
    service:{type:'text',primaryKey:true,check:"service IN ('mission-worker')"},worker_id_digest:{type:'char(64)',notNull:true},observed_at:{type:'timestamptz',notNull:true},expires_at:{type:'timestamptz',notNull:true},payload:{type:'jsonb',notNull:true}
  });

  pgm.sql(`
    CREATE FUNCTION reject_runtime_append_only_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'SDD007_APPEND_ONLY_RUNTIME_EVIDENCE'; END $$;
    CREATE TRIGGER runtime_events_v1_immutable BEFORE UPDATE OR DELETE ON runtime_events_v1 FOR EACH ROW EXECUTE FUNCTION reject_runtime_append_only_mutation();
    CREATE TRIGGER model_gateway_tickets_v1_immutable BEFORE UPDATE OR DELETE ON model_gateway_tickets_v1 FOR EACH ROW EXECUTE FUNCTION reject_runtime_append_only_mutation();
    CREATE TRIGGER model_gateway_ticket_uses_v1_immutable BEFORE UPDATE OR DELETE ON model_gateway_ticket_uses_v1 FOR EACH ROW EXECUTE FUNCTION reject_runtime_append_only_mutation();
    CREATE TRIGGER runtime_materialization_items_v1_immutable BEFORE UPDATE OR DELETE ON runtime_materialization_items_v1 FOR EACH ROW EXECUTE FUNCTION reject_runtime_append_only_mutation();
    CREATE FUNCTION protect_runtime_materialization_batch() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF TG_OP='DELETE' THEN RAISE EXCEPTION 'SDD007_MATERIALIZATION_BATCH_IMMUTABLE'; END IF;
      IF OLD.state='COMMITTED' OR NEW.id<>OLD.id OR NEW.owner_profile_id<>OLD.owner_profile_id OR NEW.run_id<>OLD.run_id OR NEW.job_id<>OLD.job_id OR NEW.attempt_id<>OLD.attempt_id OR NEW.output_digest<>OLD.output_digest OR NEW.accepted_output_ref<>OLD.accepted_output_ref OR NEW.batch_digest<>OLD.batch_digest OR NEW.opaque_payload<>OLD.opaque_payload OR NEW.created_at<>OLD.created_at OR NEW.state<>'COMMITTED' OR NEW.committed_at IS NULL THEN RAISE EXCEPTION 'SDD007_MATERIALIZATION_BATCH_IMMUTABLE'; END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER runtime_materialization_batches_v1_guard BEFORE UPDATE OR DELETE ON runtime_materialization_batches_v1 FOR EACH ROW EXECUTE FUNCTION protect_runtime_materialization_batch();
    CREATE TRIGGER runtime_idempotency_v1_immutable BEFORE UPDATE OR DELETE ON runtime_idempotency_v1 FOR EACH ROW EXECUTE FUNCTION reject_runtime_append_only_mutation();
    CREATE FUNCTION protect_runtime_accepted_output() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF OLD.state = 'ACCEPTED' AND (NEW.state <> OLD.state OR NEW.accepted_attempt_id IS DISTINCT FROM OLD.accepted_attempt_id OR NEW.accepted_output_ref IS DISTINCT FROM OLD.accepted_output_ref OR NEW.accepted_output_digest IS DISTINCT FROM OLD.accepted_output_digest) THEN RAISE EXCEPTION 'SDD007_ACCEPTED_OUTPUT_IMMUTABLE'; END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER mission_jobs_v1_accepted_immutable BEFORE UPDATE ON mission_jobs_v1 FOR EACH ROW EXECUTE FUNCTION protect_runtime_accepted_output();
    CREATE FUNCTION protect_runtime_accepted_attempt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF OLD.state = 'ACCEPTED' AND ROW(NEW.state,NEW.output_digest,NEW.output_envelope) IS DISTINCT FROM ROW(OLD.state,OLD.output_digest,OLD.output_envelope) THEN RAISE EXCEPTION 'SDD007_ACCEPTED_ATTEMPT_IMMUTABLE'; END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER agent_task_attempts_v1_accepted_immutable BEFORE UPDATE ON agent_task_attempts_v1 FOR EACH ROW EXECUTE FUNCTION protect_runtime_accepted_attempt();
    CREATE FUNCTION enforce_runtime_binding_identity() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE requirement jsonb; role_count integer; actor_count integer; expected_role_count integer; BEGIN
      SELECT runtime_requirement INTO requirement FROM mission_runs_v1 WHERE owner_profile_id=NEW.owner_profile_id AND id=NEW.run_id;
      SELECT count(DISTINCT item->>'roleId'),count(DISTINCT item->>'runtimeActorId'),count(*) FILTER (WHERE item->>'roleId' IN ('presence-mission-leader','evidence-claim-steward','campaign-planner','founder-identity-producer','product-account-producer','independent-auditor')) INTO role_count,actor_count,expected_role_count FROM jsonb_array_elements(NEW.member_bindings) item;
      IF requirement IS NULL OR NEW.runtime_version <> requirement->>'version' OR trim(NEW.runtime_digest) <> requirement->>'sourceTarSha256' OR NEW.team_profile_version <> requirement->>'teamProfileVersion' OR trim(NEW.team_profile_digest) <> requirement->>'teamProfileDigest' OR jsonb_array_length(NEW.member_bindings) <> 6 OR role_count <> 6 OR actor_count <> 6 OR expected_role_count <> 6 THEN RAISE EXCEPTION 'SDD007_RUNTIME_BINDING_IDENTITY_MISMATCH' USING ERRCODE='23514'; END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER runtime_bindings_v1_identity_guard BEFORE INSERT OR UPDATE ON runtime_bindings_v1 FOR EACH ROW EXECUTE FUNCTION enforce_runtime_binding_identity();
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DO $$ BEGIN IF (SELECT
    (SELECT count(*) FROM mission_runs_v1) +
    (SELECT count(*) FROM mission_jobs_v1) +
    (SELECT count(*) FROM agent_task_attempts_v1) +
    (SELECT count(*) FROM runtime_bindings_v1) +
    (SELECT count(*) FROM runtime_events_v1) +
    (SELECT count(*) FROM model_gateway_tickets_v1) +
    (SELECT count(*) FROM model_gateway_ticket_uses_v1) +
    (SELECT count(*) FROM runtime_materialization_batches_v1) +
    (SELECT count(*) FROM runtime_materialization_items_v1) +
    (SELECT count(*) FROM runtime_idempotency_v1) +
    (SELECT count(*) FROM runtime_service_heartbeats_v1)
  ) > 0 THEN RAISE EXCEPTION 'SDD007_DOWN_BLOCKED_EXPORT_RUNTIME_EVIDENCE_FIRST'; END IF; END $$;`);
  pgm.sql('DROP TRIGGER IF EXISTS runtime_bindings_v1_identity_guard ON runtime_bindings_v1');
  pgm.sql('DROP TRIGGER IF EXISTS agent_task_attempts_v1_accepted_immutable ON agent_task_attempts_v1');
  pgm.sql('DROP TRIGGER IF EXISTS mission_jobs_v1_accepted_immutable ON mission_jobs_v1');
  pgm.sql('DROP TRIGGER IF EXISTS runtime_idempotency_v1_immutable ON runtime_idempotency_v1');
  pgm.sql('DROP TRIGGER IF EXISTS runtime_events_v1_immutable ON runtime_events_v1');
  pgm.sql('DROP TRIGGER IF EXISTS model_gateway_tickets_v1_immutable ON model_gateway_tickets_v1');
  pgm.sql('DROP TRIGGER IF EXISTS model_gateway_ticket_uses_v1_immutable ON model_gateway_ticket_uses_v1');
  pgm.sql('DROP TRIGGER IF EXISTS runtime_materialization_items_v1_immutable ON runtime_materialization_items_v1');
  pgm.sql('DROP TRIGGER IF EXISTS runtime_materialization_batches_v1_guard ON runtime_materialization_batches_v1');
  pgm.sql('DROP FUNCTION IF EXISTS enforce_runtime_binding_identity()');
  pgm.sql('DROP FUNCTION IF EXISTS protect_runtime_accepted_attempt()');
  pgm.sql('DROP FUNCTION IF EXISTS protect_runtime_accepted_output()');
  pgm.sql('DROP FUNCTION IF EXISTS protect_runtime_materialization_batch()');
  pgm.sql('DROP FUNCTION IF EXISTS reject_runtime_append_only_mutation()');
  pgm.dropConstraint('mission_jobs_v1','mission_jobs_v1_exact_accepted_attempt_fk');
  pgm.sql('DROP TABLE IF EXISTS runtime_materialization_items_v1');
  pgm.sql('DROP TABLE IF EXISTS runtime_materialization_batches_v1');
  for(const table of ['runtime_service_heartbeats_v1','runtime_idempotency_v1','model_gateway_ticket_uses_v1','model_gateway_tickets_v1','runtime_events_v1','runtime_bindings_v1','agent_task_attempts_v1','mission_jobs_v1','mission_runs_v1'])pgm.dropTable(table);
};
