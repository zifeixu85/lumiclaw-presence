import {describe, expect, it, vi} from 'vitest';
import {buildPersistentRuntimeComposeInvocation, buildRuntimeComposeEnvironment, redactRuntimeDiagnostic, resolveRuntimeHostIdentity, runPersistentRuntimeCompose} from './run-persistent-runtime-compose.mjs';

describe('persistent runtime Compose launcher identity boundary', () => {
  it('binds the model gateway to the exact non-root host uid/gid and a fixed command surface', () => {
    const identity = resolveRuntimeHostIdentity(() => 501, () => 20);
    expect(identity).toEqual({uid: 501, gid: 20, composeUser: '501:20'});
    const fake = buildPersistentRuntimeComposeInvocation('fake', 'up', identity);
    expect(fake.environment).toEqual({LUMICLAW_RUNTIME_UID: '501', LUMICLAW_RUNTIME_GID: '20'});
    expect(fake.args).toEqual(['compose', '-f', 'compose.yml', '-f', 'compose.persistent-runtime.yml', '--profile', 'persistent-runtime', '--project-name', 'lumiclaw-sdd007', 'up', '-d', '--build', 'postgres', 'migrate', 'model-gateway', 'api', 'web']);
    expect(buildPersistentRuntimeComposeInvocation('deepseek', 'down', identity).args).toContain('compose.persistent-runtime-deepseek.yml');
  });

  it('fails closed for root, unavailable, malformed, or user-controlled command identities', () => {
    expect(() => resolveRuntimeHostIdentity(() => 0, () => 0)).toThrow('RUNTIME_COMPOSE_NON_ROOT_IDENTITY_REQUIRED');
    expect(() => resolveRuntimeHostIdentity(null as never, null as never)).toThrow('RUNTIME_COMPOSE_POSIX_IDENTITY_REQUIRED');
    expect(() => resolveRuntimeHostIdentity(() => Number.NaN, () => 20)).toThrow('RUNTIME_COMPOSE_NON_ROOT_IDENTITY_REQUIRED');
    expect(() => buildPersistentRuntimeComposeInvocation('fake', 'exec', {uid: 501, gid: 20, composeUser: '501:20'})).toThrow('RUNTIME_COMPOSE_ACTION_INVALID');
    expect(() => buildPersistentRuntimeComposeInvocation('remote', 'up', {uid: 501, gid: 20, composeUser: '501:20'})).toThrow('RUNTIME_COMPOSE_MODE_INVALID');
  });

  it('injects only resolved uid/gid values into the Docker child invocation', async () => {
    const once = vi.fn();
    const spawnChild = vi.fn((_command, _args, options) => {
      expect(options.env.LUMICLAW_RUNTIME_UID).toBe('1001');
      expect(options.env.LUMICLAW_RUNTIME_GID).toBe('1002');
      expect(options.env.LUMICLAW_RUNTIME_UID).not.toBe('${HOST_UID}');
      return {once: (event, callback) => { once(event); if (event === 'exit') callback(0, null); }};
    });
    await expect(runPersistentRuntimeCompose({mode: 'fake', action: 'status', getuid: () => 1001, getgid: () => 1002, spawnChild, sourceEnv: {PATH: '/usr/bin'}})).resolves.toMatchObject({mode: 'fake', action: 'status'});
    expect(spawnChild).toHaveBeenCalledTimes(1);
    expect(once).toHaveBeenCalledWith('error');
    expect(once).toHaveBeenCalledWith('exit');
  });

  it('rejects provider keys in the launcher environment and strips ambient cloud credentials', async () => {
    const identity = {uid: 501, gid: 20, composeUser: '501:20'};
    expect(() => buildRuntimeComposeEnvironment({PATH: '/usr/bin', DEEPSEEK_API_KEY: 'must-not-enter-docker'}, identity)).toThrow('RUNTIME_COMPOSE_PROVIDER_SECRET_ENV_FORBIDDEN');
    expect(buildRuntimeComposeEnvironment({PATH: '/usr/bin', AWS_ACCESS_KEY_ID: 'must-not-enter-docker', AWS_SECRET_ACCESS_KEY: 'must-not-enter-docker'}, identity)).toEqual({PATH: '/usr/bin', LUMICLAW_RUNTIME_UID: '501', LUMICLAW_RUNTIME_GID: '20'});
    await expect(runPersistentRuntimeCompose({mode: 'fake', action: 'status', getuid: () => 501, getgid: () => 20, spawnChild: vi.fn(), sourceEnv: {DEEPSEEK_API_KEY: 'must-not-enter-docker'}})).rejects.toThrow('RUNTIME_COMPOSE_PROVIDER_SECRET_ENV_FORBIDDEN');
  });

  it('redacts exact secret values and credential-shaped diagnostics', () => {
    const diagnostic = redactRuntimeDiagnostic('bootstrap=private-bootstrap API_KEY=private-key safe=kept', ['private-bootstrap']);
    expect(diagnostic).toContain('safe=kept');
    expect(diagnostic).not.toContain('private-bootstrap');
    expect(diagnostic).not.toContain('private-key');
  });
});
