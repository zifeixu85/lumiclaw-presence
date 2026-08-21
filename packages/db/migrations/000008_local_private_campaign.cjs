exports.up = (pgm) => {
  pgm.dropConstraint('organizations', 'organizations_data_mode_check');
  pgm.addConstraint('organizations', 'organizations_data_mode_check', {check: "data_mode IN ('DEMO_SEED','LOCAL_PRIVATE')"});
};

exports.down = (pgm) => {
  pgm.dropConstraint('organizations', 'organizations_data_mode_check');
  pgm.addConstraint('organizations', 'organizations_data_mode_check', {check: "data_mode = 'DEMO_SEED'"});
};
