exports.up = (pgm) => {
  pgm.createTable('organizations', {
    id: {type: 'uuid', primaryKey: true},
    schema_version: {type: 'integer', notNull: true, default: 1, check: 'schema_version = 1'},
    slug: {type: 'text', notNull: true, unique: true},
    display_name: {type: 'text', notNull: true},
    data_mode: {type: 'text', notNull: true, default: 'DEMO_SEED', check: "data_mode = 'DEMO_SEED'"},
    live: {type: 'boolean', notNull: true, default: false, check: 'live = false'},
    created_at: {type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp')}
  });

  const scopedTables = {
    identities: {
      kind: {type: 'text', notNull: true, check: "kind IN ('PERSON','PRODUCT')"},
      display_name: {type: 'text', notNull: true},
      public_bio: {type: 'text', notNull: true}
    },
    brands: {
      name: {type: 'text', notNull: true},
      positioning: {type: 'text', notNull: true}
    },
    markets: {
      code: {type: 'text', notNull: true},
      display_name: {type: 'text', notNull: true},
      primary_language: {type: 'text', notNull: true}
    }
  };

  for (const [table, columns] of Object.entries(scopedTables)) {
    pgm.createTable(table, {
      organization_id: {type: 'uuid', notNull: true, references: 'organizations', onDelete: 'CASCADE'},
      id: {type: 'uuid', notNull: true},
      schema_version: {type: 'integer', notNull: true, default: 1, check: 'schema_version = 1'},
      ...columns,
      created_at: {type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp')}
    }, {constraints: {primaryKey: ['organization_id', 'id']}});
  }

  pgm.addConstraint('markets', 'markets_org_code_unique', {unique: ['organization_id', 'code']});
  pgm.createTable('products', {
    organization_id: {type: 'uuid', notNull: true}, id: {type: 'uuid', notNull: true},
    schema_version: {type: 'integer', notNull: true, default: 1, check: 'schema_version = 1'},
    brand_id: {type: 'uuid', notNull: true}, name: {type: 'text', notNull: true}, description: {type: 'text', notNull: true},
    created_at: {type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp')}
  }, {constraints: {primaryKey: ['organization_id', 'id'], foreignKeys: [
    {columns: 'organization_id', references: 'organizations', onDelete: 'CASCADE'},
    {columns: ['organization_id', 'brand_id'], references: 'brands(organization_id,id)'}
  ]}});

  pgm.createTable('channel_accounts', {
    organization_id: {type: 'uuid', notNull: true}, id: {type: 'uuid', notNull: true},
    schema_version: {type: 'integer', notNull: true, default: 1, check: 'schema_version = 1'},
    identity_id: {type: 'uuid', notNull: true},
    platform: {type: 'text', notNull: true, check: "platform IN ('X','BLUESKY','LINKEDIN','XIAOHONGSHU')"},
    display_handle: {type: 'text', notNull: true},
    connection_state: {type: 'text', notNull: true, default: 'NOT_CONNECTED', check: "connection_state = 'NOT_CONNECTED'"},
    created_at: {type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp')}
  }, {constraints: {primaryKey: ['organization_id', 'id'], foreignKeys: [
    {columns: 'organization_id', references: 'organizations', onDelete: 'CASCADE'},
    {columns: ['organization_id', 'identity_id'], references: 'identities(organization_id,id)'}
  ]}});
  pgm.addConstraint('channel_accounts', 'channel_accounts_org_platform_handle_unique', {unique: ['organization_id', 'platform', 'display_handle']});

  pgm.createTable('account_mandates', {
    organization_id: {type: 'uuid', notNull: true}, id: {type: 'uuid', notNull: true},
    schema_version: {type: 'integer', notNull: true, default: 1, check: 'schema_version = 1'},
    channel_account_id: {type: 'uuid', notNull: true}, identity_id: {type: 'uuid', notNull: true},
    product_id: {type: 'uuid', notNull: true}, market_id: {type: 'uuid', notNull: true},
    role: {type: 'text', notNull: true, check: "role IN ('FOUNDER_VOICE','PRODUCT_VOICE')"},
    allowed_actions: {type: 'jsonb', notNull: true, default: '["PREPARE"]'},
    requires_owner_review: {type: 'boolean', notNull: true, default: true, check: 'requires_owner_review = true'},
    valid_from: {type: 'timestamptz', notNull: true}, valid_until: {type: 'timestamptz', notNull: true},
    created_at: {type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp')}
  }, {constraints: {primaryKey: ['organization_id', 'id'], check: 'valid_until > valid_from', foreignKeys: [
    {columns: 'organization_id', references: 'organizations', onDelete: 'CASCADE'},
    {columns: ['organization_id', 'channel_account_id'], references: 'channel_accounts(organization_id,id)'},
    {columns: ['organization_id', 'identity_id'], references: 'identities(organization_id,id)'},
    {columns: ['organization_id', 'product_id'], references: 'products(organization_id,id)'},
    {columns: ['organization_id', 'market_id'], references: 'markets(organization_id,id)'}
  ]}});
};

exports.down = (pgm) => {
  pgm.dropTable('account_mandates');
  pgm.dropTable('channel_accounts');
  pgm.dropTable('products');
  pgm.dropTable('markets');
  pgm.dropTable('brands');
  pgm.dropTable('identities');
  pgm.dropTable('organizations');
};
