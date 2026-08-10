exports.up = (pgm) => {
  // Rename action_grants.owner_public_key → owner_key_id.
  // The actual public key lives on organizations.owner_public_key;
  // action_grants stores only a key fingerprint (SHA-256 of SPKI DER)
  // so that verification must go through the Organization record.
  pgm.sql(`
    ALTER TABLE action_grants
      RENAME COLUMN owner_public_key TO owner_key_id;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE action_grants
      RENAME COLUMN owner_key_id TO owner_public_key;
  `);
};
