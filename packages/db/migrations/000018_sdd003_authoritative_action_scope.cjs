exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE owner_decisions
      ADD COLUMN IF NOT EXISTS artifact_revision_digest char(64),
      ADD COLUMN IF NOT EXISTS capability_snapshot_digest char(64),
      ADD COLUMN IF NOT EXISTS decided_by text NOT NULL DEFAULT 'OWNER';

    UPDATE owner_decisions d
       SET artifact_revision_digest = ar.digest,
           capability_snapshot_digest = encode(sha256(convert_to(c.payload::text, 'UTF8')), 'hex')
      FROM artifact_revisions ar, capability_snapshots c
     WHERE ar.organization_id=d.organization_id AND ar.id=d.artifact_revision_id
       AND c.organization_id=d.organization_id AND c.id=d.capability_snapshot_id
       AND (d.artifact_revision_digest IS NULL OR d.capability_snapshot_digest IS NULL);

    ALTER TABLE owner_decisions
      ALTER COLUMN artifact_revision_digest SET NOT NULL,
      ALTER COLUMN capability_snapshot_digest SET NOT NULL;

    ALTER TABLE action_grants
      ALTER COLUMN owner_decision_id DROP DEFAULT,
      ALTER COLUMN owner_decision_id DROP NOT NULL,
      ALTER COLUMN owner_decision_id TYPE uuid
        USING NULLIF(owner_decision_id, '')::uuid;

    ALTER TABLE action_grants
      ADD CONSTRAINT action_grant_owner_decision_fk
      FOREIGN KEY (organization_id, owner_decision_id)
      REFERENCES owner_decisions(organization_id,id) ON DELETE RESTRICT;

    CREATE TRIGGER owner_decisions_immutable
      BEFORE UPDATE OR DELETE ON owner_decisions
      FOR EACH ROW EXECUTE FUNCTION reject_governed_history_mutation();

    CREATE UNIQUE INDEX action_receipts_one_initial_terminal
      ON action_receipts(organization_id, action_grant_id)
      WHERE previous_receipt_id IS NULL;

    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='lumiclaw_api') THEN CREATE ROLE lumiclaw_api NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='lumiclaw_action_operator') THEN CREATE ROLE lumiclaw_action_operator NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='lumiclaw_mission_worker') THEN CREATE ROLE lumiclaw_mission_worker NOLOGIN; END IF;
    END $$;

    REVOKE INSERT, UPDATE, DELETE ON owner_decisions, action_grants, outbox, action_receipts FROM PUBLIC;
    GRANT SELECT ON foundation_metadata, organizations, campaigns, channel_accounts, capability_snapshots, artifact_revisions, schedule_occurrences TO lumiclaw_api, lumiclaw_action_operator;
    GRANT UPDATE(owner_public_key) ON organizations TO lumiclaw_api;
    GRANT SELECT, INSERT ON idempotency_records TO lumiclaw_api;
    GRANT SELECT, INSERT ON owner_decisions, action_grants, outbox TO lumiclaw_api;
    GRANT UPDATE ON action_grants, outbox TO lumiclaw_api;
    GRANT SELECT ON owner_decisions, action_grants, outbox, action_receipts TO lumiclaw_api, lumiclaw_action_operator;
    GRANT UPDATE ON action_grants, outbox TO lumiclaw_action_operator;
    GRANT INSERT ON action_receipts TO lumiclaw_action_operator;
    GRANT SELECT ON campaigns, artifact_revisions, schedule_occurrences TO lumiclaw_mission_worker;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS action_receipts_one_initial_terminal;
    REVOKE ALL ON organizations, idempotency_records, owner_decisions, action_grants, outbox, action_receipts FROM lumiclaw_api, lumiclaw_action_operator, lumiclaw_mission_worker;
    DROP TRIGGER IF EXISTS owner_decisions_immutable ON owner_decisions;
    ALTER TABLE action_grants DROP CONSTRAINT IF EXISTS action_grant_owner_decision_fk;
    ALTER TABLE action_grants
      ALTER COLUMN owner_decision_id TYPE text USING COALESCE(owner_decision_id::text, ''),
      ALTER COLUMN owner_decision_id SET DEFAULT '',
      ALTER COLUMN owner_decision_id SET NOT NULL;
    ALTER TABLE owner_decisions
      DROP COLUMN IF EXISTS decided_by,
      DROP COLUMN IF EXISTS capability_snapshot_digest,
      DROP COLUMN IF EXISTS artifact_revision_digest;
  `);
};
