exports.up = (pgm) => {
  pgm.addColumns('local_onboarding_sessions', {
    market_codes: {type: 'jsonb', notNull: true, default: '[]'},
    content_locales: {type: 'jsonb', notNull: true, default: '[]'},
    platforms: {type: 'jsonb', notNull: true, default: '[]'},
    default_time_zone: {type: 'text'}
  });

  pgm.sql(`
    UPDATE local_onboarding_sessions
    SET market_codes = CASE WHEN market_code IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(market_code) END,
        content_locales = CASE WHEN content_locale IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(content_locale) END,
        platforms = CASE WHEN platform IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(platform) END,
        default_time_zone = time_zone
  `);

  pgm.dropConstraint('local_onboarding_sessions', 'local_onboarding_context_complete');
  pgm.addConstraint('local_onboarding_sessions', 'local_onboarding_context_complete', {
    check: "state <> 'COMPLETED' OR (organization_id IS NOT NULL AND campaign_id IS NOT NULL AND jsonb_typeof(market_codes) = 'array' AND jsonb_array_length(market_codes) > 0 AND jsonb_typeof(content_locales) = 'array' AND jsonb_array_length(content_locales) > 0 AND jsonb_typeof(platforms) = 'array' AND jsonb_array_length(platforms) > 0 AND default_time_zone IS NOT NULL)"
  });
};

exports.down = (pgm) => {
  pgm.dropConstraint('local_onboarding_sessions', 'local_onboarding_context_complete');
  pgm.addConstraint('local_onboarding_sessions', 'local_onboarding_context_complete', {
    check: "state <> 'COMPLETED' OR (organization_id IS NOT NULL AND campaign_id IS NOT NULL AND market_code IS NOT NULL AND content_locale IS NOT NULL AND platform IS NOT NULL AND time_zone IS NOT NULL)"
  });
  pgm.dropColumn('local_onboarding_sessions', 'market_codes');
  pgm.dropColumn('local_onboarding_sessions', 'content_locales');
  pgm.dropColumn('local_onboarding_sessions', 'platforms');
  pgm.dropColumn('local_onboarding_sessions', 'default_time_zone');
};
