exports.up = (pgm) => {
  pgm.createTable('publishing_schedules', {
    organization_id: {type: 'uuid', notNull: true}, id: {type: 'uuid', notNull: true}, campaign_id: {type: 'uuid', notNull: true},
    version: {type: 'integer', notNull: true, check: 'version >= 1'}, kind: {type: 'text', notNull: true, check: "kind IN ('ONCE','RRULE')"},
    time_zone: {type: 'text', notNull: true}, local_start: {type: 'text', notNull: true}, rrule: {type: 'text'},
    status: {type: 'text', notNull: true, check: "status IN ('ACTIVE','INVALIDATED')"}, payload: {type: 'jsonb', notNull: true},
    created_at: {type: 'timestamptz', notNull: true}, updated_at: {type: 'timestamptz', notNull: true}
  }, {constraints: {primaryKey: ['organization_id', 'id', 'version'], foreignKeys: [{columns: ['organization_id', 'campaign_id'], references: 'campaigns(organization_id,id)', onDelete: 'CASCADE'}]}});

  pgm.createTable('schedule_occurrences', {
    organization_id: {type: 'uuid', notNull: true}, id: {type: 'uuid', notNull: true}, campaign_id: {type: 'uuid', notNull: true},
    schedule_id: {type: 'uuid', notNull: true}, schedule_version: {type: 'integer', notNull: true}, ordinal: {type: 'integer', notNull: true, check: 'ordinal >= 1'},
    scheduled_for: {type: 'timestamptz', notNull: true}, state: {type: 'text', notNull: true, check: "state IN ('PENDING','MISSED','NEEDS_OWNER','INVALIDATED')"},
    payload: {type: 'jsonb', notNull: true}
  }, {constraints: {primaryKey: ['organization_id', 'id'], foreignKeys: [
    {columns: ['organization_id', 'campaign_id'], references: 'campaigns(organization_id,id)', onDelete: 'CASCADE'},
    {columns: ['organization_id', 'schedule_id', 'schedule_version'], references: 'publishing_schedules(organization_id,id,version)', onDelete: 'CASCADE'}
  ]}});
  pgm.addConstraint('schedule_occurrences', 'schedule_occurrence_ordinal_unique', {unique: ['organization_id', 'schedule_id', 'schedule_version', 'ordinal']});
  pgm.createIndex('schedule_occurrences', ['state', 'scheduled_for']);
};

exports.down = (pgm) => {
  pgm.dropTable('schedule_occurrences');
  pgm.dropTable('publishing_schedules');
};
