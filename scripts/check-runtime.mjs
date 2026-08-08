const expected = {node: '24.16.0', npm: '11.13.0'};
const actualNode = process.versions.node;
const userAgent = process.env.npm_config_user_agent ?? '';
const actualNpm = /npm\/([^\s]+)/u.exec(userAgent)?.[1] ?? 'unknown';

if (actualNode !== expected.node || actualNpm !== expected.npm) {
  console.error(
    `RUNTIME_VERSION_MISMATCH expected node ${expected.node}/npm ${expected.npm}; ` +
      `received node ${actualNode}/npm ${actualNpm}.`
  );
  process.exit(1);
}

console.info(`Runtime verified: node ${actualNode}, npm ${actualNpm}.`);
