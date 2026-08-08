import {rm} from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.cwd());
const targets = [
  'apps/api/dist',
  'apps/mission-worker/dist',
  'apps/action-operator/dist',
  'apps/web/.next',
  'apps/web/storybook-static',
  'packages/blob-store/dist',
  'packages/db/dist',
  'packages/i18n/dist',
  'packages/process-health/dist',
  'packages/runtime-agentteams/dist',
  'apps/web/tsconfig.tsbuildinfo',
  'packages/blob-store/tsconfig.tsbuildinfo',
  'packages/db/tsconfig.tsbuildinfo',
  'packages/i18n/tsconfig.tsbuildinfo',
  'packages/process-health/tsconfig.tsbuildinfo',
  'packages/runtime-agentteams/tsconfig.tsbuildinfo',
  'coverage'
];

for (const target of targets) {
  const resolved = path.resolve(root, target);
  if (!resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Refusing to clean path outside repository: ${resolved}`);
  }
  await rm(resolved, {recursive: true, force: true});
}
console.info(`Cleaned ${targets.length} repository-scoped build paths.`);
