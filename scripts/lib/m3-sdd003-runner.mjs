import {spawnSync} from 'node:child_process';

export const aggregateSteps = [
  ['domain', ['test', '--', '--run', 'packages/domain/src/action-grant.test.ts']],
  ['repositoryContract', ['test', '--', '--run', 'apps/action-operator/src/outbox-consumer.test.ts', 'apps/api/src/action-grant-routes.test.ts', 'apps/api/src/receipt-routes.test.ts']],
  ['typecheck', ['run', 'typecheck']],
  ['freshPostgres', ['run', 'verify:m3-fresh-postgres']],
  ['evidenceIntegrity', ['run', 'verify:m3-evidence-integrity']],
];

export function npmCommandFor(platform) {
  return platform === 'win32' ? 'npm.cmd' : 'npm';
}

export function runAggregate({
  platform = process.platform,
  cwd = process.cwd(),
  env = process.env,
  steps = aggregateSteps,
  spawn = spawnSync,
} = {}) {
  const command = npmCommandFor(platform);
  const results = Object.fromEntries(steps.map(([name, args]) => [name, {
    status: 'NOT_RUN',
    command: [command, ...args],
    exitCode: null,
    signal: null,
    error: null,
  }]));
  let failedStep = null;

  for (const [name, args] of steps) {
    // On Windows the command is npm.cmd: CreateProcess cannot execute .cmd
    // files directly, so the shell (cmd.exe) must interpret them. All args
    // are static literals from `steps`, so shell interpretation is safe here.
    // POSIX keeps shell:false (PATH npm, no shell needed).
    const child = spawn(command, args, {cwd, env, stdio: 'inherit', shell: platform === 'win32'});
    const result = results[name];
    result.exitCode = child.status ?? null;
    result.signal = child.signal ?? null;
    result.error = child.error === undefined ? null : {
      code: typeof child.error === 'object' && child.error !== null && 'code' in child.error
        ? String(child.error.code)
        : null,
      message: child.error instanceof Error ? child.error.message : String(child.error),
    };

    if (child.error !== undefined || child.signal !== null || child.status !== 0) {
      result.status = 'FAIL';
      failedStep = name;
      break;
    }
    result.status = 'PASS';
  }

  return {
    schemaVersion: 1,
    command: 'npm run verify:m3-sdd003',
    status: failedStep === null && Object.values(results).every((result) => result.status === 'PASS')
      ? 'PASS'
      : 'FAIL',
    npmCommand: command,
    failedStep,
    steps: results,
  };
}
