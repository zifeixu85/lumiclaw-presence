exports.up = (pgm) => {
  pgm.addColumns('missions', {
    provider_mode: {type: 'text', notNull: true, default: 'PUBLIC_SAFE_MOCK', check: "provider_mode IN ('PUBLIC_SAFE_MOCK','LIVE_DEEPSEEK_UAT')"},
    provider_model: {type: 'text', notNull: true, default: 'deepseek-v4-flash', check: "provider_model IN ('deepseek-v4-flash','deepseek-v4-pro')"}
  });
  pgm.dropConstraint('missions', 'mission_campaign_digest_unique');
  pgm.addConstraint('missions', 'mission_campaign_digest_mode_unique', {unique: ['organization_id', 'campaign_id', 'source_campaign_digest', 'provider_mode']});
};

exports.down = (pgm) => {
  pgm.dropConstraint('missions', 'mission_campaign_digest_mode_unique');
  pgm.addConstraint('missions', 'mission_campaign_digest_unique', {unique: ['organization_id', 'campaign_id', 'source_campaign_digest']});
  pgm.dropColumns('missions', ['provider_mode', 'provider_model']);
};
