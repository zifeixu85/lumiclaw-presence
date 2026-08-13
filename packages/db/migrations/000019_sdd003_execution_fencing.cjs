exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE outbox
      ADD COLUMN lease_token uuid,
      ADD COLUMN dispatch_started_at timestamptz;

    CREATE UNIQUE INDEX schedule_occurrences_scope_unique
      ON schedule_occurrences(organization_id, campaign_id, id);
    CREATE UNIQUE INDEX artifact_revisions_scope_unique
      ON artifact_revisions(organization_id, campaign_id, id);
    CREATE UNIQUE INDEX capability_snapshots_scope_unique
      ON capability_snapshots(organization_id, campaign_id, id);

    ALTER TABLE owner_decisions
      ADD CONSTRAINT owner_decision_occurrence_scope_fk
        FOREIGN KEY (organization_id, campaign_id, schedule_occurrence_id)
        REFERENCES schedule_occurrences(organization_id, campaign_id, id) ON DELETE RESTRICT,
      ADD CONSTRAINT owner_decision_artifact_scope_fk
        FOREIGN KEY (organization_id, campaign_id, artifact_revision_id)
        REFERENCES artifact_revisions(organization_id, campaign_id, id) ON DELETE RESTRICT,
      ADD CONSTRAINT owner_decision_capability_scope_fk
        FOREIGN KEY (organization_id, campaign_id, capability_snapshot_id)
        REFERENCES capability_snapshots(organization_id, campaign_id, id) ON DELETE RESTRICT;

    ALTER TABLE action_grants
      ADD CONSTRAINT action_grant_occurrence_scope_fk
        FOREIGN KEY (organization_id, campaign_id, schedule_occurrence_id)
        REFERENCES schedule_occurrences(organization_id, campaign_id, id) ON DELETE RESTRICT,
      ADD CONSTRAINT action_grant_artifact_scope_fk
        FOREIGN KEY (organization_id, campaign_id, artifact_revision_id)
        REFERENCES artifact_revisions(organization_id, campaign_id, id) ON DELETE RESTRICT,
      ADD CONSTRAINT action_grant_capability_scope_fk
        FOREIGN KEY (organization_id, campaign_id, capability_snapshot_id)
        REFERENCES capability_snapshots(organization_id, campaign_id, id) ON DELETE RESTRICT;

    CREATE OR REPLACE FUNCTION enforce_receipt_writer_boundary()
    RETURNS trigger AS $$
    DECLARE predecessor_state text;
    BEGIN
      IF pg_has_role(session_user, 'lumiclaw_api', 'member')
         AND NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname=session_user AND rolsuper) THEN
        IF NEW.previous_receipt_id IS NULL THEN
          RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='API_ROLE_INITIAL_RECEIPT_FORBIDDEN';
        END IF;
        SELECT state INTO predecessor_state
          FROM action_receipts
         WHERE organization_id=NEW.organization_id AND id=NEW.previous_receipt_id;
        IF predecessor_state NOT IN ('HANDOFF_PENDING','UNKNOWN') THEN
          RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='API_ROLE_SUCCESSOR_RECEIPT_FORBIDDEN';
        END IF;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog, public;
    CREATE TRIGGER action_receipts_writer_boundary
      BEFORE INSERT ON action_receipts
      FOR EACH ROW EXECUTE FUNCTION enforce_receipt_writer_boundary();

    GRANT INSERT ON action_receipts TO lumiclaw_api;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    REVOKE INSERT ON action_receipts FROM lumiclaw_api;
    DROP TRIGGER IF EXISTS action_receipts_writer_boundary ON action_receipts;
    DROP FUNCTION IF EXISTS enforce_receipt_writer_boundary();
    ALTER TABLE action_grants
      DROP CONSTRAINT IF EXISTS action_grant_capability_scope_fk,
      DROP CONSTRAINT IF EXISTS action_grant_artifact_scope_fk,
      DROP CONSTRAINT IF EXISTS action_grant_occurrence_scope_fk;
    ALTER TABLE owner_decisions
      DROP CONSTRAINT IF EXISTS owner_decision_capability_scope_fk,
      DROP CONSTRAINT IF EXISTS owner_decision_artifact_scope_fk,
      DROP CONSTRAINT IF EXISTS owner_decision_occurrence_scope_fk;
    DROP INDEX IF EXISTS capability_snapshots_scope_unique;
    DROP INDEX IF EXISTS artifact_revisions_scope_unique;
    DROP INDEX IF EXISTS schedule_occurrences_scope_unique;
    ALTER TABLE outbox DROP COLUMN IF EXISTS dispatch_started_at, DROP COLUMN IF EXISTS lease_token;
  `);
};
