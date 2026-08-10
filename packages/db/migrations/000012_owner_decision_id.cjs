exports.up = (pgm) => {
  // Add owner_decision_id to action_grants so every grant carries a
  // back-reference to the OwnerDecision that authorised it.
  // Existing rows (pre-M3-01) default to '' — meaning "legacy, no decision".
  pgm.sql(`
    ALTER TABLE action_grants
      ADD COLUMN owner_decision_id TEXT NOT NULL DEFAULT '';
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE action_grants
      DROP COLUMN owner_decision_id;
  `);
};
