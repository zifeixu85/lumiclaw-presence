exports.up = (pgm) => {
  pgm.addColumns('organizations', {
    owner_public_key: {type: 'text'},
  });
  pgm.addColumns('action_grants', {
    owner_signature: {type: 'text', notNull: true},
    owner_public_key: {type: 'text', notNull: true},
  });
};

exports.down = (pgm) => {
  pgm.dropColumns('action_grants', ['owner_signature', 'owner_public_key']);
  pgm.dropColumns('organizations', ['owner_public_key']);
};
