exports.up = (pgm) => {
  pgm.createTable('foundation_metadata', {
    key: {type: 'text', primaryKey: true},
    value: {type: 'jsonb', notNull: true},
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('current_timestamp')
    }
  });
  pgm.sql(`
    INSERT INTO foundation_metadata (key, value)
    VALUES ('installation_mode', '{"mode":"DEMO_SEED","live":false}'::jsonb)
  `);
};

exports.down = (pgm) => {
  pgm.dropTable('foundation_metadata');
};
