exports.up = (pgm) => {
  pgm.dropConstraint('local_onboarding_sessions', 'local_onboarding_sessions_state_check');
  pgm.addConstraint('local_onboarding_sessions', 'local_onboarding_sessions_state_check', {
    check: "state IN ('MATERIAL_CHOICE','MATERIALS_READY','CONTEXT_READY','COMPLETION_PENDING','COMPLETED')"
  });
  pgm.addColumn('local_onboarding_sessions', {
    completion_digest: {type: 'char(64)'}
  });
  pgm.addConstraint('local_onboarding_sessions', 'local_onboarding_completion_reservation', {
    check: "state <> 'COMPLETION_PENDING' OR (completion_digest IS NOT NULL AND path = 'LOCAL_MATERIALS' AND jsonb_typeof(material_ids) = 'array' AND jsonb_array_length(material_ids) > 0)"
  });
};

exports.down = (pgm) => {
  pgm.dropConstraint('local_onboarding_sessions', 'local_onboarding_completion_reservation');
  pgm.dropColumn('local_onboarding_sessions', 'completion_digest');
  pgm.dropConstraint('local_onboarding_sessions', 'local_onboarding_sessions_state_check');
  pgm.addConstraint('local_onboarding_sessions', 'local_onboarding_sessions_state_check', {
    check: "state IN ('MATERIAL_CHOICE','MATERIALS_READY','CONTEXT_READY','COMPLETED')"
  });
};
