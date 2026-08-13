exports.up = (pgm) => {
  pgm.sql(`
    CREATE UNIQUE INDEX action_receipts_predecessor_scope_unique
      ON action_receipts(organization_id, campaign_id, action_grant_id, id);

    CREATE UNIQUE INDEX action_receipts_single_successor_unique
      ON action_receipts(organization_id, previous_receipt_id)
      WHERE previous_receipt_id IS NOT NULL;

    ALTER TABLE action_receipts
      ADD CONSTRAINT action_receipts_predecessor_scope_fk
      FOREIGN KEY (organization_id, campaign_id, action_grant_id, previous_receipt_id)
      REFERENCES action_receipts(organization_id, campaign_id, action_grant_id, id)
      ON DELETE RESTRICT;

    CREATE OR REPLACE FUNCTION enforce_receipt_writer_boundary()
    RETURNS trigger AS $$
    DECLARE predecessor action_receipts%ROWTYPE;
    BEGIN
      IF pg_has_role(session_user, 'lumiclaw_api', 'member')
         AND NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname=session_user AND rolsuper) THEN
        IF NEW.previous_receipt_id IS NULL THEN
          RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='API_ROLE_INITIAL_RECEIPT_FORBIDDEN';
        END IF;

        SELECT * INTO predecessor
          FROM action_receipts
         WHERE organization_id=NEW.organization_id
           AND id=NEW.previous_receipt_id;

        IF NOT FOUND THEN
          RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='API_ROLE_RECEIPT_PREDECESSOR_NOT_FOUND';
        END IF;

        IF predecessor.campaign_id IS DISTINCT FROM NEW.campaign_id
           OR predecessor.action_grant_id IS DISTINCT FROM NEW.action_grant_id
           OR predecessor.platform IS DISTINCT FROM NEW.platform
           OR predecessor.execution_mode IS DISTINCT FROM NEW.execution_mode THEN
          RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='API_ROLE_RECEIPT_PREDECESSOR_SCOPE_INVALID';
        END IF;

        IF NOT (
          (predecessor.state = 'HANDOFF_PENDING' AND NEW.state = 'HANDOFF_CONFIRMED')
          OR
          (predecessor.state = 'UNKNOWN' AND NEW.state IN ('PUBLISHED','FAILED','NOT_EXECUTED'))
        ) THEN
          RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='API_ROLE_RECEIPT_SUCCESSOR_TRANSITION_FORBIDDEN';
        END IF;

        IF predecessor.state = 'HANDOFF_PENDING'
           AND (NEW.platform_uri IS NULL
                OR NEW.reconciled_at IS NOT NULL
                OR NEW.reconciliation_method IS NOT NULL) THEN
          RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='API_ROLE_HANDOFF_SUCCESSOR_INVALID';
        END IF;

        IF predecessor.state = 'UNKNOWN'
           AND (NEW.reconciled_at IS NULL
                OR NEW.reconciliation_method IS NULL
                OR (NEW.state = 'PUBLISHED' AND NEW.platform_uri IS NULL)
                OR (NEW.state <> 'PUBLISHED' AND (NEW.platform_uri IS NOT NULL OR NEW.platform_cid IS NOT NULL))) THEN
          RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='API_ROLE_RECONCILIATION_SUCCESSOR_INVALID';
        END IF;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog, public;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE action_receipts
      DROP CONSTRAINT IF EXISTS action_receipts_predecessor_scope_fk;
    DROP INDEX IF EXISTS action_receipts_single_successor_unique;
    DROP INDEX IF EXISTS action_receipts_predecessor_scope_unique;

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
  `);
};
