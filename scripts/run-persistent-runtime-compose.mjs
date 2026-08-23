import {spawn} from 'node:child_process';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const modes = new Set(['fake', 'deepseek']);
const actions = new Set(['up', 'status', 'down']);
const providerSecretKeys = new Set(['DEEPSEEK_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY']);
const ambientCredentialKeys = new Set(['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN']);

export function resolveRuntimeHostIdentity(getuid = process.getuid, getgid = process.getgid) {
  if (typeof getuid !== 'function' || typeof getgid !== 'function') throw new Error('RUNTIME_COMPOSE_POSIX_IDENTITY_REQUIRED');
  const uid = getuid();
  const gid = getgid();
  if (!Number.isSafeInteger(uid) || !Number.isSafeInteger(gid) || uid <= 0 || gid < 0) throw new Error('RUNTIME_COMPOSE_NON_ROOT_IDENTITY_REQUIRED');
  return {uid, gid, composeUser: `${uid}:${gid}`};
}

export function redactRuntimeDiagnostic(value, secrets = []) {
  let redacted = String(value);
  for (const secret of secrets) {
    if (typeof secret === 'string' && secret.length > 0) redacted = redacted.split(secret).join('[REDACTED]');
  }
  redacted = redacted.replace(/((?:api[_-]?key|authorization|bootstrap|signing[_-]?secret)\s*[=:]\s*)[^\s,;]+/giu, '$1[REDACTED]');
  return redacted.slice(0, 12_000);
}

export function buildPersistentRuntimeComposeInvocation(mode, action, identity = resolveRuntimeHostIdentity()) {
  if (!modes.has(mode)) throw new Error('RUNTIME_COMPOSE_MODE_INVALID');
  if (!actions.has(action)) throw new Error('RUNTIME_COMPOSE_ACTION_INVALID');
  const files = ['-f', 'compose.yml', '-f', 'compose.persistent-runtime.yml'];
  if (mode === 'deepseek') files.push('-f', 'compose.persistent-runtime-deepseek.yml');
  const prefix = ['compose', ...files, '--profile', 'persistent-runtime', '--project-name', 'lumiclaw-sdd007'];
  const suffix = action === 'up'
    ? ['up', '-d', '--build', 'postgres', 'migrate', 'model-gateway', 'api', 'web']
    : action === 'status'
      ? ['ps']
      : ['down'];
  return {
    command: 'docker',
    args: [...prefix, ...suffix],
    environment: {
      LUMICLAW_RUNTIME_UID: String(identity.uid),
      LUMICLAW_RUNTIME_GID: String(identity.gid)
    }
  };
}

export function buildRuntimeComposeEnvironment(source, identity) {
  for (const key of providerSecretKeys) if (typeof source[key] === 'string' && source[key].length > 0) throw new Error('RUNTIME_COMPOSE_PROVIDER_SECRET_ENV_FORBIDDEN');
  const environment = {...source};
  for (const key of ambientCredentialKeys) delete environment[key];
  return {...environment, LUMICLAW_RUNTIME_UID: String(identity.uid), LUMICLAW_RUNTIME_GID: String(identity.gid)};
}

export async function runPersistentRuntimeCompose(options = {}) {
  const mode = options.mode ?? process.argv[2];
  const action = options.action ?? process.argv[3];
  const identity = resolveRuntimeHostIdentity(options.getuid, options.getgid);
  const invocation = buildPersistentRuntimeComposeInvocation(mode, action, identity);
  const environment = buildRuntimeComposeEnvironment(options.sourceEnv ?? process.env, identity);
  const child = (options.spawnChild ?? spawn)(invocation.command, invocation.args, {
    cwd: path.resolve(options.root ?? process.cwd()),
    env: environment,
    stdio: 'inherit'
  });
  return await new Promise((resolve, reject) => {
    child.once('error', () => reject(new Error('RUNTIME_COMPOSE_START_FAILED')));
    child.once('exit', (code, signal) => {
      if (signal !== null || code !== 0) reject(new Error('RUNTIME_COMPOSE_COMMAND_FAILED'));
      else resolve({mode, action, identity});
    });
  });
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runPersistentRuntimeCompose().catch((error) => {
    process.stderr.write(`${JSON.stringify({status: 'FAIL', code: error instanceof Error ? error.message : 'RUNTIME_COMPOSE_FAILED', secretPresentInOutput: false})}\n`);
    process.exitCode = 1;
  });
}
