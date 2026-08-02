exports.up = (pgm) => {
  pgm.sql('THIS IS INTENTIONALLY INVALID SQL FOR SDD-000 FAILURE VERIFICATION');
};

exports.down = () => undefined;
