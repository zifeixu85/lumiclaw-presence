exports.up = (pgm) => {
  pgm.addColumns('action_grants', {
    channel_account_id: {type: 'uuid', notNull: true},
    capability_snapshot_id: {type: 'uuid', notNull: true},
  });
};

exports.down = (pgm) => {
  pgm.dropColumns('action_grants', ['channel_account_id', 'capability_snapshot_id']);
};
