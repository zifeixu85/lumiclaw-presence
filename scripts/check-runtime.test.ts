import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {describe, expect, it} from 'vitest';

describe('runtime lock', () => {
  it('keeps .nvmrc and package engines aligned', async () => {
    const root = process.cwd();
    const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')) as {
      engines: {node: string; npm: string};
      packageManager: string;
    };
    const nvmrc = (await readFile(path.join(root, '.nvmrc'), 'utf8')).trim();
    expect(packageJson.engines.node).toBe(nvmrc);
    expect(packageJson.packageManager).toBe(`npm@${packageJson.engines.npm}`);
  });
});
