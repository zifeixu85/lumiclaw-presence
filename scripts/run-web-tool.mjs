import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';

const [tool, ...args] = process.argv.slice(2);
const entry = tool === 'next'
  ? resolve(process.cwd(), '../../node_modules/next/dist/bin/next')
  : tool === 'storybook'
    ? resolve(process.cwd(), '../../node_modules/storybook/dist/bin/dispatcher.js')
    : undefined;
if (entry === undefined) throw new Error(`Unsupported web tool: ${tool ?? '<missing>'}`);
const result = spawnSync(process.execPath, [entry, ...args], {
  cwd: process.cwd(), stdio: 'inherit',
  env: {...process.env, NEXT_TELEMETRY_DISABLED: '1', STORYBOOK_DISABLE_TELEMETRY: '1'},
});
if (result.error !== undefined) throw result.error;
process.exitCode = result.status ?? 1;
