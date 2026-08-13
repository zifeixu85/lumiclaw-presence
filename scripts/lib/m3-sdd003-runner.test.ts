import {describe, expect, it, vi} from 'vitest';
import {npmCommandFor, runAggregate} from './m3-sdd003-runner.mjs';

describe('M3 SDD-003 portable aggregate runner', () => {
  it('uses the platform npm executable without locating npm-cli.js', () => {
    expect(npmCommandFor('win32')).toBe('npm.cmd');
    expect(npmCommandFor('linux')).toBe('npm');
    expect(npmCommandFor('darwin')).toBe('npm');
  });

  it('passes only after every configured step executes successfully', () => {
    const spawn = vi.fn(() => ({status: 0, signal: null}));
    const result = runAggregate({
      platform: 'win32',
      steps: [['one', ['run', 'one']], ['two', ['run', 'two']]],
      spawn,
    });
    expect(result.status).toBe('PASS');
    expect(result.failedStep).toBeNull();
    expect(result.steps.one.status).toBe('PASS');
    expect(result.steps.two.status).toBe('PASS');
    expect(spawn).toHaveBeenNthCalledWith(1, 'npm.cmd', ['run', 'one'], expect.objectContaining({shell: true}));
  });

  it('keeps shell:false on POSIX where PATH npm is a real executable', () => {
    const spawn = vi.fn(() => ({status: 0, signal: null}));
    const result = runAggregate({
      platform: 'linux',
      steps: [['one', ['run', 'one']]],
      spawn,
    });
    expect(result.status).toBe('PASS');
    expect(spawn).toHaveBeenNthCalledWith(1, 'npm', ['run', 'one'], expect.objectContaining({shell: false}));
  });

  it('fails closed on a launch error and leaves later steps NOT_RUN', () => {
    const launchError = Object.assign(new Error('spawn npm ENOENT'), {code: 'ENOENT'});
    const spawn = vi.fn(() => ({status: null, signal: null, error: launchError}));
    const result = runAggregate({
      steps: [['one', ['run', 'one']], ['two', ['run', 'two']]],
      spawn,
    });
    expect(result.status).toBe('FAIL');
    expect(result.failedStep).toBe('one');
    expect(result.steps.one).toMatchObject({status: 'FAIL', exitCode: null, error: {code: 'ENOENT'}});
    expect(result.steps.two.status).toBe('NOT_RUN');
    expect(spawn).toHaveBeenCalledTimes(1);
  });

  it('fails closed on a non-zero exit and records the exact failed step', () => {
    const spawn = vi.fn()
      .mockReturnValueOnce({status: 0, signal: null})
      .mockReturnValueOnce({status: 2, signal: null});
    const result = runAggregate({
      steps: [['one', ['run', 'one']], ['two', ['run', 'two']], ['three', ['run', 'three']]],
      spawn,
    });
    expect(result.status).toBe('FAIL');
    expect(result.failedStep).toBe('two');
    expect(result.steps.two).toMatchObject({status: 'FAIL', exitCode: 2});
    expect(result.steps.three.status).toBe('NOT_RUN');
  });

  it('fails closed when a child is terminated by a signal', () => {
    const spawn = vi.fn(() => ({status: null, signal: 'SIGTERM'}));
    const result = runAggregate({steps: [['one', ['run', 'one']]], spawn});
    expect(result).toMatchObject({status: 'FAIL', failedStep: 'one'});
    expect(result.steps.one).toMatchObject({status: 'FAIL', signal: 'SIGTERM'});
  });
});
